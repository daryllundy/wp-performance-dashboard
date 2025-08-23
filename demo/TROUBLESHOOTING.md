# Demo Environment Troubleshooting Guide

This comprehensive guide covers common issues, diagnostic procedures, and solutions for the WordPress Performance Dashboard demo environment.

## Quick Diagnostic Commands

```bash
# Complete health check
./demo/status-demo.sh --detailed

# Validate setup
./demo/validate-demo-setup.sh

# Check Docker status
docker info && docker-compose -f docker-compose.demo.yml ps

# View all logs
./demo/start-demo.sh logs
```

## Common Issues and Solutions

### 1. Port Conflicts

#### Symptoms
- Services fail to start
- "Port already in use" errors
- Connection refused errors

#### Diagnosis
```bash
# Check which ports are in use
lsof -i :8090  # Nginx/WordPress
lsof -i :3307  # MySQL
lsof -i :3001  # Dashboard

# Check Docker port mappings
docker ps --format "table {{.Names}}\t{{.Ports}}"
```

#### Solutions
```bash
# Option 1: Stop conflicting services
sudo lsof -ti:8090 | xargs kill -9

# Option 2: Modify ports in docker-compose.demo.yml
# Change port mappings to available ports

# Option 3: Use different port configuration
# Edit docker-compose.demo.yml and update port mappings
```

### 2. Docker Issues

#### Docker Daemon Not Running
```bash
# Check Docker status
docker info

# Start Docker (varies by system)
# macOS: Start Docker Desktop
# Linux: sudo systemctl start docker
# Windows: Start Docker Desktop
```

#### Insufficient Resources
```bash
# Check Docker resource usage
docker stats

# Clean up unused resources
docker system prune -f --volumes

# Increase Docker memory allocation (Docker Desktop)
# Settings > Resources > Memory (recommend 4GB+)
```

#### Permission Issues (Linux)
```bash
# Add user to docker group
sudo usermod -aG docker $USER
newgrp docker

# Or run with sudo (not recommended)
sudo ./demo/start-demo.sh start
```

### 3. Service Startup Issues

#### MySQL Won't Start
```bash
# Check MySQL logs
./demo/start-demo.sh logs demo-mysql

# Common issues and solutions:
# 1. Data directory permissions
docker-compose -f docker-compose.demo.yml down -v
./demo/start-demo.sh start

# 2. Port conflict (see Port Conflicts section)

# 3. Insufficient memory
# Increase Docker memory allocation
```

#### WordPress Initialization Fails
```bash
# Check WordPress logs
./demo/start-demo.sh logs demo-wordpress

# Wait for MySQL to be ready (can take 60+ seconds)
./demo/status-demo.sh

# Check if WordPress is installed
docker-compose -f docker-compose.demo.yml exec demo-wordpress wp core is-installed

# Reinstall WordPress if needed
docker-compose -f docker-compose.demo.yml exec demo-wordpress wp core install \
  --url=http://localhost:8090 \
  --title="Demo WordPress" \
  --admin_user=admin \
  --admin_password=demo_password \
  --admin_email=admin@demo.local
```

#### Nginx Proxy Issues
```bash
# Check Nginx configuration
./demo/start-demo.sh logs demo-nginx

# Test Nginx config
docker-compose -f docker-compose.demo.yml exec demo-nginx nginx -t

# Restart Nginx
docker-compose -f docker-compose.demo.yml restart demo-nginx
```

### 4. Data Generation Issues

#### Demo Data Not Generated
```bash
# Check data generator logs
./demo/start-demo.sh logs demo-data-generator

# Manually run data generator
docker-compose -f docker-compose.demo.yml --profile init up demo-data-generator

# Check if data exists
mysql -h localhost -P 3307 -u demo_user -pdemo_password -e "
  USE demo_wordpress; 
  SELECT COUNT(*) as posts FROM wp_posts WHERE post_status='publish';
  SELECT COUNT(*) as performance_logs FROM wp_performance_logs;
"
```

#### Incomplete Data Generation
```bash
# Reset and regenerate all data
./demo/reset-demo.sh --force

# Or regenerate specific data types
docker-compose -f docker-compose.demo.yml exec demo-mysql mysql -u demo_user -pdemo_password demo_wordpress < demo/mysql/generate-performance-data.sql
```

### 5. Performance Dashboard Issues

#### Dashboard Not Connecting to Database
```bash
# Test database connection
mysql -h localhost -P 3307 -u demo_user -pdemo_password demo_wordpress -e "SELECT 1;"

# Check dashboard logs
./demo/start-demo.sh logs demo-dashboard

# Verify environment variables
docker-compose -f docker-compose.demo.yml exec demo-dashboard env | grep DB_
```

#### No Performance Data Showing
```bash
# Check if performance tables exist
mysql -h localhost -P 3307 -u demo_user -pdemo_password -e "
  USE demo_wordpress;
  SHOW TABLES LIKE 'wp_%performance%';
  SHOW TABLES LIKE 'wp_ajax%';
"

# Check table contents
mysql -h localhost -P 3307 -u demo_user -pdemo_password -e "
  USE demo_wordpress;
  SELECT COUNT(*) FROM wp_performance_logs;
  SELECT COUNT(*) FROM wp_ajax_calls;
"

# Regenerate performance data if empty
docker-compose -f docker-compose.demo.yml exec demo-mysql mysql -u demo_user -pdemo_password demo_wordpress < demo/mysql/generate-performance-data.sql
```

### 6. Network and Connectivity Issues

#### Services Can't Communicate
```bash
# Check Docker network
docker network ls
docker network inspect $(docker-compose -f docker-compose.demo.yml config --services | head -1)

# Test inter-service connectivity
docker-compose -f docker-compose.demo.yml exec demo-wordpress ping demo-mysql
docker-compose -f docker-compose.demo.yml exec demo-nginx ping demo-wordpress
```

#### External Access Issues
```bash
# Check if services are listening
netstat -tlnp | grep -E "(8090|3307|3001)"

# Test local connectivity
curl -I http://localhost:8090
telnet localhost 3307
curl -I http://localhost:3001
```

## Performance Issues

### Slow Startup Times

#### Expected Startup Times
- MySQL initialization: 30-60 seconds
- WordPress setup: 60-120 seconds
- Data generation: 120-300 seconds
- Total startup: 3-7 minutes

#### Optimization Tips
```bash
# Use SSD storage for Docker
# Increase Docker memory allocation
# Close unnecessary applications
# Use --force flag to skip confirmations
./demo/start-demo.sh start --force
```

### High Resource Usage

#### Monitor Resource Usage
```bash
# Check container resource usage
docker stats

# Check system resources
top
htop
free -h
df -h
```

#### Reduce Resource Usage
```bash
# Use smaller data set
export DEMO_DATA_SIZE=small
./demo/reset-demo.sh --force

# Stop unnecessary containers
docker-compose -f docker-compose.demo.yml stop demo-dashboard

# Clean up Docker resources
./demo/cleanup-demo.sh system
```

## Advanced Diagnostics

### Database Diagnostics

#### Check Database Health
```bash
# Connect to MySQL
mysql -h localhost -P 3307 -u demo_user -pdemo_password

# Run diagnostics
USE demo_wordpress;
SHOW ENGINE INNODB STATUS;
SHOW PROCESSLIST;
SHOW VARIABLES LIKE 'performance_schema';
SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = 'demo_wordpress';
```

#### Performance Schema Analysis
```bash
# Check performance schema setup
mysql -h localhost -P 3307 -u demo_user -pdemo_password demo_wordpress < demo/mysql/validate-performance-setup.sql

# View performance metrics
mysql -h localhost -P 3307 -u demo_user -pdemo_password -e "
  USE demo_wordpress;
  SELECT * FROM wp_realtime_metrics ORDER BY timestamp DESC LIMIT 10;
  SELECT query_type, AVG(execution_time), COUNT(*) FROM wp_performance_logs GROUP BY query_type;
"
```

### Container Diagnostics

#### Inspect Container Configuration
```bash
# Check container details
docker inspect $(docker-compose -f docker-compose.demo.yml ps -q demo-mysql)
docker inspect $(docker-compose -f docker-compose.demo.yml ps -q demo-wordpress)

# Check container logs with timestamps
docker-compose -f docker-compose.demo.yml logs -t demo-mysql
docker-compose -f docker-compose.demo.yml logs -t demo-wordpress
```

#### Check Container Health
```bash
# View health check status
docker-compose -f docker-compose.demo.yml ps

# Manual health checks
docker-compose -f docker-compose.demo.yml exec demo-mysql mysqladmin ping -h localhost -u demo_user -pdemo_password
docker-compose -f docker-compose.demo.yml exec demo-wordpress wp core is-installed
docker-compose -f docker-compose.demo.yml exec demo-nginx nginx -t
```

## Recovery Procedures

### Soft Recovery (Restart Services)
```bash
# Restart all services
./demo/manage-demo.sh restart

# Or restart individual services
docker-compose -f docker-compose.demo.yml restart demo-mysql
docker-compose -f docker-compose.demo.yml restart demo-wordpress
```

### Medium Recovery (Reset Data)
```bash
# Reset with data preservation
./demo/reset-demo.sh

# Reset with fresh data generation
./demo/reset-demo.sh --force
```

### Hard Recovery (Complete Cleanup)
```bash
# Remove everything and start fresh
./demo/cleanup-demo.sh all --force
./demo/validate-demo-setup.sh
./demo/start-demo.sh start
```

### Nuclear Recovery (Docker Reset)
```bash
# Stop all Docker containers
docker stop $(docker ps -aq)

# Remove all containers and volumes
docker system prune -af --volumes

# Restart Docker daemon
# Then run setup again
./demo/validate-demo-setup.sh
./demo/start-demo.sh start
```

## Prevention and Best Practices

### Before Starting Demo
```bash
# Always validate setup first
./demo/validate-demo-setup.sh

# Check available resources
docker info
df -h
free -h

# Ensure ports are available
./demo/status-demo.sh --quick
```

### Regular Maintenance
```bash
# Weekly cleanup
./demo/cleanup-demo.sh logs
./demo/cleanup-demo.sh temp

# Monthly full cleanup
./demo/cleanup-demo.sh system
```

### Monitoring
```bash
# Set up monitoring alias
alias demo-status='./demo/status-demo.sh --detailed'

# Regular health checks
watch -n 30 './demo/status-demo.sh --quick'
```

## Getting Additional Help

### Log Collection for Support
```bash
# Collect all relevant logs
mkdir -p /tmp/demo-logs
./demo/start-demo.sh logs > /tmp/demo-logs/all-services.log
docker-compose -f docker-compose.demo.yml config > /tmp/demo-logs/compose-config.yml
./demo/status-demo.sh --detailed > /tmp/demo-logs/status-report.txt
docker info > /tmp/demo-logs/docker-info.txt
```

### Environment Information
```bash
# System information
uname -a
docker --version
docker-compose --version
cat /etc/os-release  # Linux
sw_vers             # macOS
```

### Common Support Questions
1. **What OS are you using?**
2. **What Docker version?**
3. **How much RAM is allocated to Docker?**
4. **Are any other services using ports 8090, 3307, or 3001?**
5. **What error messages do you see in the logs?**
6. **Did the validation script pass?**

For additional support, include the log collection and environment information when reporting issues.
