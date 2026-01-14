#!/bin/bash

# Local Development Setup Script
# This script sets up the local development environment

set -e

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

# Check prerequisites
check_prerequisites() {
    print_status "Checking prerequisites..."
    
    # Check Node.js
    if ! command -v node &> /dev/null; then
        print_error "Node.js is not installed. Please install Node.js 18 or later."
        exit 1
    fi
    
    # Check npm
    if ! command -v npm &> /dev/null; then
        print_error "npm is not installed. Please install npm."
        exit 1
    fi
    
    # Check Docker
    if ! command -v docker &> /dev/null; then
        print_warning "Docker is not installed. You'll need it for local PostgreSQL/Redis."
    fi
    
    print_status "Prerequisites check completed"
}

# Install dependencies
install_dependencies() {
    print_status "Installing dependencies..."
    npm install
    print_status "Dependencies installed successfully"
}

# Generate Prisma client
generate_prisma() {
    print_status "Generating Prisma client..."
    npx nx run database:prisma:generate
    print_status "Prisma client generated successfully"
}

# Start local database services
start_local_services() {
    print_status "Starting local services with Docker Compose..."
    
    if ! command -v docker-compose &> /dev/null && ! command -v docker &> /dev/null; then
        print_warning "Docker is not available. Skipping local service startup."
        print_warning "You'll need to configure external database connections."
        return
    fi
    
    # Start PostgreSQL and Redis
    docker-compose up -d
    
    # Wait for services to be ready
    print_status "Waiting for services to be ready..."
    sleep 10
    
    print_status "Local services started successfully"
}

# Run database migrations
run_migrations() {
    print_status "Running database migrations..."
    
    # Check if we can connect to the database
    if npx nx run database:prisma:migrate:status &>/dev/null; then
        npx nx run database:prisma:migrate:deploy
        print_status "Database migrations completed successfully"
    else
        print_warning "Could not connect to database. Please ensure PostgreSQL is running."
        print_warning "You can run migrations later with: npx nx run database:prisma:migrate:deploy"
    fi
}

# Build all services
build_services() {
    print_status "Building all services..."
    
    nx build dm
    nx build slack
    nx build tick
    
    print_status "All services built successfully"
}

# Show development commands
show_dev_commands() {
    print_status "Development setup completed!"
    echo ""
    print_status "Available development commands:"
    echo "  Start DM service:    nx serve dm"
    echo "  Start Slack Bot service: nx serve slack"
    echo "  Start Tick service:  nx serve tick"
    echo ""
    echo "  Run tests:           nx test <service-name>"
    echo "  Build all:           nx build --all"
    echo "  Lint all:            nx lint --all"
    echo ""
    print_status "Local services (if using Docker Compose):"
    echo "  PostgreSQL: localhost:5432"
    echo "  Redis:      localhost:6379"
    echo "  Adminer:    http://localhost:8080"
    echo ""
    print_warning "Make sure to create a .env file with your environment variables"
    print_warning "See the README.md files in each app for specific configuration"
}

# Main execution
main() {
    print_status "Starting local development setup..."
    
    check_prerequisites
    install_dependencies
    generate_prisma
    start_local_services
    run_migrations
    build_services
    show_dev_commands
}

main
