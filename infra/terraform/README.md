# Terraform Infrastructure

This directory contains the Terraform configuration for the production infrastructure.

## Remote State Backend

Terraform stores state remotely in a Google Cloud Storage bucket so that local runs and
GitHub Actions share the same view of resources. The backend is configured via
`backend.hcl`, which is **not** committed to the repository.

1. Create the state bucket once (skip if it already exists):

   ```bash
   gcloud storage buckets create gs://mud-terraform-state \
     --project "${GCP_PROJECT_ID}" \
     --location "${GCP_REGION}"
   ```

   Replace the bucket name, project, and region as appropriate for your environment.

2. Copy the example backend configuration and edit it with your bucket details:

   ```bash
   cp backend.hcl.example backend.hcl
   ```

   Update `backend.hcl` with your bucket name and an appropriate prefix, for example:

   ```hcl
   bucket = "mud-terraform-state"
   prefix = "prod"
   ```

3. When running Terraform locally, initialize the workspace with the backend config:

   ```bash
   terraform init -backend-config=backend.hcl
   ```

   If you previously used local state files, pass `-migrate-state` once during
   initialization to move the existing state to the bucket:

   ```bash
   terraform init -backend-config=backend.hcl -migrate-state
   ```

### GitHub Actions

The deployment workflow expects the following repository secrets:

- `TF_BACKEND_BUCKET` – the name of the GCS bucket that stores Terraform state.
- `TF_BACKEND_PREFIX` – the path prefix inside the bucket (for example `prod`).

During the workflow, these secrets are used to generate `infra/terraform/backend.hcl`
so `terraform init` uses the same remote state.

Grant read/write permissions on the bucket to every identity that will run
Terraform (for example, your GitHub Actions service account and your personal
user account). Each identity needs `storage.objects.list`, `get`, and
`create`, which can be satisfied with the `roles/storage.objectAdmin` role.

### One-time IAM Bootstrap

The helper script `scripts/bootstrap-terraform.sh` applies all required IAM
bindings so Terraform and GitHub Actions can manage infrastructure:

```bash
terraform output -raw github_actions_service_account_email
terraform output -raw github_actions_workload_identity_provider

./scripts/bootstrap-terraform.sh \
   --project battleforge-444008 \
   --bucket mud-terraform-state \
  --tf-service-account github-actions@battleforge-444008.iam.gserviceaccount.com \
  --user-email you@example.com \
  --runtime-service-account custom-runtime@battleforge-444008.iam.gserviceaccount.com
```

The script performs the following:

- Grants `roles/storage.objectAdmin` on the Terraform state bucket to the
  GitHub Actions service account (and optionally a local user).
- Grants `roles/iam.serviceAccountAdmin` and `roles/iam.workloadIdentityPoolAdmin`
  on the project so Terraform can create/update the deployer service account and
  Workload Identity pool.
- Grants `roles/iam.serviceAccountUser` on the Cloud Run runtime service account
  (default Compute Engine service account) so Terraform can deploy Cloud Run
  services. Pass `--runtime-service-account` to grant the same role on any
  additional runtime service accounts that your services use.

You can re-run the script any time to add new users or after recreating the
service account/bucket.

## Local Usage

Authenticate with Google Cloud before running Terraform commands locally:

```bash
gcloud auth application-default login
```

Then run Terraform as needed (plan, apply, etc.). Always pass the backend config when
initializing a new workspace to ensure you are using the shared remote state.
