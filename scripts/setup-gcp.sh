#!/bin/bash

# Setup GCP Project Script
# This script sets up the GCP project with necessary APIs and initial configuration

set -e

# Configuration
PROJECT_ID="${GCP_PROJECT_ID:-mud-game-production}"
REGION="${GCP_REGION:-us-central1}"
BILLING_ACCOUNT="${GCP_BILLING_ACCOUNT}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if gcloud is installed
check_gcloud() {
    if ! command -v gcloud &> /dev/null; then
        print_error "gcloud CLI is not installed. Please install it first."
        exit 1
    fi
}

# Create or set project
setup_project() {
    print_status "Setting up GCP project: ${PROJECT_ID}"
    
    # Check if project exists
    if gcloud projects describe ${PROJECT_ID} &>/dev/null; then
        print_status "Project ${PROJECT_ID} already exists"
    else
        print_status "Creating project ${PROJECT_ID}..."
        if [ -z "${BILLING_ACCOUNT}" ]; then
            print_error "BILLING_ACCOUNT environment variable is required to create a new project"
            exit 1
        fi
        gcloud projects create ${PROJECT_ID}
        gcloud billing projects link ${PROJECT_ID} --billing-account=${BILLING_ACCOUNT}
    fi
    
    # Set the project as default
    gcloud config set project ${PROJECT_ID}
}

# Enable required APIs
enable_apis() {
    print_status "Enabling required APIs..."
    
    local apis=(
        "cloudbuild.googleapis.com"
        "run.googleapis.com"
        "sql-component.googleapis.com"
        "sqladmin.googleapis.com"
        "redis.googleapis.com"
        "artifactregistry.googleapis.com"
        "compute.googleapis.com"
        "dns.googleapis.com"
        "certificatemanager.googleapis.com"
        "vpcaccess.googleapis.com"
        "servicenetworking.googleapis.com"
        "cloudresourcemanager.googleapis.com"
        "iam.googleapis.com"
    )
    
    for api in "${apis[@]}"; do
        print_status "Enabling ${api}..."
        gcloud services enable ${api}
    done
    
    print_status "All APIs enabled successfully"
}

# Create Artifact Registry
create_artifact_registry() {
    print_status "Creating Artifact Registry..."
    
    # Check if repository exists
    if gcloud artifacts repositories describe mud-registry --location=${REGION} &>/dev/null; then
        print_status "Artifact Registry already exists"
    else
        gcloud artifacts repositories create mud-registry \
            --repository-format=docker \
            --location=${REGION} \
            --description="MUD Game Docker Registry"
        print_status "Artifact Registry created successfully"
    fi
}

# Set up service accounts
setup_service_accounts() {
    print_status "Setting up service accounts..."
    
    # Cloud Run service account
    local service_account="mud-cloud-run-sa"
    
    if gcloud iam service-accounts describe ${service_account}@${PROJECT_ID}.iam.gserviceaccount.com &>/dev/null; then
        print_status "Service account already exists"
    else
        gcloud iam service-accounts create ${service_account} \
            --display-name="MUD Cloud Run Service Account" \
            --description="Service account for MUD game Cloud Run services"
        
        # Grant necessary roles
        gcloud projects add-iam-policy-binding ${PROJECT_ID} \
            --member="serviceAccount:${service_account}@${PROJECT_ID}.iam.gserviceaccount.com" \
            --role="roles/cloudsql.client"
        
        gcloud projects add-iam-policy-binding ${PROJECT_ID} \
            --member="serviceAccount:${service_account}@${PROJECT_ID}.iam.gserviceaccount.com" \
            --role="roles/redis.editor"
        
        print_status "Service account created and configured"
    fi
}

# Display next steps
show_next_steps() {
    print_status "Setup completed successfully!"
    echo ""
    print_status "Next steps:"
    echo "1. Configure your terraform.tfvars file in infra/terraform/"
    echo "2. Review and customize the infrastructure configuration"
    echo "3. Run the deployment script: ./scripts/deploy.sh"
    echo ""
    print_status "Required environment variables for deployment:"
    echo "export GCP_PROJECT_ID=${PROJECT_ID}"
    echo "export GCP_REGION=${REGION}"
    echo ""
    print_warning "Make sure to update the domain configuration in terraform.tfvars"
    print_warning "You'll need to configure DNS records for your domain to point to the load balancer"
}

# Main execution
main() {
    print_status "Starting GCP project setup..."
    print_status "Project ID: ${PROJECT_ID}"
    print_status "Region: ${REGION}"
    
    check_gcloud
    setup_project
    enable_apis
    create_artifact_registry
    setup_service_accounts
    show_next_steps
}

main