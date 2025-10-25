## Production Deployment Overview

The production stack now runs on Google Kubernetes Engine (GKE) with shared
infrastructure managed by Terraform. Four Kubernetes Deployments/Services are maintained:

- `dm` – core game logic and API
- `world` – renders world state and map imagery
- `slack-bot` – Slack interface that fans out to `dm`/`world`
- `tick` – background worker that triggers game ticks

### Supporting Resources

Terraform also provisions:

- Cloud SQL (PostgreSQL 15) with a generated password surfaced via Secret Manager
- Memorystore (Redis) on the shared VPC
- Artifact Registry (`mud-services`) for container images
- Shared VPC networking, private service access, and a global HTTP(S) ingress IP
- Secret Manager entries that are mirrored into Kubernetes secrets
- Custom domains (`slack-bot.battleforge.app`, `world.battleforge.app`)

### Required GitHub Secrets (Production Environment)

Configure the following secrets on the GitHub **Production** environment so the
deploy workflow can authenticate and provide runtime credentials:

| Secret Name                      | Purpose                                                       |
| -------------------------------- | ------------------------------------------------------------- |
| `GCP_DEPLOY_SA`                  | Email of the Workload Identity-enabled deploy service account |
| `GCP_WORKLOAD_IDENTITY_PROVIDER` | Full resource name of the Workload Identity Provider          |
| `GCP_PROJECT_ID`                 | Target Google Cloud project                                   |
| `GCP_REGION`                     | Default region (e.g. `us-central1`)                           |
| `TF_BACKEND_BUCKET`              | GCS bucket name that stores Terraform state                   |
| `TF_BACKEND_PREFIX`              | Path prefix within the state bucket (e.g. `prod`)             |
| `OPENAI_API_KEY`                 | OpenAI API key for the DM service                             |
| `SLACK_BOT_TOKEN`                | Slack bot token                                               |
| `SLACK_SIGNING_SECRET`           | Slack signing secret                                          |
| `SLACK_APP_TOKEN`                | Slack app-level token                                         |
| `SLACK_CLIENT_ID`                | Slack OAuth client ID                                         |
| `SLACK_CLIENT_SECRET`            | Slack OAuth client secret                                     |
| `SLACK_STATE_SECRET`             | Slack OAuth state secret                                      |

Add any additional secrets referenced by Terraform variables the same way.

### Deploy Workflow

`.github/workflows/deploy.yml` builds Docker images for all four services on every
push to the `main` branch, pushes them to Artifact Registry, and then runs
`terraform apply` with commit-specific image tags. Concurrency is scoped so only
one production deploy runs at a time.

### Running Terraform Manually

To run Terraform locally:

```bash
cd infra/terraform
cat > backend.hcl <<'EOF'
bucket = "<your-state-bucket>"
prefix = "<your-prefix>"
EOF

terraform init -backend-config=backend.hcl
terraform plan
terraform apply
```

Provide the same variables as the deploy workflow by exporting `TF_VAR_*`
environment variables before planning/applying.
