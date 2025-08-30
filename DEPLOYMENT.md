# MUD Game - GCP Deployment Guide

This guide explains how to deploy the MUD game to Google Cloud Platform using Cloud Run, Cloud SQL, and other GCP services.

## Architecture Overview

- **Cloud Run**: Hosts the microservices (dm, world, bot, tick)
- **Cloud SQL**: PostgreSQL database with private networking
- **Memorystore**: Redis cache
- **Artifact Registry**: Container image storage
- **Global Load Balancer**: HTTPS traffic distribution with SSL certificates
- **Cloud DNS**: Domain management
- **VPC**: Private networking with service access

## Prerequisites

1. **Google Cloud Account** with billing enabled
2. **Domain name** (configured for battleforge.app in the example)
3. **Local tools**:
   - `gcloud` CLI installed and authenticated
   - `docker` installed and running
   - `terraform` installed
   - `node` and `npm` installed

## Quick Start

### 1. Initial GCP Setup

```bash
# Set environment variables
export GCP_PROJECT_ID="mud-game-production"
export GCP_REGION="us-central1"
export GCP_BILLING_ACCOUNT="your-billing-account-id"

# Run the setup script
./scripts/setup-gcp.sh
```

This script will:
- Create/configure the GCP project
- Enable required APIs
- Create Artifact Registry
- Set up service accounts

### 2. Configure Terraform Variables

Copy and customize the Terraform variables:

```bash
cd infra/terraform
cp terraform.tfvars.example terraform.tfvars
```

Edit `terraform.tfvars` with your specific values:

```hcl
project_id = "mud-game-production"
region     = "us-central1"
domain     = "battleforge.app"

# Database configuration
db_tier               = "db-f1-micro"  # Use db-custom-1-3840 for production
db_disk_size         = 20              # Use 100+ for production
db_backup_enabled    = true
db_deletion_protection = false         # Set to true for production

# Redis configuration
redis_memory_size = 1                  # Use 4+ for production

# SSL certificate email
ssl_certificate_email = "admin@battleforge.app"

# Image version (will be set by deploy script)
image_version = "latest"
```

### 3. Deploy Everything

```bash
# Build, containerize, and deploy everything
./scripts/deploy.sh
```

This script will:
- Build all NestJS applications
- Create Docker images
- Push images to Artifact Registry
- Deploy infrastructure with Terraform
- Output service URLs

### 4. Configure DNS

After deployment, configure your domain's DNS to point to the load balancer:

```bash
# Get the load balancer IP
cd infra/terraform
terraform output load_balancer_ip
```

Add these DNS records to your domain:
- `A` record: `dm.yourdomain.com` → Load Balancer IP
- `A` record: `world.yourdomain.com` → Load Balancer IP

### 5. Run Database Migrations

```bash
# Connect to Cloud SQL and run migrations
npx prisma migrate deploy
```

## Development Workflow

### Local Development Setup

```bash
# Set up local development environment
./scripts/dev-setup.sh
```

### Build and Test Locally

```bash
# Build specific service
nx build dm

# Test specific service
nx test world

# Serve for development
nx serve dm
```

### Deploy Specific Components

```bash
# Build and push images only
./scripts/deploy.sh images-only

# Deploy infrastructure only
./scripts/deploy.sh infra-only

# Build applications only
./scripts/deploy.sh build-only
```

## Configuration

### Environment Variables

Each service uses environment variables for configuration. Key variables:

**DM Service**:
- `DATABASE_URL`: PostgreSQL connection string
- `REDIS_URL`: Redis connection string
- `OPENAI_API_KEY`: OpenAI API key
- `WORLD_SERVICE_URL`: Internal URL to world service

**World Service**:
- `DATABASE_URL`: PostgreSQL connection string
- `REDIS_URL`: Redis connection string

**Bot Service**:
- `SLACK_BOT_TOKEN`: Slack bot token
- `SLACK_APP_TOKEN`: Slack app token
- `DM_SERVICE_URL`: Internal URL to DM service

**Tick Service**:
- `DM_SERVICE_URL`: Internal URL to DM service
- `WORLD_SERVICE_URL`: Internal URL to world service

### Service Communication

Services communicate internally using Cloud Run's private networking:
- DM Service: `https://dm-service-hash.a.run.app`
- World Service: `https://world-service-hash.a.run.app`
- Bot Service: `https://bot-service-hash.a.run.app`
- Tick Service: `https://tick-service-hash.a.run.app`

External access is only available for DM and World services through the load balancer.

## Monitoring and Maintenance

### View Logs

```bash
# View Cloud Run logs
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=dm-service"

# Follow logs in real-time
gcloud logging tail "resource.type=cloud_run_revision"
```

### Scale Services

```bash
# Update service configuration
gcloud run services update dm-service \
  --region=us-central1 \
  --max-instances=10 \
  --memory=2Gi
```

### Database Management

```bash
# Connect to Cloud SQL
gcloud sql connect mud-postgres --user=postgres

# Create database backup
gcloud sql backups create --instance=mud-postgres
```

### Update Deployment

```bash
# Update with new version
BUILD_VERSION=$(date +%Y%m%d-%H%M%S) ./scripts/deploy.sh
```

## Security Considerations

1. **Database**: Uses private IP with VPC networking
2. **Redis**: Internal access only through VPC
3. **SSL**: Automatic HTTPS with Google-managed certificates
4. **IAM**: Minimal service account permissions
5. **Secrets**: Use Google Secret Manager for sensitive data

## Cost Optimization

1. **Cloud Run**: Pay per request, scales to zero
2. **Cloud SQL**: Use smaller instances for development
3. **Redis**: Start with 1GB memory
4. **Load Balancer**: Minimal cost for global distribution

## Troubleshooting

### Common Issues

1. **Build Failures**: Check Node.js version and dependencies
2. **Database Connection**: Verify VPC connector and private IP
3. **SSL Issues**: Ensure DNS is properly configured
4. **Service Communication**: Check internal URLs and IAM permissions

### Debug Commands

```bash
# Check Cloud Run service status
gcloud run services describe dm-service --region=us-central1

# Test internal connectivity
gcloud run services proxy dm-service --port=8080

# View Terraform state
cd infra/terraform && terraform show
```

## Cleanup

To destroy all resources:

```bash
cd infra/terraform
terraform destroy
```

**Warning**: This will delete all data including the database!

## Support

For issues with deployment or configuration, check:
1. Cloud Console logs
2. Terraform output
3. Service health checks
4. VPC connectivity

Remember to monitor costs and adjust resource allocation based on actual usage patterns.