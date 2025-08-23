# Demo WordPress Environment

This directory contains a comprehensive demo WordPress environment specifically designed to showcase the WordPress Performance Dashboard capabilities. The demo includes realistic performance data, varied query patterns, and multiple performance scenarios to demonstrate the dashboard's monitoring features.

## Quick Start Guide

### Option 1: Simple Demo Setup
```bash
# Start the demo environment (WordPress + MySQL + Nginx)
./demo/start-demo.sh start

# Check if everything is running
./demo/status-demo.sh

# Access WordPress at http://localhost:8090
# Admin: http://localhost:8090/wp-admin (admin/demo_password)
```

### Option 2: Demo with Performance Dashboard
```bash
# Start demo with integrated performance dashboard
./demo/start-demo.sh start --with-dashboard

# Access Performance Dashboard at http://localhost:3001
# Monitor the demo WordPress database in real-time
```

### Option 3: Using the Management Script
```bash
# Use the unified management interface
./demo/manage-demo.sh overview    # Show overview and commands
./demo/manage-demo.sh setup       # Initial setup and validation
./demo/manage-demo.sh start       # Start demo environment
./demo/manage-demo.sh status      # Check service health
```

## Services

### WordPress (via Nginx)
- **URL**: http://localhost:8090
- **Admin**: http://localhost:8090/wp-admin
- **Credentials**: demo_admin / demo_password

### MySQL Database
- **Host**: localhost
- **Port**: 3307
- **Database**: demo_wordpress
- **User**: demo_user
- **Password**: demo_password

### Demo Dashboard (Optional)
- **URL**: http://localhost:3001
- **Monitors**: Demo WordPress database

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Nginx Proxy   │───▶│   WordPress     │───▶│   MySQL 8.0     │
│   Port: 8090    │    │   (Latest)      │    │   Port: 3307    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                                       ▲
                       ┌─────────────────┐            │
                       │ Data Generator  │────────────┘
                       │  (One-time)     │
                       └─────────────────┘
```

## Demo Data Structure

The demo environment includes comprehensive, realistic data designed to showcase all dashboard features:

### WordPress Content
- **75+ Blog Posts**: Varied content lengths (500-3000 words) with realistic titles and content
- **15+ Pages**: Including complex layouts, contact forms, and landing pages
- **5 User Accounts**: Different roles (Administrator, Editor, Author, Subscriber) with realistic activity
- **200+ Comments**: Approved, pending, and spam comments for realistic interaction patterns
- **Media Library**: 20+ images with metadata for realistic media queries

### Performance Data
- **5,000+ Performance Logs**: Varied query patterns with realistic execution times
- **200+ Slow Queries**: Examples of problematic queries with 1-9 second execution times
- **1,000+ AJAX Calls**: Realistic admin-ajax actions with varied response times and success rates
- **Plugin Performance Metrics**: Impact scores and resource usage for 7+ active plugins
- **Real-time Metrics**: Live data for QPS, memory usage, response times, and system health

### Performance Scenarios
The demo includes four distinct performance load scenarios:

1. **Light Load** (0.1-0.5s response): Normal WordPress operations
2. **Medium Load** (0.5-2s response): Moderate traffic with complex queries
3. **Heavy Load** (2-8s response): High traffic with resource-intensive operations
4. **Critical Load** (8-15s response): System under stress with deliberate delays

## Performance Features

### MySQL Configuration
- Performance Schema enabled
- Slow query logging (>1 second)
- General query logging
- Custom performance monitoring tables

### WordPress Setup
- Debug mode enabled with query saving
- Performance monitoring hooks
- Demo plugins for varied performance scenarios
- Realistic content structure

### Nginx Proxy
- Performance logging with upstream timing
- Caching configuration for static assets
- AJAX endpoint monitoring
- Access and error logging

## File Structure

```
demo/
├── docker-compose.demo.yml     # Main Docker Compose configuration
├── start-demo.sh              # Management script
├── .env.demo                  # Environment configuration
├── nginx/
│   ├── nginx.conf            # Nginx proxy configuration
│   └── logs/                 # Nginx access and error logs
├── mysql/
│   ├── init.sql              # Database initialization
│   ├── my.cnf                # MySQL performance configuration
│   └── logs/                 # MySQL query logs
├── wordpress/
│   ├── wp-config-demo.php    # WordPress demo configuration
│   ├── demo-plugins/         # Demo plugins directory
│   └── uploads/              # Demo media uploads
├── scripts/
│   └── generate-demo-data.js # Demo data generation script
└── data-generator/
    └── Dockerfile            # Data generator container
```

## Troubleshooting Guide

### Common Issues and Solutions

#### Port Conflicts
**Problem**: Services fail to start due to port conflicts
**Ports Used**: 8090 (Nginx), 3307 (MySQL), 3001 (Dashboard)

**Solution**:
```bash
# Check what's using the ports
lsof -i :8090
lsof -i :3307
lsof -i :3001

# Stop conflicting services or modify docker-compose.demo.yml ports
```

#### Services Won't Start
**Problem**: Docker containers fail to start or become unhealthy

**Diagnosis**:
```bash
./demo/status-demo.sh --detailed    # Comprehensive health check
./demo/start-demo.sh logs           # View all service logs
./demo/start-demo.sh logs demo-mysql # View specific service logs
```

**Solutions**:
```bash
# Reset everything and start fresh
./demo/reset-demo.sh --force

# Or clean up and restart
./demo/cleanup-demo.sh containers
./demo/start-demo.sh start
```

#### WordPress Not Loading
**Problem**: WordPress shows errors or doesn't load properly

**Check**:
1. MySQL is ready: `./demo/status-demo.sh`
2. WordPress container logs: `./demo/start-demo.sh logs demo-wordpress`
3. Nginx proxy logs: `./demo/start-demo.sh logs demo-nginx`

**Solution**:
```bash
# Wait for MySQL to be fully ready (can take 30-60 seconds)
# Check WordPress initialization
docker-compose -f docker-compose.demo.yml exec demo-wordpress wp core is-installed
```

#### Demo Data Missing
**Problem**: WordPress loads but has no demo content

**Solution**:
```bash
# Regenerate demo data
docker-compose -f docker-compose.demo.yml --profile init up demo-data-generator

# Or reset and regenerate everything
./demo/reset-demo.sh --force
```

#### Performance Dashboard Not Connecting
**Problem**: Dashboard shows "No data" or connection errors

**Check**:
1. MySQL is accessible: `mysql -h localhost -P 3307 -u demo_user -pdemo_password`
2. Demo database exists: `SHOW DATABASES;`
3. Performance tables exist: `USE demo_wordpress; SHOW TABLES LIKE 'wp_%performance%';`

**Solution**:
```bash
# Verify database setup
./demo/validate-demo-setup.sh

# Check dashboard configuration
./demo/status-demo.sh --detailed
```

#### Docker Issues
**Problem**: Docker-related errors or resource issues

**Solutions**:
```bash
# Check Docker daemon
docker info

# Clean up Docker resources
./demo/cleanup-demo.sh system

# Restart Docker daemon (macOS/Windows)
# Or restart Docker service (Linux)
```

### Performance Issues

#### Slow Demo Startup
**Cause**: Initial data generation and WordPress setup
**Expected Time**: 2-5 minutes for complete setup
**Solution**: Be patient, monitor with `./demo/status-demo.sh`

#### High Resource Usage
**Cause**: Multiple containers + demo data generation
**Solution**: 
- Ensure adequate RAM (4GB+ recommended)
- Close unnecessary applications
- Use `./demo/cleanup-demo.sh system` to free Docker resources

### Getting Help

#### Diagnostic Commands
```bash
# Complete system check
./demo/manage-demo.sh status --detailed

# Validate setup
./demo/validate-demo-setup.sh

# View recent logs
./demo/status-demo.sh --detailed

# Check resource usage
docker stats
```

#### Reset Options
```bash
# Soft reset (restart services)
./demo/manage-demo.sh restart

# Hard reset (remove all data)
./demo/reset-demo.sh --force

# Complete cleanup (remove everything)
./demo/cleanup-demo.sh all --force
```

#### Log Locations
- **Nginx Logs**: `demo/nginx/logs/`
- **MySQL Logs**: `demo/mysql/logs/`
- **Container Logs**: `docker-compose -f docker-compose.demo.yml logs [service]`

## Performance Scenarios Explained

The demo environment simulates realistic WordPress performance patterns through several mechanisms:

### 1. Performance Simulator Plugin
Located in `demo/wordpress/demo-plugins/performance-simulator/`, this custom plugin provides:

#### Load Scenarios
- **Light Load**: Simple queries, minimal memory usage (0.1-0.5s response)
- **Medium Load**: Complex JOINs, moderate memory usage (0.5-2s response)  
- **Heavy Load**: Subqueries with RAND(), high memory usage (2-8s response)
- **Critical Load**: Complex queries with SLEEP(1), very high memory usage (8-15s response)

#### AJAX Simulation
Realistic admin-ajax calls with varied characteristics:
- `heartbeat` (25% frequency, 0.08s avg)
- `save_post` (15% frequency, 0.35s avg)
- `query_attachments` (8% frequency, 0.18s avg)
- `demo_performance_test` (2% frequency, 1.8s avg)
- `demo_memory_spike` (1% frequency, 3.2s avg)

#### Background Simulation
- Hourly background tasks that simulate realistic load patterns
- Automatic slow query generation (15% chance on page loads)
- Memory spike simulation (8% chance during operations)

### 2. Database Performance Data
The demo generates realistic performance metrics:

#### Query Patterns
- **Core WordPress**: Post lookups, meta queries, taxonomy queries
- **WooCommerce**: Product searches, cart operations
- **Yoast SEO**: SEO analysis queries
- **Contact Form 7**: Form submission processing
- **Performance Simulator**: Controlled performance tests

#### Slow Query Examples
```sql
-- Complex post query with random ordering
SELECT p.*, pm1.meta_value as view_count, pm2.meta_value as featured_image,
       GROUP_CONCAT(t.name) as tags
FROM wp_posts p
LEFT JOIN wp_postmeta pm1 ON p.ID = pm1.post_id AND pm1.meta_key = 'view_count'
LEFT JOIN wp_postmeta pm2 ON p.ID = pm2.post_id AND pm2.meta_key = '_thumbnail_id'
LEFT JOIN wp_term_relationships tr ON p.ID = tr.object_id
LEFT JOIN wp_terms t ON tr.term_taxonomy_id = t.term_id
WHERE p.post_status = 'publish'
GROUP BY p.ID
ORDER BY RAND(), p.post_date DESC
LIMIT 15;
```

### 3. Realistic Data Patterns
The demo data follows realistic WordPress usage patterns:

#### Content Distribution
- **Blog Posts**: 75+ posts with varied lengths (500-3000 words)
- **Pages**: 15+ pages including contact forms, about pages, landing pages
- **Comments**: 200+ comments with realistic approval ratios (85% approved)
- **Media**: 20+ images with proper metadata and attachment relationships

#### User Activity Patterns
- **Administrator**: Full access, frequent saves, plugin management
- **Editor**: Content management, moderate admin-ajax usage
- **Author**: Content creation, limited admin access
- **Subscriber**: Minimal database interaction, frontend-only

#### Performance Metrics Distribution
- **Normal Operations**: 85% of queries under 0.1s
- **Moderate Load**: 10% of queries 0.1-1s
- **Slow Queries**: 4% of queries 1-5s
- **Critical Issues**: 1% of queries over 5s

## Integration with Main Dashboard

### Option 1: Built-in Dashboard
Start demo with integrated dashboard:
```bash
./demo/start-demo.sh start --with-dashboard
# Access at http://localhost:3001
```

### Option 2: External Dashboard Connection
Configure your main dashboard to connect to the demo database:

**Database Configuration:**
- Host: `localhost`
- Port: `3307`
- Database: `demo_wordpress`
- Username: `demo_user`
- Password: `demo_password`

**Environment Variables:**
```bash
DB_HOST=localhost
DB_PORT=3307
DB_NAME=demo_wordpress
DB_USER=demo_user
DB_PASSWORD=demo_password
```

### Available Performance Tables
The demo database includes all performance monitoring tables:
- `wp_performance_logs` - Query execution metrics
- `wp_slow_queries` - Slow query tracking
- `wp_ajax_calls` - AJAX call monitoring
- `wp_plugin_performance` - Plugin impact metrics
- `wp_realtime_metrics` - Live system metrics
- `wp_connection_stats` - Database connection statistics

## Demo Management Commands

### Basic Operations
```bash
# Start demo environment
./demo/start-demo.sh start [--with-dashboard]

# Check status and health
./demo/status-demo.sh [--quick|--detailed]

# Stop services
./demo/start-demo.sh stop

# Reset to clean state
./demo/reset-demo.sh [--force]
```

### Advanced Management
```bash
# Unified management interface
./demo/manage-demo.sh overview          # Show all available commands
./demo/manage-demo.sh setup             # Initial setup and validation
./demo/manage-demo.sh start --dashboard # Start with dashboard
./demo/manage-demo.sh status --detailed # Comprehensive health check
./demo/manage-demo.sh cleanup all       # Complete cleanup
```

### Validation and Diagnostics
```bash
# Validate demo setup
./demo/validate-demo-setup.sh

# View service logs
./demo/start-demo.sh logs [service-name]

# Clean up resources
./demo/cleanup-demo.sh [containers|volumes|images|all] [--force]
```
