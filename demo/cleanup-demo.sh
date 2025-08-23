#!/bin/bash

# Demo Environment Cleanup Script
# Provides various cleanup options for the demo environment

set -e

DEMO_COMPOSE_FILE="docker-compose.demo.yml"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

print_header() {
    echo -e "${CYAN}=== $1 ===${NC}"
}

print_status() {
    echo -e "${BLUE}[CLEANUP]${NC} $1"
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

print_info() {
    echo -e "${CYAN}[INFO]${NC} $1"
}

# Function to confirm cleanup action
confirm_cleanup() {
    local action="$1"
    local force="$2"
    
    if [[ "$force" != "--force" ]]; then
        echo ""
        print_warning "This will $action"
        read -p "Are you sure you want to continue? (y/N): " -n 1 -r
        echo ""
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            print_status "Cleanup cancelled."
            exit 0
        fi
    fi
}

# Function to stop demo services
stop_services() {
    local force="$1"
    
    print_header "Stopping Demo Services"
    
    confirm_cleanup "stop all demo services" "$force"
    
    print_status "Stopping demo containers..."
    docker-compose -f $DEMO_COMPOSE_FILE --profile dashboard --profile init down --remove-orphans 2>/dev/null || true
    
    print_success "Demo services stopped."
    echo ""
}

# Function to clean up containers
cleanup_containers() {
    local force="$1"
    
    print_header "Cleaning Up Demo Containers"
    
    confirm_cleanup "remove all demo containers and their data" "$force"
    
    print_status "Removing demo containers and volumes..."
    docker-compose -f $DEMO_COMPOSE_FILE --profile dashboard --profile init down -v --remove-orphans 2>/dev/null || true
    
    # Clean up any orphaned containers
    local orphaned_containers=$(docker ps -a --format "{{.Names}}" | grep -E "demo" 2>/dev/null || true)
    if [[ -n "$orphaned_containers" ]]; then
        print_status "Removing orphaned demo containers..."
        echo "$orphaned_containers" | xargs docker rm -f 2>/dev/null || true
    fi
    
    print_success "Demo containers cleaned up."
    echo ""
}

# Function to clean up volumes
cleanup_volumes() {
    local force="$1"
    
    print_header "Cleaning Up Demo Volumes"
    
    confirm_cleanup "remove all demo data volumes (this will delete all demo data)" "$force"
    
    print_status "Removing demo volumes..."
    
    # Remove compose-managed volumes
    docker-compose -f $DEMO_COMPOSE_FILE --profile dashboard --profile init down -v 2>/dev/null || true
    
    # Find and remove orphaned demo volumes
    local demo_volumes=$(docker volume ls --format "{{.Name}}" | grep -E "(demo|wordpress|mysql)" 2>/dev/null || true)
    if [[ -n "$demo_volumes" ]]; then
        print_status "Removing orphaned demo volumes..."
        echo "$demo_volumes" | while read -r volume; do
            if [[ -n "$volume" ]]; then
                docker volume rm "$volume" 2>/dev/null || print_warning "Could not remove volume: $volume"
            fi
        done
    fi
    
    print_success "Demo volumes cleaned up."
    echo ""
}

# Function to clean up images
cleanup_images() {
    local force="$1"
    
    print_header "Cleaning Up Demo Images"
    
    confirm_cleanup "remove demo Docker images (this will require re-downloading)" "$force"
    
    print_status "Removing demo images..."
    
    # Get demo-related images
    local demo_images=$(docker images --format "{{.Repository}}:{{.Tag}}" | grep -E "(demo|wordpress|mysql|nginx)" || true)
    
    if [[ -n "$demo_images" ]]; then
        echo "$demo_images" | while read -r image; do
            if [[ -n "$image" && "$image" != "REPOSITORY:TAG" ]]; then
                print_status "Removing image: $image"
                docker rmi "$image" 2>/dev/null || print_warning "Could not remove image: $image"
            fi
        done
    else
        print_info "No demo images found to remove."
    fi
    
    print_success "Demo images cleanup completed."
    echo ""
}

# Function to clean up networks
cleanup_networks() {
    local force="$1"
    
    print_header "Cleaning Up Demo Networks"
    
    print_status "Removing demo networks..."
    
    # Remove compose-managed networks
    docker-compose -f $DEMO_COMPOSE_FILE --profile dashboard --profile init down --remove-orphans 2>/dev/null || true
    
    # Clean up orphaned networks
    local demo_networks=$(docker network ls --format "{{.Name}}" | grep -E "demo" 2>/dev/null || true)
    if [[ -n "$demo_networks" ]]; then
        echo "$demo_networks" | while read -r network; do
            if [[ -n "$network" && "$network" != "bridge" && "$network" != "host" && "$network" != "none" ]]; then
                print_status "Removing network: $network"
                docker network rm "$network" 2>/dev/null || print_warning "Could not remove network: $network"
            fi
        done
    fi
    
    print_success "Demo networks cleaned up."
    echo ""
}

# Function to clean up log files
cleanup_logs() {
    local force="$1"
    
    print_header "Cleaning Up Log Files"
    
    confirm_cleanup "remove all demo log files" "$force"
    
    print_status "Cleaning demo log files..."
    
    # Clean nginx logs
    if [[ -d "demo/nginx/logs" ]]; then
        rm -f demo/nginx/logs/*.log 2>/dev/null || true
        print_success "Nginx logs cleaned."
    fi
    
    # Clean mysql logs
    if [[ -d "demo/mysql/logs" ]]; then
        rm -f demo/mysql/logs/*.log 2>/dev/null || true
        print_success "MySQL logs cleaned."
    fi
    
    # Clean any other demo logs
    find demo/ -name "*.log" -type f -delete 2>/dev/null || true
    
    print_success "Log files cleaned up."
    echo ""
}

# Function to clean up temporary files
cleanup_temp_files() {
    print_header "Cleaning Up Temporary Files"
    
    print_status "Removing temporary files..."
    
    # Remove common temporary files
    find demo/ -name "*.tmp" -type f -delete 2>/dev/null || true
    find demo/ -name "*.pid" -type f -delete 2>/dev/null || true
    find demo/ -name ".DS_Store" -type f -delete 2>/dev/null || true
    
    print_success "Temporary files cleaned up."
    echo ""
}

# Function to perform system cleanup
system_cleanup() {
    local force="$1"
    
    print_header "System Cleanup"
    
    print_status "Running Docker system cleanup..."
    
    # Clean up unused Docker resources
    if [[ "$force" == "--force" ]]; then
        docker system prune -f --volumes 2>/dev/null || true
    else
        docker system prune --volumes 2>/dev/null || true
    fi
    
    print_success "Docker system cleanup completed."
    echo ""
}

# Function to show cleanup summary
show_cleanup_summary() {
    print_header "Cleanup Summary"
    
    # Check remaining demo resources
    local remaining_containers=$(docker ps -a --format "{{.Names}}" | grep -E "demo" 2>/dev/null | wc -l)
    local remaining_volumes=$(docker volume ls --format "{{.Name}}" | grep -E "(demo|wordpress|mysql)" 2>/dev/null | wc -l)
    local remaining_images=$(docker images --format "{{.Repository}}" | grep -E "(demo|wordpress|mysql|nginx)" 2>/dev/null | wc -l)
    local remaining_networks=$(docker network ls --format "{{.Name}}" | grep -E "demo" 2>/dev/null | wc -l)
    
    print_info "Remaining demo resources:"
    echo "  Containers: $remaining_containers"
    echo "  Volumes: $remaining_volumes"
    echo "  Images: $remaining_images"
    echo "  Networks: $remaining_networks"
    
    if [[ "$remaining_containers" -eq 0 && "$remaining_volumes" -eq 0 && "$remaining_networks" -eq 0 ]]; then
        print_success "Demo environment completely cleaned up!"
    else
        print_warning "Some demo resources may still exist. Run with --all --force for complete cleanup."
    fi
    
    echo ""
}

# Function to show help
show_help() {
    echo "Demo Environment Cleanup Script"
    echo ""
    echo "Usage: $0 [COMMAND] [OPTIONS]"
    echo ""
    echo "Commands:"
    echo "  stop              Stop demo services only"
    echo "  containers        Remove containers and volumes"
    echo "  volumes           Remove data volumes only"
    echo "  images            Remove Docker images"
    echo "  networks          Remove Docker networks"
    echo "  logs              Remove log files"
    echo "  temp              Remove temporary files"
    echo "  system            Run Docker system cleanup"
    echo "  all               Complete cleanup (containers, volumes, images, networks, logs)"
    echo ""
    echo "Options:"
    echo "  --force           Skip confirmation prompts"
    echo "  --help           Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 stop                    # Stop services only"
    echo "  $0 containers              # Remove containers and volumes"
    echo "  $0 all --force             # Complete cleanup without prompts"
    echo "  $0 logs                    # Clean up log files only"
}

# Main cleanup function
main_cleanup() {
    local command="${1:-help}"
    local force="${2:-}"
    
    case "$command" in
        stop)
            stop_services "$force"
            ;;
        containers)
            cleanup_containers "$force"
            ;;
        volumes)
            cleanup_volumes "$force"
            ;;
        images)
            cleanup_images "$force"
            ;;
        networks)
            cleanup_networks "$force"
            ;;
        logs)
            cleanup_logs "$force"
            ;;
        temp)
            cleanup_temp_files
            ;;
        system)
            system_cleanup "$force"
            ;;
        all)
            echo "=== Complete Demo Environment Cleanup ==="
            echo ""
            stop_services "$force"
            cleanup_containers "$force"
            cleanup_images "$force"
            cleanup_networks "$force"
            cleanup_logs "$force"
            cleanup_temp_files
            show_cleanup_summary
            ;;
        help|--help|-h)
            show_help
            ;;
        *)
            print_error "Unknown command: $command"
            show_help
            exit 1
            ;;
    esac
}

# Parse command line arguments and execute
main_cleanup "$@"
