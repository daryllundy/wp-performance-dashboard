# WordPress Performance Dashboard - Docker Setup

This project provides two Docker Compose configurations to suit different deployment scenarios:

## 1. Full Stack Setup (`docker-compose.full.yml`)

**Use case**: Local development with complete WordPress installation

This configuration includes:
- WordPress instance (port 8080)
- MySQL database
- Performance Dashboard (port 3000)

**Usage:**
```bash
# Start the full stack
docker-compose -f docker-compose.full.yml up -d

# Access points:
# - WordPress: http://localhost:8080
# - Performance Dashboard: http://localhost:3000
```

## 2. Dashboard-Only Setup (`docker-compose.dashboard.yml`)

**Use case**: Connect to an existing WordPress installation via WP-API

This configuration includes only the performance dashboard service and connects to an external WordPress site via the WordPress REST API.

**Usage:**

### Prerequisites
1. Your WordPress site must have the WordPress REST API enabled
2. You need to create a WordPress user with appropriate permissions
3. (Optional) Install a WordPress plugin that provides the performance dashboard endpoints

### Setup
1. Copy the example environment file:
   ```bash
   cp .env.dashboard.example .env
   ```

2. Update the `.env` file with your WordPress site details:
   ```env
   WP_API_URL=https://your-wordpress-site.com
   WP_API_USERNAME=your-api-username
   WP_API_PASSWORD=your-api-password
   DASHBOARD_PORT=3000
   ```

3. Start the dashboard:
   ```bash
   docker-compose -f docker-compose.dashboard.yml up -d
   ```

4. Access the dashboard at: http://localhost:3000

## WordPress Plugin Requirements

For the dashboard to work with an external WordPress installation, your WordPress site needs to provide the following REST API endpoints:

- `/wp-json/wp-performance-dashboard/v1/metrics`
- `/wp-json/wp-performance-dashboard/v1/slow-queries`
- `/wp-json/wp-performance-dashboard/v1/admin-ajax`
- `/wp-json/wp-performance-dashboard/v1/plugins`
- `/wp-json/wp-performance-dashboard/v1/realtime-metrics`
- `/wp-json/wp-performance-dashboard/v1/system-health`

**Note**: These endpoints are specific to a performance monitoring plugin that needs to be installed on your WordPress site. The current implementation expects these endpoints to exist.

## Environment Variables

### For Full Stack Setup
Uses the default `.env` file with local database configuration.

### For Dashboard-Only Setup
Uses the following environment variables:

| Variable | Description | Required |
|----------|-------------|----------|
| `WP_API_URL` | Base URL of your WordPress site | Yes |
| `WP_API_USERNAME` | WordPress API username | No* |
| `WP_API_PASSWORD` | WordPress API password | No* |
| `DASHBOARD_PORT` | Port for the dashboard (default: 3000) | No |
| `NODE_ENV` | Environment mode | No |
| `SESSION_SECRET` | Session secret for security | No |

*Authentication is optional but recommended for production use.

## Troubleshooting

### Dashboard-Only Setup Issues

1. **Connection Refused**: Ensure your WordPress site is accessible and the API URL is correct
2. **Authentication Failed**: Verify the WordPress credentials have proper permissions
3. **Missing Endpoints**: Ensure the required WordPress plugin is installed and active
4. **CORS Issues**: Configure your WordPress site to allow requests from the dashboard domain

### Full Stack Setup Issues

1. **Port Conflicts**: Ensure ports 3000, 3306, and 8080 are available
2. **Database Connection**: Check MySQL container logs if dashboard can't connect
3. **WordPress Setup**: Ensure WordPress container completes initialization

## Development

To modify the dashboard behavior:

1. For full stack: Use `docker-compose.full.yml`
2. For dashboard-only: Use `docker-compose.dashboard.yml` with appropriate environment variables
3. The dashboard automatically detects the mode based on the presence of `WP_API_URL`

## Security Considerations

- Use HTTPS in production
- Implement proper authentication on WordPress API endpoints
- Change default session secrets
- Restrict API access to specific IP addresses if possible
