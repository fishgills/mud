# Terraform Infrastructure

This directory provisions the production stack for the MUD services on Google Cloud.
Terraform manages the following resources:

- A Google Kubernetes Engine (GKE) cluster hosting four Kubernetes Deployments/Services/Ingress resources (`dm`, `world`, `slack-bot`, `tick`)
- Cloud SQL (PostgreSQL 15) with private VPC connectivity
- Memorystore (Redis) for caching and coordination
- Artifact Registry (Docker) for the service images
- Service accounts, Workload Identity Federation for GitHub Actions, and runtime IAM bindings
- Shared VPC networking, private service access, and Cloud DNS records for the ingress load balancer
- Secret Manager entries that populate Kubernetes secrets for runtime configuration

The previous single-VM/docker-compose deployment has been removed.

## Remote State Backend

Terraform state should live in Google Cloud Storage so local and CI/CD runs stay in sync.
The backend configuration is stored in `backend.hcl`, which is intentionally not committed.

1. Create (or reuse) a GCS bucket:

   ```bash
   gcloud storage buckets create gs://mud-terraform-state \
     --project "${GCP_PROJECT_ID}" \
     --location "${GCP_REGION}"
   ```

2. Copy and edit the example backend file with your bucket details:

   ```bash
   cp backend.hcl.example backend.hcl
   ```

   ```hcl
   bucket = "mud-terraform-state"
   prefix = "prod"
   ```

3. Initialize Terraform with the backend settings:

   ```bash
   terraform init -backend-config=backend.hcl
   ```

   Use `-migrate-state` the first time if you are moving existing local state into the bucket.

### GitHub Actions

The deploy workflow (added separately) generates `backend.hcl` on the fly. Supply these GitHub
environment secrets so the workflow can build the file:

- `TF_BACKEND_BUCKET`
- `TF_BACKEND_PREFIX`

Grant each Terraform runner identity (your user account and the GitHub Actions service account)
`roles/storage.objectAdmin` on the bucket.

### One-time IAM bootstrap

Run the helper script to seed IAM permissions for Terraform and GitHub Actions:

```bash
terraform output -raw github_actions_service_account_email
terraform output -raw github_actions_workload_identity_provider

./scripts/bootstrap-terraform.sh \
  --project <PROJECT_ID> \
  --bucket <STATE_BUCKET> \
  --tf-service-account <SERVICE_ACCOUNT_EMAIL> \
  --user-email <YOUR_USER_EMAIL>
```

The script grants:

- Storage access to the Terraform state bucket
- IAM roles that let Terraform administer service accounts, GKE, Cloud SQL, Redis, DNS, and networking
- `roles/iam.workloadIdentityUser` so GitHub Actions can impersonate the deployer service account

Re-run the script whenever you add new users or recreate credentials.

## Configuration

Edit `terraform.tfvars` (or create an override file) to point at your project/region/domain.
Key variables include:

- `project_id`, `region`, `environment`
- `artifact_repo_id` / `artifact_repo_location`
- `domain` and `dns_zone_name` (must match an existing Cloud DNS managed zone)
- Optional `github_repository` (`OWNER/REPO`) to enable Workload Identity Federation

Secrets must be provided via Terraform variables before applying:

- OpenAI API key
- Slack bot credentials (token, signing secret, app token, client ID/secret, state secret)

These are stored in Secret Manager and synced into Kubernetes secrets. Terraform will error if a required secret
is missing a version.

## Running Terraform Locally

1. Authenticate with Google Cloud:
   ```bash
   gcloud auth application-default login
   ```
2. Initialize (if not already done):
   ```bash
   terraform init -backend-config=backend.hcl
   ```
3. Plan or apply:
   ```bash
   terraform plan   # review changes
   terraform apply  # deploy
   ```

Always run `plan` before `apply`, especially when modifying production infrastructure.
