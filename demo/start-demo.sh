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

# Function to validate demo setup
validate_demo_setup() {
    print_status "Validating demo setup..."
    
    # Check required files
    local required_files=(
        "$DEMO_COMPOSE_FILE"
        "demo/.env.demo"
        "demo/nginx/nginx.conf"
        "demo/mysql/init.sql"
        "demo/mysql/my.cnf"
        "demo/wordpress/wp-config-demo.php"
    )
    
    for file in "${required_files[@]}"; do
        if [[ ! -f "$file" ]]; then
            print_error "Required file missing: $file"
            return 1
        fi
    done
    
    # Check required directories
    local required_dirs=(
        "demo/nginx/logs"
        "demo/mysql/logs"
        "demo/scripts"
    )
    
    for dir in "${required_dirs[@]}"; do
        if [[ ! -d "$dir" ]]; then
            print_warning "Creating missing directory: $dir"
            mkdir -p "$dir"
        fi
    done
    
    # Validate Docker Compose syntax
    if ! docker-compose -f $DEMO_COMPOSE_FILE config --quiet > /dev/null 2>&1; then
        print_error "Docker Compose configuration has syntax errors"
        return 1
    fi
    
    print_success "Demo setup validation passed"
    return 0
}

# Function to start demo environment
start_demo() {
    print_status "Starting demo WordPress environment..."
    
    check_docker
    check_ports
    
    # Validate demo setup first
    if ! validate_demo_setup; then
        print_error "Demo setup validation failed. Please run ./demo/validate-demo-setup.sh for details."
        exit 1
    fi
    
    # Start core services in order
    print_status "Starting MySQL database..."
    docker-compose -f $DEMO_COMPOSE_FILE up -d demo-mysql
    
    # Wait for MySQL to be ready
    print_status "Waiting for MySQL to be ready..."
    local mysql_ready=false
    local attempts=0
    local max_attempts=30
    
    while [[ "$mysql_ready" == false && "$attempts" -lt "$max_attempts" ]]; do
        if docker-compose -f $DEMO_COMPOSE_FILE exec -T demo-mysql mysqladmin ping -h localhost -u demo_user -pdemo_password --silent 2>/dev/null; then
            mysql_ready=true
            print_success "MySQL is ready!"
        else
            print_status "Waiting for MySQL... (attempt $((attempts + 1))/$max_attempts)"
            sleep 2
            ((attempts++))
        fi
    done
    
    if [[ "$mysql_ready" == false ]]; then
        print_error "MySQL failed to start within expected time"
        exit 1
    fi
    
    # Start WordPress
    print_status "Starting WordPress application..."
    docker-compose -f $DEMO_COMPOSE_FILE up -d demo-wordpress
    
    # Wait for WordPress to be ready
    print_status "Waiting for WordPress to be ready..."
    local wp_ready=false
    local wp_attempts=0
    local wp_max_attempts=20
    
    while [[ "$wp_ready" == false && "$wp_attempts" -lt "$wp_max_attempts" ]]; do
        if curl -s -o /dev/null -w "%{http_code}" http://localhost:8090 2>/dev/null | grep -q "200\|302"; then
            wp_ready=true
            print_success "WordPress is ready!"
        else
            print_status "Waiting for WordPress... (attempt $((wp_attempts + 1))/$wp_max_attempts)"
            sleep 3
            ((wp_attempts++))
        fi
    done
    
    # Start Nginx proxy
    print_status "Starting Nginx proxy..."
    docker-compose -f $DEMO_COMPOSE_FILE up -d demo-nginx
    
    # Generate demo data if not already present
    print_status "Checking demo data..."
    local data_exists=$(docker-compose -f $DEMO_COMPOSE_FILE exec -T demo-mysql mysql -u demo_user -pdemo_password -e "SELECT COUNT(*) FROM demo_wordpress.wp_posts WHERE post_status='publish';" --silent 2>/dev/null | tail -1 || echo "0")
    
    if [[ "$data_exists" -lt 5 ]]; then
        print_status "Generating demo data..."
        docker-compose -f $DEMO_COMPOSE_FILE --profile init up demo-data-generator
        
        # Wait for data generation to complete
        print_status "Waiting for data generation to complete..."
        sleep 5
    else
        print_success "Demo data already exists (found $data_exists posts)"
    fi
    
    # Optionally start demo dashboard
    if [[ "$1" == "--with-dashboard" ]]; then
        print_status "Starting demo dashboard..."
        docker-compose -f $DEMO_COMPOSE_FILE --profile dashboard up -d demo-dashboard
        
        # Wait for dashboard to be ready
        local dashboard_ready=false
        local dash_attempts=0
        local dash_max_attempts=10
        
        while [[ "$dashboard_ready" == false && "$dash_attempts" -lt "$dash_max_attempts" ]]; do
            if curl -s -o /dev/null -w "%{http_code}" http://localhost:3001 2>/dev/null | grep -q "200"; then
                dashboard_ready=true
                print_success "Dashboard is ready!"
            else
                print_status "Waiting for dashboard... (attempt $((dash_attempts + 1))/$dash_max_attempts)"
                sleep 2
                ((dash_attempts++))
            fi
        done
    fi
    
    # Final health check
    print_status "Performing final health check..."
    sleep 2
    
    print_success "Demo environment is ready!"
    echo ""
    print_status "Access URLs:"
    print_status "  WordPress Frontend: http://localhost:8090"
    print_status "  WordPress Admin:    http://localhost:8090/wp-admin (admin/demo_password)"
    print_status "  MySQL Database:     localhost:3307 (demo_user/demo_password)"
    if [[ "$1" == "--with-dashboard" ]]; then
        print_status "  Performance Dashboard: http://localhost:3001"
    fi
    echo ""
    print_status "Use './demo/status-demo.sh' to check service health"
    print_status "Use './demo/cleanup-demo.sh stop' to stop services"
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
