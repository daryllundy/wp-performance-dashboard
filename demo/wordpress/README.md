# WordPress Demo Configuration

This directory contains the WordPress configuration files and scripts for the demo environment.

## Files

- `wp-config-demo.php` - Custom WordPress configuration for demo environment
- `init-demo-content.php` - Must-use plugin that initializes demo content
- `docker-entrypoint-init.sh` - Container initialization script
- `Dockerfile` - Custom WordPress container with WP-CLI and demo setup
- `demo-plugins/` - Directory containing demo-specific plugins
- `uploads/` - Demo media uploads directory

## Demo Features

### Performance Simulator Plugin
Located in `demo-plugins/performance-simulator/`, this plugin provides:
- Controlled slow query simulation
- Memory usage spikes for testing
- AJAX call performance monitoring
- Admin interface for triggering performance scenarios

### Demo Content Initialization
The `init-demo-content.php` script automatically creates:
- 5 demo users with different roles
- 50+ demo posts with varied content
- 10+ demo pages
- 200+ demo comments
- Performance monitoring tables
- Realistic metadata for testing

### WordPress Configuration
The demo environment includes:
- Debug logging enabled
- Query logging for performance analysis
- Custom memory limits for testing
- Performance monitoring hooks
- Demo-specific constants and settings

## Usage

The demo WordPress environment is automatically configured when the Docker containers start. The initialization script:

1. Waits for MySQL to be ready
2. Installs WordPress if not already present
3. Activates demo plugins
4. Creates demo content
5. Configures WordPress settings

## Access

- WordPress Frontend: http://localhost:8090
- WordPress Admin: http://localhost:8090/wp-admin
  - Username: `demo_admin`
  - Password: `demo_password`

## Performance Testing

The demo environment includes several ways to generate performance data:
- Automatic slow query simulation (10% chance)
- Manual performance triggers via admin interface
- Realistic plugin performance variations
- AJAX call monitoring and logging
