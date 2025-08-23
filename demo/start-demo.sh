#!/bin/bash

# Demo WordPress Environment Management Script
# This script helps manage the demo WordPress environment

set -e

DEMO_COMPOSE_FILE="docker-compose.demo.yml"
DEMO_ENV_FILE="demo/.env.demo"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[DEMO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check if Docker is running
check_docker() {
    if ! docker info > /dev/null 2>&1; then
        print_error "Docker is not running. Please start Docker and try again."
        exit 1
    fi
}

# Function to check if ports are available
check_ports() {
    local ports=("8090" "3307" "3001")
    for port in "${ports[@]}"; do
        if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
            print_warning "Port $port is already in use. Demo services may conflict."
        fi
    done
}

# Function to start demo environment
start_demo() {
    print_status "Starting demo WordPress environment..."
    
    check_docker
    check_ports
    
    # Start core services
    print_status "Starting MySQL, WordPress, and Nginx..."
    docker-compose -f $DEMO_COMPOSE_FILE up -d demo-mysql demo-wordpress demo-nginx
    
    # Wait for services to be healthy
    print_status "Waiting for services to be ready..."
    docker-compose -f $DEMO_COMPOSE_FILE exec demo-mysql mysqladmin ping -h localhost -u demo_user -pdemo_password --wait=30
    
    # Run data generator
    print_status "Generating demo data..."
    docker-compose -f $DEMO_COMPOSE_FILE --profile init up demo-data-generator
    
    # Optionally start demo dashboard
    if [[ "$1" == "--with-dashboard" ]]; then
        print_status "Starting demo dashboard..."
        docker-compose -f $DEMO_COMPOSE_FILE --profile dashboard up -d demo-dashboard
    fi
    
    print_success "Demo environment is ready!"
    print_status "WordPress: http://localhost:8090"
    print_status "MySQL: localhost:3307"
    if [[ "$1" == "--with-dashboard" ]]; then
        print_status "Dashboard: http://localhost:3001"
    fi
}

# Function to stop demo environment
stop_demo() {
    print_status "Stopping demo WordPress environment..."
    docker-compose -f $DEMO_COMPOSE_FILE --profile dashboard --profile init down
    print_success "Demo environment stopped."
}

# Function to reset demo environment
reset_demo() {
    print_status "Resetting demo WordPress environment..."
    docker-compose -f $DEMO_COMPOSE_FILE --profile dashboard --profile init down -v
    print_status "Removed all demo data volumes."
    start_demo "$@"
}

# Function to show demo status
status_demo() {
    print_status "Demo environment status:"
    docker-compose -f $DEMO_COMPOSE_FILE ps
}

# Function to show logs
logs_demo() {
    local service=${1:-""}
    if [[ -n "$service" ]]; then
        docker-compose -f $DEMO_COMPOSE_FILE logs -f "$service"
    else
        docker-compose -f $DEMO_COMPOSE_FILE logs -f
    fi
}

# Function to show help
show_help() {
    echo "Demo WordPress Environment Management"
    echo ""
    echo "Usage: $0 [COMMAND] [OPTIONS]"
    echo ""
    echo "Commands:"
    echo "  start [--with-dashboard]  Start the demo environment"
    echo "  stop                      Stop the demo environment"
    echo "  reset [--with-dashboard]  Reset and restart the demo environment"
    echo "  status                    Show status of demo services"
    echo "  logs [service]            Show logs (optionally for specific service)"
    echo "  help                      Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 start                  # Start demo WordPress only"
    echo "  $0 start --with-dashboard # Start demo with dashboard"
    echo "  $0 logs demo-mysql        # Show MySQL logs"
    echo "  $0 reset --with-dashboard # Reset everything and start with dashboard"
}

# Main script logic
case "${1:-help}" in
    start)
        start_demo "$2"
        ;;
    stop)
        stop_demo
        ;;
    reset)
        reset_demo "$2"
        ;;
    status)
        status_demo
        ;;
    logs)
        logs_demo "$2"
        ;;
    help|--help|-h)
        show_help
        ;;
    *)
        print_error "Unknown command: $1"
        show_help
        exit 1
        ;;
esac
