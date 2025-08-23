# Demo Management Scripts

This directory contains comprehensive scripts for managing the WordPress Performance Dashboard demo environment.

## Overview

The demo environment provides a complete WordPress setup with MySQL database, Nginx proxy, and optional performance dashboard for showcasing the monitoring capabilities.

## Scripts

### 1. `manage-demo.sh` - Main Management Interface

The primary script that provides a unified interface for all demo operations.

```bash
# Quick start
./demo/manage-demo.sh overview    # Show overview and quick start guide
./demo/manage-demo.sh setup       # Initial setup and validation
./demo/manage-demo.sh start       # Start demo environment
./demo/manage-demo.sh status      # Check service health

# With dashboard
./demo/manage-demo.sh start --dashboard

# Management operations
./demo/manage-demo.sh restart     # Restart services
./demo/manage-demo.sh reset       # Reset to clean state
./demo/manage-demo.sh cleanup all # Complete cleanup
```

### 2. `start-demo.sh` - Environment Startup

Enhanced startup script with health checks and validation.

```bash
./demo/start-demo.sh start                    # Start WordPress demo
./demo/start-demo.sh start --with-dashboard   # Include dashboard
./demo/start-demo.sh stop                     # Stop services
./demo/start-demo.sh status                   # Show service status
./demo/start-demo.sh logs [service]           # View logs
```

### 3. `status-demo.sh` - Health Monitoring

Comprehensive status checking with service health validation.

```bash
./demo/status-demo.sh              # Standard status check
./demo/status-demo.sh --quick      # Quick overview
./demo/status-demo.sh --detailed   # Detailed health check with logs
./demo/status-demo.sh --resources  # Resource usage information
```

### 4. `reset-demo.sh` - Environment Reset

Complete environment reset to original state.

```bash
./demo/reset-demo.sh                    # Interactive reset
./demo/reset-demo.sh --force            # Reset without confirmation
./demo/reset-demo.sh --force --remove-images  # Full reset including images
```

### 5. `cleanup-demo.sh` - Resource Cleanup

Granular cleanup options for different resource types.

```bash
./demo/cleanup-demo.sh stop         # Stop services only
./demo/cleanup-demo.sh containers   # Remove containers and volumes
./demo/cleanup-demo.sh volumes      # Remove data volumes only
./demo/cleanup-demo.sh images       # Remove Docker images
./demo/cleanup-demo.sh logs         # Clean log files
./demo/cleanup-demo.sh all          # Complete cleanup
./demo/cleanup-demo.sh all --force  # Complete cleanup without prompts
```

### 6. `validate-demo-setup.sh` - Setup Validation

Validates that all required files and configurations are in place.

```bash
./demo/validate-demo-setup.sh       # Validate demo setup
```

## Quick Start Guide

1. **Initial Setup**
   ```bash
   ./demo/manage-demo.sh setup
   ```

2. **Start Demo Environment**
   ```bash
   # WordPress only
   ./demo/manage-demo.sh start
   
   # With performance dashboard
   ./demo/manage-demo.sh start --dashboard
   ```

3. **Check Status**
   ```bash
   ./demo/manage-demo.sh status
   ```

4. **Access Services**
   - WordPress Frontend: http://localhost:8090
   - WordPress Admin: http://localhost:8090/wp-admin (admin/demo_password)
   - Performance Dashboard: http://localhost:3001 (if started with --dashboard)
   - MySQL Database: localhost:3307 (demo_user/demo_password)

## Service Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Nginx Proxy   │    │   WordPress     │    │ Performance     │
│   Port: 8090    │───▶│   Application   │───▶│ Dashboard       │
│                 │    │                 │    │ Port: 3001      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │
                                ▼
                       ┌─────────────────┐
                       │ MySQL Database  │
                       │ Port: 3307      │
                       │                 │
                       └─────────────────┘
                                ▲
                                │
                       ┌─────────────────┐
                       │ Data Generator  │
                       │ (Init only)     │
                       └─────────────────┘
```

## Environment Components

### MySQL Database
- **Port**: 3307 (to avoid conflicts)
- **Database**: demo_wordpress
- **User**: demo_user / demo_password
- **Features**: Performance schema enabled, slow query logging

### WordPress Application
- **Access**: Via Nginx proxy on port 8090
- **Admin**: admin / demo_password
- **Content**: Pre-populated with demo posts, pages, and media
- **Plugins**: Performance simulation plugins installed

### Nginx Proxy
- **Port**: 8090
- **Features**: Caching, access logging, performance simulation
- **Logs**: Available in `demo/nginx/logs/`

### Performance Dashboard (Optional)
- **Port**: 3001
- **Features**: Real-time monitoring of demo WordPress instance
- **Data Source**: Direct MySQL connection to demo database

### Demo Data Generator
- **Type**: One-time initialization container
- **Purpose**: Populates database with realistic demo content
- **Content**: Posts, pages, users, performance logs, admin-ajax data

## File Structure

```
demo/
├── manage-demo.sh              # Main management interface
├── start-demo.sh               # Environment startup
├── status-demo.sh              # Health monitoring
├── reset-demo.sh               # Environment reset
├── cleanup-demo.sh             # Resource cleanup
├── validate-demo-setup.sh      # Setup validation
├── README-SCRIPTS.md           # This documentation
├── nginx/
│   ├── nginx.conf              # Nginx configuration
│   └── logs/                   # Nginx access/error logs
├── mysql/
│   ├── init.sql                # Database initialization
│   ├── my.cnf                  # MySQL configuration
│   └── logs/                   # MySQL logs
├── wordpress/
│   ├── wp-config-demo.php      # WordPress configuration
│   └── demo-plugins/           # Demo plugins
└── scripts/
    ├── generate-demo-data.js   # Data generation script
    └── test-*.js               # Testing scripts
```

## Troubleshooting

### Common Issues

1. **Port Conflicts**
   ```bash
   # Check what's using the ports
   lsof -i :8090 -i :3307 -i :3001
   
   # Stop conflicting services or use cleanup
   ./demo/cleanup-demo.sh stop
   ```

2. **Services Not Starting**
   ```bash
   # Check detailed status
   ./demo/status-demo.sh --detailed
   
   # View service logs
   ./demo/manage-demo.sh logs demo-mysql
   ./demo/manage-demo.sh logs demo-wordpress
   ```

3. **Database Connection Issues**
   ```bash
   # Reset the environment
   ./demo/reset-demo.sh --force
   
   # Validate setup
   ./demo/validate-demo-setup.sh
   ```

4. **Missing Demo Data**
   ```bash
   # Reset and regenerate data
   ./demo/reset-demo.sh --force
   ./demo/manage-demo.sh start
   ```

### Health Checks

The scripts include comprehensive health checks:
- Docker daemon availability
- Service container status
- Database connectivity
- HTTP response validation
- Resource usage monitoring
- Log file analysis

### Cleanup Strategies

- **Soft Cleanup**: `./demo/cleanup-demo.sh stop` - Stops services only
- **Standard Cleanup**: `./demo/cleanup-demo.sh containers` - Removes containers and volumes
- **Complete Cleanup**: `./demo/cleanup-demo.sh all` - Removes everything including images
- **Reset**: `./demo/reset-demo.sh` - Complete reset and restart

## Integration with Main Application

The demo environment is designed to work alongside the main WordPress Performance Dashboard:

1. **Isolated Ports**: Uses different ports to avoid conflicts
2. **Separate Data**: Independent database and volumes
3. **Dashboard Integration**: Main dashboard can connect to demo database
4. **Testing Environment**: Provides realistic data for dashboard testing

## Requirements Mapping

This implementation addresses the following requirements:

- **Requirement 5.1**: Easy commands for demo management via `manage-demo.sh`
- **Requirement 5.2**: Reset functionality via `reset-demo.sh`
- **Requirement 5.3**: Status checking with health validation via `status-demo.sh`
- **Requirement 5.4**: Cleanup scripts for environment teardown via `cleanup-demo.sh`

## Support

For issues with the demo environment:

1. Run `./demo/validate-demo-setup.sh` to check configuration
2. Use `./demo/status-demo.sh --detailed` for comprehensive health check
3. Check logs with `./demo/manage-demo.sh logs [service]`
4. Reset environment with `./demo/reset-demo.sh --force` if needed
