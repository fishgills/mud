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
`create`, which can be satisfied with the `roles/storage.objectAdmin` role:

```bash
gcloud storage buckets add-iam-policy-binding gs://mud-terraform-state \
   --member="serviceAccount:${GCP_SERVICE_ACCOUNT}" \
   --role="roles/storage.objectAdmin"

gcloud storage buckets add-iam-policy-binding gs://mud-terraform-state \
   --member="user:you@example.com" \
   --role="roles/storage.objectAdmin"
```

Adjust the bucket name and members as needed.

## Local Usage

Authenticate with Google Cloud before running Terraform commands locally:

```bash
gcloud auth application-default login
```

Then run Terraform as needed (plan, apply, etc.). Always pass the backend config when
initializing a new workspace to ensure you are using the shared remote state.
