// Terraform configuration is split into logical files:
// - apis.tf               → required service enablement
// - network.tf            → shared VPC, serverless connector, and private service access
// - sql.tf                → Cloud SQL (PostgreSQL)
// - redis.tf              → Memorystore for Redis
// - secrets.tf            → Secret Manager definitions
// - artifact_registry.tf  → Artifact Registry repository
// - iam.tf                → service accounts and IAM bindings
// - gke.tf                → GKE cluster and supporting infrastructure
// - outputs.tf            → exported values for scripts and workflows
//
// Kubernetes manifests (namespaces, workloads, ingress, managed certificates) live in
// ./kubernetes for the second apply stage.
