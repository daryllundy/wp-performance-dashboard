#!/bin/bash

# Demo Environment Validation Script
# Checks that all required files and configurations are in place

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_check() {
    echo -e "${BLUE}[CHECK]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[✓]${NC} $1"
}

print_error() {
    echo -e "${RED}[✗]${NC} $1"
}

# Track validation status
VALIDATION_PASSED=true

# Function to check if file exists
check_file() {
    local file="$1"
    local description="$2"
    
    print_check "Checking $description..."
    if [[ -f "$file" ]]; then
        print_success "$file exists"
    else
        print_error "$file is missing"
        VALIDATION_PASSED=false
    fi
}

# Function to check if directory exists
check_directory() {
    local dir="$1"
    local description="$2"
    
    print_check "Checking $description..."
    if [[ -d "$dir" ]]; then
        print_success "$dir exists"
    else
        print_error "$dir is missing"
        VALIDATION_PASSED=false
    fi
}

echo "=== Demo Environment Validation ==="
echo ""

# Check main configuration files
check_file "docker-compose.demo.yml" "Docker Compose configuration"
check_file "demo/.env.demo" "Demo environment variables"
check_file "demo/start-demo.sh" "Demo management script"

# Check Nginx configuration
check_directory "demo/nginx" "Nginx configuration directory"
check_file "demo/nginx/nginx.conf" "Nginx configuration file"
check_directory "demo/nginx/logs" "Nginx logs directory"

# Check MySQL configuration
check_directory "demo/mysql" "MySQL configuration directory"
check_file "demo/mysql/init.sql" "MySQL initialization script"
check_file "demo/mysql/my.cnf" "MySQL configuration file"
check_directory "demo/mysql/logs" "MySQL logs directory"

# Check WordPress configuration
check_directory "demo/wordpress" "WordPress configuration directory"
check_file "demo/wordpress/wp-config-demo.php" "WordPress demo configuration"

# Check data generator
check_directory "demo/data-generator" "Data generator directory"
check_file "demo/data-generator/Dockerfile" "Data generator Dockerfile"
check_directory "demo/scripts" "Demo scripts directory"

# Check Docker Compose syntax
print_check "Validating Docker Compose syntax..."
if docker-compose -f docker-compose.demo.yml config --quiet > /dev/null 2>&1; then
    print_success "Docker Compose configuration is valid"
else
    print_error "Docker Compose configuration has syntax errors"
    VALIDATION_PASSED=false
fi

# Check if Docker is available
print_check "Checking Docker availability..."
if command -v docker > /dev/null 2>&1; then
    if docker info > /dev/null 2>&1; then
        print_success "Docker is available and running"
    else
        print_error "Docker is installed but not running"
        VALIDATION_PASSED=false
    fi
else
    print_error "Docker is not installed"
    VALIDATION_PASSED=false
fi

# Check if docker-compose is available
print_check "Checking Docker Compose availability..."
if command -v docker-compose > /dev/null 2>&1; then
    print_success "Docker Compose is available"
else
    print_error "Docker Compose is not installed"
    VALIDATION_PASSED=false
fi

echo ""
echo "=== Validation Summary ==="
if [[ "$VALIDATION_PASSED" == true ]]; then
    print_success "All validation checks passed! Demo environment is ready to use."
    echo ""
    echo "To start the demo environment, run:"
    echo "  ./demo/start-demo.sh start"
    exit 0
else
    print_error "Some validation checks failed. Please fix the issues above."
    exit 1
fi
