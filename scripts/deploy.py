#!/usr/bin/env python3
import argparse
import os
import shutil
import subprocess
import sys
import time
from datetime import datetime


GREEN = "\033[0;32m"
YELLOW = "\033[1;33m"
RED = "\033[0;31m"
NC = "\033[0m"


def info(msg: str):
    print(f"{GREEN}[INFO]{NC} {msg}")


def warn(msg: str):
    print(f"{YELLOW}[WARNING]{NC} {msg}")


def error(msg: str):
    print(f"{RED}[ERROR]{NC} {msg}")


def run(cmd: list[str], check: bool = True, capture_output: bool = False, env=None, cwd=None) -> subprocess.CompletedProcess:
    info(f"$ {' '.join(cmd)}")
    return subprocess.run(cmd, check=check, capture_output=capture_output, text=True, env=env, cwd=cwd)


def which_or_fail(cmd: str, install_hint: str | None = None):
    if shutil.which(cmd) is None:
        hint = f" {install_hint}" if install_hint else ""
        error(f"Required command '{cmd}' not found.{hint}")
        sys.exit(1)


def get_default_version() -> str:
    try:
        res = run(["git", "rev-parse", "--short", "HEAD"], check=True, capture_output=True)
        sha = res.stdout.strip()
        if sha:
            return sha
    except Exception:
        pass
    return datetime.utcnow().strftime("%Y%m%d%H%M%S")


def check_prerequisites():
    info("Checking prerequisites...")
    which_or_fail("gcloud")
    which_or_fail("docker")
    which_or_fail("terraform")
    which_or_fail("npx")
    info("Prerequisites check completed")


def configure_docker(region: str):
    info("Configuring Docker for Artifact Registry...")
    run(["gcloud", "auth", "configure-docker", f"{region}-docker.pkg.dev", "--quiet"]) 


def nx_sync():
    info("Syncing Nx workspace before Docker builds...")
    run(["npx", "nx", "sync"]) 
    info("Nx workspace synced. Skipping local NX build; builds are handled in Dockerfiles.")


def build_and_push_images(project_id: str, region: str, registry_name: str, version: str):
    info("Building and pushing Docker images...")
    registry_url = f"{region}-docker.pkg.dev/{project_id}/{registry_name}"
    services = ["dm", "world", "slack-bot", "tick"]

    for svc in services:
        info(f"Building {svc} image...")
        image_tag = f"{registry_url}/{svc}:{version}"
        image_latest = f"{registry_url}/{svc}:latest"
        dockerfile = f"apps/{svc}/Dockerfile" if svc != "slack-bot" else "apps/slack-bot/Dockerfile"

        run(["docker", "build", "-t", image_tag, "-t", image_latest, "-f", dockerfile, "."]) 
        info(f"Pushing {svc} image...")
        run(["docker", "push", image_tag])
        run(["docker", "push", image_latest])
        info(f"{svc} image pushed successfully")


def ensure_images_exist(project_id: str, region: str, registry_name: str, version: str):
    registry_repo = f"{region}-docker.pkg.dev/{project_id}/{registry_name}"
    services = ["dm", "world", "slack-bot", "tick"]
    missing: list[str] = []
    for svc in services:
        try:
            res = run(
                [
                    "gcloud",
                    "artifacts",
                    "docker",
                    "images",
                    "list",
                    f"{registry_repo}/{svc}",
                    "--include-tags",
                    "--format=value(tags)",
                ],
                capture_output=True,
            )
            tags = []
            for line in res.stdout.splitlines():
                tags.extend([t.strip() for t in line.split(",") if t.strip()])
            if version not in tags:
                missing.append(svc)
        except subprocess.CalledProcessError:
            missing.append(svc)
    if missing:
        warn(f"Images missing for tag '{version}': {' '.join(missing)}")
        warn("Build and push images first. Try: python3 scripts/deploy.py images-only")
        sys.exit(1)


def terraform_deploy(project_id: str, region: str, version: str):
    info("Deploying infrastructure with Terraform...")

    # Update terraform.tfvars with DB password from Secret Manager
    res = run(["gcloud", "secrets", "versions", "access", "latest", "--secret=cloud-sql-db-password"], capture_output=True)
    db_password = res.stdout.strip()
    tfvars_path = os.path.join("infra", "terraform", "terraform.tfvars")
    with open(tfvars_path, "r", encoding="utf-8") as f:
        contents = f.read()
    if "db_password" in contents:
        new_contents = []
        for line in contents.splitlines():
            if line.strip().startswith("db_password"):
                new_contents.append(f"db_password = \"{db_password}\"")
            else:
                new_contents.append(line)
        contents = "\n".join(new_contents) + "\n"
    else:
        contents = contents.rstrip("\n") + f"\ndb_password = \"{db_password}\"\n"
    with open(tfvars_path, "w", encoding="utf-8") as f:
        f.write(contents)

    cwd = os.path.join("infra", "terraform")
    # terraform init is optional if already initialized; keep it commented like bash
    # run(["terraform", "init"], cwd=cwd)
    info("Planning Terraform deployment...")
    run(["terraform", "plan", f"-var=project_id={project_id}", f"-var=region={region}", f"-var=image_version={version}"], cwd=cwd)
    info("Applying Terraform changes...")
    run(["terraform", "apply", f"-var=project_id={project_id}", f"-var=region={region}", f"-var=image_version={version}", "-auto-approve"], cwd=cwd)
    info("Infrastructure deployed successfully")

    update_slack_bot_endpoints(project_id, region)


def update_slack_bot_endpoints(project_id: str, region: str):
    info("Updating Slack Bot endpoint environment variables from actual Cloud Run service URLs...")
    slack_service = "mud-slack-bot"
    # Query service URLs
    dm_uri = (
        run([
            "gcloud",
            "run",
            "services",
            "list",
            f"--project={project_id}",
            "--format=csv[no-heading](SERVICE,URL)",
        ], capture_output=True)
        .stdout
        .splitlines()
    )
    dm_url = next((line.split(",")[1] for line in dm_uri if line.startswith("mud-dm,")), "")
    world_url = next((line.split(",")[1] for line in dm_uri if line.startswith("mud-world,")), "")
    if not dm_url or not world_url:
        warn("Could not retrieve dm/world service URLs. Skipping endpoint update.")
        return
    dm_gql = f"{dm_url}/graphql"
    world_gql = f"{world_url}/graphql"
    world_base = f"{world_url}/world"

    info("Resolved endpoints:")
    print(f"  DM_GQL_ENDPOINT={dm_gql}")
    print(f"  WORLD_GQL_ENDPOINT={world_gql}")
    print(f"  WORLD_BASE_URL={world_base}")

    run(
        [
            "gcloud",
            "run",
            "services",
            "update",
            slack_service,
            f"--region={region}",
            f"--project={project_id}",
            f"--update-env-vars=DM_GQL_ENDPOINT={dm_gql},WORLD_GQL_ENDPOINT={world_gql}",
        ]
    )
    info("Slack Bot environment variables updated.")


def run_migrations():
    info("Running database migrations...")

    instance = "mud-postgres"
    db_name = "mud_dev"
    db_user = "mud"
    # Fetch password
    res = run(["gcloud", "secrets", "versions", "access", "latest", "--secret=cloud-sql-db-password"], capture_output=True)
    db_password = res.stdout.strip()
    connection_name = "battleforge-444008:us-central1:mud-postgres"  # mirrors bash
    db_port = 5432

    # Ensure proxy binary exists
    proxy_path = os.path.join("scripts", "cloud-sql-proxy")
    if not os.path.exists(proxy_path):
        info("cloud-sql-proxy not found, downloading...")
        run([
            "curl",
            "-o",
            proxy_path,
            "https://storage.googleapis.com/cloud-sql-connectors/cloud-sql-proxy/v2.18.1/cloud-sql-proxy.linux.amd64",
        ])
        os.chmod(proxy_path, 0o755)

    # Start proxy
    info("Starting Cloud SQL Proxy...")
    proxy = subprocess.Popen([proxy_path, f"--address=127.0.0.1", f"--port={db_port}", connection_name])
    time.sleep(5)

    try:
        # Set DATABASE_URL and run prisma migrate
        os.environ["DATABASE_URL"] = f"postgresql://{db_user}:{db_password}@127.0.0.1:{db_port}/{db_name}?schema=public&sslmode=disable&connect_timeout=60"
        info(f"Using DATABASE_URL: {os.environ['DATABASE_URL']}")
        run(["npx", "prisma", "migrate", "deploy", "--schema=libs/database/prisma/schema.prisma"]) 
    finally:
        info("Stopping Cloud SQL Proxy...")
        proxy.terminate()
        try:
            proxy.wait(timeout=10)
        except subprocess.TimeoutExpired:
            proxy.kill()
        os.environ.pop("DATABASE_URL", None)


def main():
    parser = argparse.ArgumentParser(description="Build and deploy Nx services to GCP (Python version)")
    sub = parser.add_subparsers(dest="command")
    sub.add_parser("migration-only")
    sub.add_parser("build-only")
    sub.add_parser("images-only")
    sub.add_parser("infra-only")
    sub.add_parser("update-slack-bot-endpoints")

    args = parser.parse_args()

    project_id = os.environ.get("GCP_PROJECT_ID", "battleforge-444008")
    region = os.environ.get("GCP_REGION", "us-central1")
    registry_name = "mud-registry"
    version = os.environ.get("BUILD_VERSION") or get_default_version()

    info("Starting build and deployment process...")
    info(f"Project ID: {project_id}")
    info(f"Region: {region}")
    info(f"Version: {version}")

    if args.command == "migration-only":
        run_migrations()
        return
    if args.command == "build-only":
        check_prerequisites()
        nx_sync()
        return
    if args.command == "images-only":
        check_prerequisites()
        configure_docker(region)
        nx_sync()
        build_and_push_images(project_id, region, registry_name, version)
        update_slack_bot_endpoints(project_id, region)
        return
    if args.command == "infra-only":
        # Ensure images exist for this tag before running TF (prevents image-not-found)
        ensure_images_exist(project_id, region, registry_name, version)
        terraform_deploy(project_id, region, version)
        return
    if args.command == "update-slack-bot-endpoints":
        update_slack_bot_endpoints(project_id, region)
        return

    # default: full pipeline
    check_prerequisites()
    configure_docker(region)
    nx_sync()
    build_and_push_images(project_id, region, registry_name, version)
    terraform_deploy(project_id, region, version)
    run_migrations()

    info("Deployment completed successfully!")
    print("  Slack Bot Service: https://slack-bot.battleforge.app (public)")
    print("  DM Service: (internal service - accessible via VPC)")
    print("  World Service: (internal service - accessible via VPC)")
    print("  Tick Service: (internal service - accessible via VPC)")


if __name__ == "__main__":
    main()
