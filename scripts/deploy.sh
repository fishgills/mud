#!/bin/bash

# Build and Deploy to GCP Script
# This script builds all services, creates Docker images, and pushes them to GCP Artifact Registry

set -e

# Configuration
PROJECT_ID="${GCP_PROJECT_ID:-battleforge-444008}"
REGION="${GCP_REGION:-us-central1}"
REGISTRY_NAME="mud-registry"
# Use 'latest' as default unless BUILD_VERSION is set
VERSION="${BUILD_VERSION:-latest}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check prerequisites
check_prerequisites() {
    print_status "Checking prerequisites..."
    
    # Check if gcloud is installed and authenticated
    if ! command -v gcloud &> /dev/null; then
        print_error "gcloud CLI is not installed. Please install it first."
        exit 1
    fi
    
    # Check if docker is running
    if ! docker info > /dev/null 2>&1; then
        print_error "Docker is not running. Please start Docker first."
        exit 1
    fi
    
    # Check if nx is available
    if ! command -v nx &> /dev/null; then
        print_error "Nx is not installed. Please install it first: npm install -g nx"
        exit 1
    fi
    
    print_status "Prerequisites check completed"
}

# Configure Docker for Artifact Registry
configure_docker() {
    print_status "Configuring Docker for Artifact Registry..."
    gcloud auth configure-docker ${REGION}-docker.pkg.dev --quiet
}

# Build all services
build_services() {
    print_status "Syncing Nx workspace before Docker builds..."
    npx nx sync
    print_status "Nx workspace synced. Skipping local NX build; builds are now handled inside Dockerfiles."
}

# Build and push Docker images
build_and_push_images() {
    print_status "Building and pushing Docker images..."
    
    local registry_url="${REGION}-docker.pkg.dev/${PROJECT_ID}/${REGISTRY_NAME}"
    
    # Services to build
    local services=("dm" "world" "slack-bot" "tick")
    
    for service in "${services[@]}"; do
        print_status "Building ${service} image..."

        local image_name="${registry_url}/${service}:${VERSION}"
        local latest_image_name="${registry_url}/${service}:latest"

        # Handle different folder structure for slack-bot
        local dockerfile_path
        if [ "$service" == "slack-bot" ]; then
            dockerfile_path="apps/slack-bot/Dockerfile"
        else
            dockerfile_path="apps/${service}/Dockerfile"
        fi

        # Build the Docker image
        docker build -t ${image_name} -t ${latest_image_name} -f ${dockerfile_path} .

        # Always push both versioned and latest tags
        print_status "Pushing ${service} image..."
        docker push ${image_name}
        docker push ${latest_image_name}

        print_status "${service} image pushed successfully"
    done
}

# Deploy infrastructure with Terraform
deploy_infrastructure() {

    print_status "Deploying infrastructure with Terraform..."

    # Fetch DB password from Secret Manager
    DB_PASSWORD=$(gcloud secrets versions access latest --secret=cloud-sql-db-password)

    # Update terraform.tfvars with the latest DB password
    TFVARS_FILE="infra/terraform/terraform.tfvars"
    if grep -q '^db_password' "$TFVARS_FILE"; then
        echo "Updating db_password in $TFVARS_FILE"
        sed -i "s/^db_password *= *.*/db_password = \"$DB_PASSWORD\"/" "$TFVARS_FILE"
    else
        echo "Adding db_password to $TFVARS_FILE"
        echo "db_password = \"$DB_PASSWORD\"" >> "$TFVARS_FILE"
    fi

    cd infra/terraform

    # Initialize Terraform
    # terraform init

    # Plan the deployment
    print_status "Planning Terraform deployment..."
    terraform plan -var="project_id=${PROJECT_ID}" -var="region=${REGION}" -var="image_version=${VERSION}"

    if [[ $confirm == [yY] || $confirm == [yY][eE][sS] ]]; then
        print_status "Applying Terraform changes..."
        terraform apply -var="project_id=${PROJECT_ID}" -var="region=${REGION}" -var="image_version=${VERSION}" -auto-approve
        print_status "Infrastructure deployed successfully"

        # After apply, update Slack Bot endpoints to actual service URLs to avoid hard-coded values
        update_slack_bot_endpoints
    else
        print_warning "Deployment cancelled"
        exit 0
    fi

    cd ../..
}

# Update Slack Bot endpoint environment variables to the actual DM and World service URLs
update_slack_bot_endpoints() {
    print_status "Updating Slack Bot endpoint environment variables from Terraform outputs..."

    local slack_bot_service_name="mud-slack-bot"

    # Move into terraform directory to read outputs
    pushd infra/terraform >/dev/null

    local outputs_json
    if ! outputs_json=$(terraform output -json cloud_run_services 2>/dev/null); then
        print_warning "Could not read Terraform output 'cloud_run_services'. Skipping endpoint update."
        popd >/dev/null
        return 0
    fi

    # Extract dm and world URLs using jq
    if ! command -v jq &> /dev/null; then
        print_warning "jq is not installed; cannot parse Terraform outputs. Skipping endpoint update."
        popd >/dev/null
        return 0
    fi

    local dm_uri
    local world_uri
    dm_uri=$(echo "$outputs_json" | jq -r '.["dm"].url')
    world_uri=$(echo "$outputs_json" | jq -r '.["world"].url')

    if [[ -z "$dm_uri" || "$dm_uri" == "null" || -z "$world_uri" || "$world_uri" == "null" ]]; then
        print_warning "Terraform outputs missing dm/world URIs. Skipping endpoint update."
        popd >/dev/null
        return 0
    fi

    local dm_gql_endpoint="${dm_uri}/graphql"
    local world_gql_endpoint="${world_uri}/graphql"
    local world_base_url="${world_uri}/world"

    print_status "Resolved endpoints:"
    echo "  DM_GQL_ENDPOINT=${dm_gql_endpoint}"
    echo "  WORLD_GQL_ENDPOINT=${world_gql_endpoint}"
    echo "  WORLD_BASE_URL=${world_base_url}"

    # Update only these env vars; other env vars (including secrets) remain unchanged
    gcloud run services update "${slack_bot_service_name}" \
        --region "${REGION}" \
        --project "${PROJECT_ID}" \
        --update-env-vars "DM_GQL_ENDPOINT=${dm_gql_endpoint},WORLD_GQL_ENDPOINT=${world_gql_endpoint},WORLD_BASE_URL=${world_base_url}"

    print_status "Slack Bot environment variables updated."

    popd >/dev/null
}

# Run database migrations
run_migrations() {

        print_status "Running database migrations..."

        # Cloud SQL instance details
        INSTANCE_NAME="mud-postgres"
        DB_NAME="mud_dev"
        DB_USER="mud"
         # Fetch Cloud SQL password from Secret Manager
         DB_PASSWORD=$(gcloud secrets versions access latest --secret=cloud-sql-db-password)
        CONNECTION_NAME="battleforge-444008:us-central1:mud-postgres"
        DB_PORT=5432

    # Start Cloud SQL Proxy in background
    print_status "Starting Cloud SQL Proxy..."
    # Check if Cloud SQL Proxy exists, if not, download it
    if [ ! -f ./scripts/cloud-sql-proxy ]; then
        print_status "cloud-sql-proxy not found, downloading..."
        curl -o ./scripts/cloud-sql-proxy https://storage.googleapis.com/cloud-sql-connectors/cloud-sql-proxy/v2.18.1/cloud-sql-proxy.linux.amd64
        chmod +x ./scripts/cloud-sql-proxy
    fi

    ./scripts/cloud-sql-proxy --address=127.0.0.1 --port=${DB_PORT} ${CONNECTION_NAME} &
    PROXY_PID=$!
    sleep 5 # Wait for proxy to start

    # Set DATABASE_URL for Prisma
    export DATABASE_URL="postgresql://${DB_USER}:${DB_PASSWORD}@127.0.0.1:${DB_PORT}/${DB_NAME}?schema=public&sslmode=disable&connect_timeout=60"

    print_status "Running Prisma migrations..."
    print_status "Using DATABASE_URL: ${DATABASE_URL}"
    npx prisma migrate deploy --schema=libs/database/prisma/schema.prisma
    MIGRATE_EXIT_CODE=$?

    # Stop the proxy
    print_status "Stopping Cloud SQL Proxy..."
    kill $PROXY_PID
    unset DATABASE_URL

    if [ $MIGRATE_EXIT_CODE -ne 0 ]; then
        print_error "Prisma migration failed. Cloud SQL Proxy stopped."
        exit $MIGRATE_EXIT_CODE
    fi

    print_status "Database migrations completed."
}

# Main execution
main() {
    print_status "Starting build and deployment process..."
    print_status "Project ID: ${PROJECT_ID}"
    print_status "Region: ${REGION}"
    print_status "Version: ${VERSION}"
    
    check_prerequisites
    configure_docker
    build_services
    build_and_push_images
    deploy_infrastructure
    run_migrations
    
    print_status "Deployment completed successfully!"
    print_status "Your services should be available at:"
    echo "  Slack Bot Service: https://slack-bot.battleforge.app (public)"
    echo "  DM Service: (internal service - accessible via VPC)"
    echo "  World Service: (internal service - accessible via VPC)"
    echo "  Tick Service: (internal service - accessible via VPC)"
}

# Handle script arguments
case "${1:-}" in
    "migration-only")
        run_migrations
        ;;
    "build-only")
        check_prerequisites
        build_services
        ;;
    "images-only")
        check_prerequisites
        configure_docker
        build_and_push_images
        ;;
    "infra-only")
        deploy_infrastructure
        ;;
    "update-slack-bot-endpoints")
        update_slack_bot_endpoints
        ;;
    *)
        main
        ;;
esac