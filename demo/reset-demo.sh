#!/bin/bash

# Demo Environment Reset Script
# Completely resets the demo environment to its original state

set -e

DEMO_COMPOSE_FILE="docker-compose.demo.yml"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${BLUE}[RESET]${NC} $1"
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

# Function to confirm reset action
confirm_reset() {
    if [[ "$1" != "--force" ]]; then
        echo ""
        print_warning "This will completely reset the demo environment and remove all data!"
        read -p "Are you sure you want to continue? (y/N): " -n 1 -r
        echo ""
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            print_status "Reset cancelled."
            exit 0
        fi
    fi
}

# Function to stop all demo services
stop_services() {
    print_status "Stopping all demo services..."
    
    # Stop all profiles to ensure everything is stopped
    docker-compose -f $DEMO_COMPOSE_FILE --profile dashboard --profile init down --remove-orphans 2>/dev/null || true
    
    print_success "All demo services stopped."
}

# Function to remove volumes and data
remove_data() {
    print_status "Removing demo data volumes..."
    
    # Remove volumes with force to ensure cleanup
    docker-compose -f $DEMO_COMPOSE_FILE --profile dashboard --profile init down -v --remove-orphans 2>/dev/null || true
    
    # Remove any orphaned volumes that might be left
    local demo_volumes=$(docker volume ls -q | grep -E "(demo|wordpress|mysql)" 2>/dev/null || true)
    if [[ -n "$demo_volumes" ]]; then
        print_status "Removing orphaned demo volumes..."
        echo "$demo_volumes" | xargs docker volume rm 2>/dev/null || true
    fi
    
    print_success "Demo data volumes removed."
}

# Function to remove demo images
remove_images() {
    if [[ "$1" == "--remove-images" ]]; then
        print_status "Removing demo Docker images..."
        
        # Get demo-related images
        local demo_images=$(docker images --format "table {{.Repository}}:{{.Tag}}" | grep -E "(demo|wordpress|mysql|nginx)" | grep -v "REPOSITORY" || true)
        
        if [[ -n "$demo_images" ]]; then
            echo "$demo_images" | while read -r image; do
                if [[ -n "$image" ]]; then
                    print_status "Removing image: $image"
                    docker rmi "$image" 2>/dev/null || print_warning "Could not remove image: $image"
                fi
            done
        fi
        
        print_success "Demo images cleanup completed."
    fi
}

# Function to clean up log files
cleanup_logs() {
    print_status "Cleaning up demo log files..."
    
    # Clean nginx logs
    if [[ -d "demo/nginx/logs" ]]; then
        rm -f demo/nginx/logs/*.log 2>/dev/null || true
    fi
    
    # Clean mysql logs
    if [[ -d "demo/mysql/logs" ]]; then
        rm -f demo/mysql/logs/*.log 2>/dev/null || true
    fi
    
    print_success "Log files cleaned up."
}

# Function to reset file permissions
reset_permissions() {
    print_status "Resetting file permissions..."
    
    # Ensure scripts are executable
    chmod +x demo/*.sh 2>/dev/null || true
    
    # Reset log directory permissions
    if [[ -d "demo/nginx/logs" ]]; then
        chmod 755 demo/nginx/logs
    fi
    
    if [[ -d "demo/mysql/logs" ]]; then
        chmod 755 demo/mysql/logs
    fi
    
    print_success "File permissions reset."
}

# Function to verify reset completion
verify_reset() {
    print_status "Verifying reset completion..."
    
    # Check if any demo containers are still running
    local running_containers=$(docker ps --format "table {{.Names}}" | grep -E "demo" || true)
    if [[ -n "$running_containers" ]]; then
        print_warning "Some demo containers are still running:"
        echo "$running_containers"
    else
        print_success "No demo containers running."
    fi
    
    # Check for demo volumes
    local remaining_volumes=$(docker volume ls -q | grep -E "(demo|wordpress|mysql)" 2>/dev/null || true)
    if [[ -n "$remaining_volumes" ]]; then
        print_warning "Some demo volumes still exist:"
        echo "$remaining_volumes"
    else
        print_success "No demo volumes remaining."
    fi
}

# Function to show help
show_help() {
    echo "Demo Environment Reset Script"
    echo ""
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  --force           Skip confirmation prompt"
    echo "  --remove-images   Also remove Docker images (not just containers/volumes)"
    echo "  --help           Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0                # Interactive reset (with confirmation)"
    echo "  $0 --force        # Reset without confirmation"
    echo "  $0 --force --remove-images  # Full reset including images"
}

# Main reset function
main_reset() {
    echo "=== Demo Environment Reset ==="
    echo ""
    
    confirm_reset "$@"
    
    stop_services
    remove_data
    remove_images "$@"
    cleanup_logs
    reset_permissions
    verify_reset
    
    echo ""
    print_success "Demo environment has been completely reset!"
    echo ""
    print_status "To start fresh, run: ./demo/start-demo.sh start"
}

# Parse command line arguments
case "${1:-}" in
    --help|-h)
        show_help
        exit 0
        ;;
    *)
        main_reset "$@"
        ;;
esac
