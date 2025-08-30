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
    print_status "Building all services..."
    
    # Build all applications
    nx build dm
    nx build world
    nx build slack-bot
    nx build tick
    
    print_status "All services built successfully"
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
            dockerfile_path="apps/bot/Dockerfile"
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
    
    cd infra/terraform
    
    # Initialize Terraform
    # terraform init
    
    # Plan the deployment
    print_status "Planning Terraform deployment..."
    terraform plan -var="project_id=${PROJECT_ID}" -var="region=${REGION}" -var="image_version=${VERSION}"

    # Ask for confirmation
    read -p "Do you want to apply these changes? (y/N): " confirm
    if [[ $confirm == [yY] || $confirm == [yY][eE][sS] ]]; then
        print_status "Applying Terraform changes..."
        terraform apply -var="project_id=${PROJECT_ID}" -var="region=${REGION}" -var="image_version=${VERSION}" -auto-approve
        print_status "Infrastructure deployed successfully"
    else
        print_warning "Deployment cancelled"
        exit 0
    fi
    
    cd ../..
}

# Run database migrations
run_migrations() {
    print_status "Running database migrations..."
    
    # This would typically connect to the Cloud SQL instance and run Prisma migrations
    # For now, we'll just show the command that would be run
    print_warning "Database migration step - please run manually:"
    echo "npx prisma migrate deploy"
    echo "You may need to set up a Cloud SQL Proxy or use the Cloud Shell"
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
    *)
        main
        ;;
esac