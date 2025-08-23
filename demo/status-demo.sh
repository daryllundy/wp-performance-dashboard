#!/bin/bash

# Demo Environment Status and Health Check Script
# Provides detailed status information about the demo environment

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
    echo -e "${BLUE}[STATUS]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[✓]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[!]${NC} $1"
}

print_error() {
    echo -e "${RED}[✗]${NC} $1"
}

print_info() {
    echo -e "${CYAN}[INFO]${NC} $1"
}

# Function to check Docker availability
check_docker() {
    print_header "Docker Environment"
    
    if command -v docker > /dev/null 2>&1; then
        print_success "Docker CLI available"
        
        if docker info > /dev/null 2>&1; then
            print_success "Docker daemon running"
            
            # Show Docker version
            local docker_version=$(docker --version | cut -d' ' -f3 | cut -d',' -f1)
            print_info "Docker version: $docker_version"
        else
            print_error "Docker daemon not running"
            return 1
        fi
    else
        print_error "Docker CLI not found"
        return 1
    fi
    
    if command -v docker-compose > /dev/null 2>&1; then
        print_success "Docker Compose available"
        local compose_version=$(docker-compose --version | cut -d' ' -f3 | cut -d',' -f1)
        print_info "Docker Compose version: $compose_version"
    else
        print_error "Docker Compose not found"
        return 1
    fi
    
    echo ""
}

# Function to check service status
check_services() {
    print_header "Demo Services Status"
    
    # Check if compose file exists
    if [[ ! -f "$DEMO_COMPOSE_FILE" ]]; then
        print_error "Docker Compose file not found: $DEMO_COMPOSE_FILE"
        return 1
    fi
    
    # Get service status
    local services_output=$(docker-compose -f $DEMO_COMPOSE_FILE ps --format "table {{.Name}}\t{{.State}}\t{{.Ports}}" 2>/dev/null || echo "")
    
    if [[ -z "$services_output" ]]; then
        print_warning "No demo services are currently running"
        echo ""
        return 0
    fi
    
    echo "$services_output"
    echo ""
    
    # Check individual service health
    check_service_health "demo-mysql" "MySQL Database"
    check_service_health "demo-wordpress" "WordPress Application"
    check_service_health "demo-nginx" "Nginx Proxy"
    check_service_health "demo-dashboard" "Performance Dashboard"
    
    echo ""
}

# Function to check individual service health
check_service_health() {
    local service_name="$1"
    local service_description="$2"
    
    print_status "Checking $service_description..."
    
    # Check if container is running
    if docker-compose -f $DEMO_COMPOSE_FILE ps -q "$service_name" > /dev/null 2>&1; then
        local container_id=$(docker-compose -f $DEMO_COMPOSE_FILE ps -q "$service_name")
        
        if [[ -n "$container_id" ]]; then
            local container_status=$(docker inspect --format='{{.State.Status}}' "$container_id" 2>/dev/null || echo "unknown")
            
            case "$container_status" in
                "running")
                    print_success "$service_description is running"
                    
                    # Additional health checks based on service type
                    case "$service_name" in
                        "demo-mysql")
                            check_mysql_health "$container_id"
                            ;;
                        "demo-wordpress")
                            check_wordpress_health
                            ;;
                        "demo-nginx")
                            check_nginx_health
                            ;;
                        "demo-dashboard")
                            check_dashboard_health
                            ;;
                    esac
                    ;;
                "exited")
                    print_error "$service_description has exited"
                    ;;
                *)
                    print_warning "$service_description status: $container_status"
                    ;;
            esac
        else
            print_warning "$service_description container not found"
        fi
    else
        print_warning "$service_description is not running"
    fi
}

# Function to check MySQL health
check_mysql_health() {
    local container_id="$1"
    
    # Test MySQL connection
    if docker exec "$container_id" mysqladmin ping -h localhost -u demo_user -pdemo_password --silent 2>/dev/null; then
        print_success "  MySQL connection successful"
        
        # Check database exists
        local db_exists=$(docker exec "$container_id" mysql -u demo_user -pdemo_password -e "SHOW DATABASES LIKE 'demo_wordpress';" --silent 2>/dev/null | wc -l)
        if [[ "$db_exists" -gt 0 ]]; then
            print_success "  Demo database exists"
        else
            print_warning "  Demo database not found"
        fi
    else
        print_error "  MySQL connection failed"
    fi
}

# Function to check WordPress health
check_wordpress_health() {
    # Test WordPress HTTP response
    if curl -s -o /dev/null -w "%{http_code}" http://localhost:8090 2>/dev/null | grep -q "200\|302"; then
        print_success "  WordPress HTTP response OK"
    else
        print_warning "  WordPress not responding on port 8090"
    fi
}

# Function to check Nginx health
check_nginx_health() {
    # Test Nginx HTTP response
    if curl -s -o /dev/null -w "%{http_code}" http://localhost:8090 2>/dev/null | grep -q "200\|302"; then
        print_success "  Nginx proxy responding"
    else
        print_warning "  Nginx proxy not responding on port 8090"
    fi
}

# Function to check Dashboard health
check_dashboard_health() {
    # Test Dashboard HTTP response
    if curl -s -o /dev/null -w "%{http_code}" http://localhost:3001 2>/dev/null | grep -q "200"; then
        print_success "  Dashboard responding on port 3001"
    else
        print_warning "  Dashboard not responding on port 3001"
    fi
}

# Function to check port availability
check_ports() {
    print_header "Port Status"
    
    local ports=("8090:Nginx/WordPress" "3307:MySQL" "3001:Dashboard")
    
    for port_info in "${ports[@]}"; do
        local port=$(echo "$port_info" | cut -d':' -f1)
        local service=$(echo "$port_info" | cut -d':' -f2)
        
        if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
            local process=$(lsof -Pi :$port -sTCP:LISTEN -t | head -1)
            local process_name=$(ps -p $process -o comm= 2>/dev/null || echo "unknown")
            print_success "Port $port ($service) - in use by $process_name"
        else
            print_warning "Port $port ($service) - available"
        fi
    done
    
    echo ""
}

# Function to show resource usage
check_resources() {
    print_header "Resource Usage"
    
    # Get demo container resource usage
    local demo_containers=$(docker-compose -f $DEMO_COMPOSE_FILE ps -q 2>/dev/null || echo "")
    
    if [[ -n "$demo_containers" ]]; then
        echo "Container Resource Usage:"
        docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}" $demo_containers 2>/dev/null || print_warning "Could not retrieve resource stats"
    else
        print_warning "No demo containers running"
    fi
    
    echo ""
}

# Function to show recent logs
show_recent_logs() {
    print_header "Recent Service Logs"
    
    local services=("demo-mysql" "demo-wordpress" "demo-nginx")
    
    for service in "${services[@]}"; do
        if docker-compose -f $DEMO_COMPOSE_FILE ps -q "$service" > /dev/null 2>&1; then
            echo "--- $service (last 5 lines) ---"
            docker-compose -f $DEMO_COMPOSE_FILE logs --tail=5 "$service" 2>/dev/null || print_warning "Could not retrieve logs for $service"
            echo ""
        fi
    done
}

# Function to show connectivity info
show_connectivity() {
    print_header "Connectivity Information"
    
    print_info "Demo Environment URLs:"
    echo "  WordPress Frontend: http://localhost:8090"
    echo "  WordPress Admin:    http://localhost:8090/wp-admin"
    echo "  MySQL Database:     localhost:3307"
    echo "  Performance Dashboard: http://localhost:3001"
    echo ""
    
    print_info "Demo Credentials:"
    echo "  WordPress Admin: admin / demo_password"
    echo "  MySQL User:      demo_user / demo_password"
    echo "  MySQL Database:  demo_wordpress"
    echo ""
}

# Function to show help
show_help() {
    echo "Demo Environment Status Script"
    echo ""
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  --quick          Show only basic service status"
    echo "  --detailed       Show detailed health checks and logs"
    echo "  --resources      Show resource usage information"
    echo "  --help          Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0               # Standard status check"
    echo "  $0 --detailed    # Detailed status with logs"
    echo "  $0 --quick       # Quick status overview"
}

# Main status function
main_status() {
    local mode="${1:-standard}"
    
    echo "=== Demo Environment Status Check ==="
    echo ""
    
    # Always check Docker and basic services
    if ! check_docker; then
        exit 1
    fi
    
    check_services
    
    case "$mode" in
        "--quick")
            check_ports
            ;;
        "--detailed")
            check_ports
            check_resources
            show_recent_logs
            show_connectivity
            ;;
        "--resources")
            check_resources
            ;;
        *)
            check_ports
            show_connectivity
            ;;
    esac
    
    echo ""
    print_info "For more options, run: $0 --help"
}

# Parse command line arguments
case "${1:-}" in
    --help|-h)
        show_help
        exit 0
        ;;
    *)
        main_status "$@"
        ;;
esac
