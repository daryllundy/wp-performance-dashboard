#!/bin/bash

# Demo Environment Management Wrapper Script
# Provides a unified interface for all demo management operations

set -e

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
    echo -e "${BLUE}[DEMO-MGR]${NC} $1"
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

# Function to check if we're in the right directory
check_directory() {
    if [[ ! -f "docker-compose.demo.yml" ]]; then
        print_error "This script must be run from the project root directory"
        print_info "Current directory: $(pwd)"
        print_info "Expected files: docker-compose.demo.yml"
        exit 1
    fi
}

# Function to check script availability
check_scripts() {
    local scripts=(
        "demo/start-demo.sh"
        "demo/status-demo.sh"
        "demo/reset-demo.sh"
        "demo/cleanup-demo.sh"
        "demo/validate-demo-setup.sh"
    )
    
    for script in "${scripts[@]}"; do
        if [[ ! -f "$script" ]]; then
            print_error "Required script missing: $script"
            exit 1
        fi
        
        if [[ ! -x "$script" ]]; then
            print_warning "Making script executable: $script"
            chmod +x "$script"
        fi
    done
}

# Function to show demo environment overview
show_overview() {
    print_header "Demo Environment Overview"
    
    print_info "Available Commands:"
    echo "  setup     - Initial setup and validation"
    echo "  start     - Start demo environment"
    echo "  stop      - Stop demo services"
    echo "  restart   - Restart demo environment"
    echo "  status    - Check service status and health"
    echo "  reset     - Reset environment to clean state"
    echo "  cleanup   - Clean up resources"
    echo "  logs      - View service logs"
    echo "  validate  - Validate demo setup"
    echo ""
    
    print_info "Demo Environment Components:"
    echo "  • MySQL Database (port 3307)"
    echo "  • WordPress Application"
    echo "  • Nginx Reverse Proxy (port 8090)"
    echo "  • Performance Dashboard (port 3001, optional)"
    echo "  • Demo Data Generator"
    echo ""
    
    print_info "Quick Start:"
    echo "  1. $0 setup              # Initial setup"
    echo "  2. $0 start              # Start WordPress demo"
    echo "  3. $0 start --dashboard  # Start with dashboard"
    echo "  4. $0 status             # Check everything is working"
    echo ""
}

# Function to perform initial setup
setup_demo() {
    print_header "Demo Environment Setup"
    
    print_status "Performing initial demo setup..."
    
    # Run validation
    print_status "Running setup validation..."
    if ./demo/validate-demo-setup.sh; then
        print_success "Demo setup validation passed"
    else
        print_error "Demo setup validation failed"
        exit 1
    fi
    
    # Create required directories
    print_status "Creating required directories..."
    mkdir -p demo/nginx/logs demo/mysql/logs
    
    # Set proper permissions
    print_status "Setting file permissions..."
    chmod +x demo/*.sh
    
    print_success "Demo environment setup completed!"
    echo ""
    print_info "Next steps:"
    echo "  • Run '$0 start' to start the demo environment"
    echo "  • Run '$0 start --dashboard' to include the performance dashboard"
}

# Function to start demo
start_demo() {
    print_header "Starting Demo Environment"
    
    local args="$*"
    if [[ "$args" == *"--dashboard"* || "$args" == *"--with-dashboard"* ]]; then
        ./demo/start-demo.sh start --with-dashboard
    else
        ./demo/start-demo.sh start
    fi
}

# Function to stop demo
stop_demo() {
    print_header "Stopping Demo Environment"
    
    ./demo/start-demo.sh stop
}

# Function to restart demo
restart_demo() {
    print_header "Restarting Demo Environment"
    
    print_status "Stopping demo environment..."
    ./demo/start-demo.sh stop
    
    sleep 2
    
    print_status "Starting demo environment..."
    local args="$*"
    if [[ "$args" == *"--dashboard"* || "$args" == *"--with-dashboard"* ]]; then
        ./demo/start-demo.sh start --with-dashboard
    else
        ./demo/start-demo.sh start
    fi
}

# Function to show status
show_status() {
    print_header "Demo Environment Status"
    
    local mode="$1"
    case "$mode" in
        --quick)
            ./demo/status-demo.sh --quick
            ;;
        --detailed)
            ./demo/status-demo.sh --detailed
            ;;
        *)
            ./demo/status-demo.sh
            ;;
    esac
}

# Function to reset demo
reset_demo() {
    print_header "Resetting Demo Environment"
    
    local force=""
    if [[ "$1" == "--force" ]]; then
        force="--force"
    fi
    
    ./demo/reset-demo.sh $force
}

# Function to cleanup demo
cleanup_demo() {
    print_header "Cleaning Up Demo Environment"
    
    local command="${1:-containers}"
    local force=""
    if [[ "$2" == "--force" ]]; then
        force="--force"
    fi
    
    ./demo/cleanup-demo.sh "$command" $force
}

# Function to show logs
show_logs() {
    print_header "Demo Environment Logs"
    
    local service="$1"
    ./demo/start-demo.sh logs "$service"
}

# Function to validate setup
validate_setup() {
    print_header "Validating Demo Setup"
    
    ./demo/validate-demo-setup.sh
}

# Function to show help
show_help() {
    echo "Demo Environment Management Script"
    echo ""
    echo "Usage: $0 [COMMAND] [OPTIONS]"
    echo ""
    echo "Commands:"
    echo "  overview              Show demo environment overview"
    echo "  setup                 Perform initial demo setup"
    echo "  start [--dashboard]   Start demo environment (optionally with dashboard)"
    echo "  stop                  Stop demo services"
    echo "  restart [--dashboard] Restart demo environment"
    echo "  status [--quick|--detailed] Show service status"
    echo "  reset [--force]       Reset environment to clean state"
    echo "  cleanup [TYPE] [--force] Clean up resources"
    echo "  logs [SERVICE]        Show service logs"
    echo "  validate              Validate demo setup"
    echo "  help                  Show this help message"
    echo ""
    echo "Cleanup Types:"
    echo "  containers            Remove containers and volumes (default)"
    echo "  volumes               Remove data volumes only"
    echo "  images                Remove Docker images"
    echo "  all                   Complete cleanup"
    echo ""
    echo "Examples:"
    echo "  $0 setup                      # Initial setup"
    echo "  $0 start --dashboard          # Start with dashboard"
    echo "  $0 status --detailed          # Detailed status check"
    echo "  $0 cleanup all --force        # Complete cleanup without prompts"
    echo "  $0 logs demo-mysql            # Show MySQL logs"
    echo ""
    echo "Quick Commands:"
    echo "  $0 overview                   # Show overview and quick start guide"
}

# Main function
main() {
    local command="${1:-overview}"
    
    # Check directory and scripts
    check_directory
    check_scripts
    
    case "$command" in
        overview)
            show_overview
            ;;
        setup)
            setup_demo
            ;;
        start)
            shift
            start_demo "$@"
            ;;
        stop)
            stop_demo
            ;;
        restart)
            shift
            restart_demo "$@"
            ;;
        status)
            shift
            show_status "$@"
            ;;
        reset)
            shift
            reset_demo "$@"
            ;;
        cleanup)
            shift
            cleanup_demo "$@"
            ;;
        logs)
            shift
            show_logs "$@"
            ;;
        validate)
            validate_setup
            ;;
        help|--help|-h)
            show_help
            ;;
        *)
            print_error "Unknown command: $command"
            echo ""
            show_help
            exit 1
            ;;
    esac
}

# Execute main function with all arguments
main "$@"
