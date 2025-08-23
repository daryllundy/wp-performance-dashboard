# Demo Environment Quick Start Guide

Get the WordPress Performance Dashboard demo running in under 5 minutes!

## Prerequisites

- Docker and Docker Compose installed
- 4GB+ RAM available for Docker
- Ports 8090, 3307, and 3001 available

## 1-Minute Setup

```bash
# Clone and navigate to the project
git clone https://github.com/daryllundy/wp-performance-dashboard.git
cd wp-performance-dashboard

# Start the complete demo environment
./demo/start-demo.sh start --with-dashboard
```

**That's it!** The demo will automatically:
- Start MySQL, WordPress, Nginx, and the Performance Dashboard
- Generate realistic demo data (posts, users, performance metrics)
- Configure all services and connections

## Access Points

Once setup is complete (3-5 minutes), access:

### WordPress Demo Site
- **URL**: http://localhost:8090
- **Admin**: http://localhost:8090/wp-admin
- **Credentials**: `admin` / `demo_password`

### Performance Dashboard
- **URL**: http://localhost:3001
- **Features**: Real-time monitoring, performance metrics, slow query analysis

### Database Access
- **Host**: localhost
- **Port**: 3307
- **Database**: demo_wordpress
- **Credentials**: `demo_user` / `demo_password`

## What You'll See

### WordPress Site Features
- 75+ blog posts with realistic content
- 15+ pages including contact forms
- 5 user accounts with different roles
- 200+ comments and interactions
- Media library with images and metadata

### Performance Dashboard Features
- **Real-time Metrics**: Live QPS, response times, memory usage
- **Performance Logs**: 5000+ query execution records
- **Slow Query Analysis**: Detailed breakdown of problematic queries
- **Plugin Performance**: Impact analysis for 7+ active plugins
- **AJAX Monitoring**: 1000+ admin-ajax call records
- **System Health**: Overall performance indicators

### Performance Scenarios
Test different load scenarios using the Performance Simulator plugin:
- **Light Load**: Normal operations (0.1-0.5s response)
- **Medium Load**: Moderate traffic (0.5-2s response)
- **Heavy Load**: High traffic (2-8s response)
- **Critical Load**: System stress (8-15s response)

## Quick Commands

```bash
# Check if everything is running
./demo/status-demo.sh

# View service logs
./demo/start-demo.sh logs

# Stop the demo
./demo/start-demo.sh stop

# Reset everything (clean slate)
./demo/reset-demo.sh --force

# Get help
./demo/manage-demo.sh overview
```

## Testing Performance Features

### 1. View Real-time Dashboard
Visit http://localhost:3001 to see:
- Live performance gauges
- Interactive time-series charts
- Recent slow queries
- Plugin performance matrix

### 2. Trigger Performance Scenarios
In WordPress admin (http://localhost:8090/wp-admin):
1. Go to **Tools > Performance Simulator**
2. Click different load scenario buttons
3. Watch the dashboard update in real-time

### 3. Generate Traffic
- Browse the WordPress site (http://localhost:8090)
- Create/edit posts in the admin
- Submit contact forms
- Upload media files

All activity generates performance data visible in the dashboard!

## Troubleshooting

### Common Issues

**Port Conflicts**
```bash
# Check what's using the ports
lsof -i :8090 :3307 :3001

# Stop conflicting services or modify ports in docker-compose.demo.yml
```

**Services Won't Start**
```bash
# Check Docker is running
docker info

# View detailed status
./demo/status-demo.sh --detailed

# Reset if needed
./demo/reset-demo.sh --force
```

**No Performance Data**
```bash
# Regenerate demo data
docker-compose -f docker-compose.demo.yml --profile init up demo-data-generator

# Check database connection
mysql -h localhost -P 3307 -u demo_user -pdemo_password demo_wordpress
```

### Getting Help

- **Detailed Status**: `./demo/status-demo.sh --detailed`
- **Validate Setup**: `./demo/validate-demo-setup.sh`
- **View Logs**: `./demo/start-demo.sh logs [service-name]`
- **Complete Guide**: See [demo/README.md](README.md)
- **Troubleshooting**: See [demo/TROUBLESHOOTING.md](TROUBLESHOOTING.md)

## Next Steps

### Explore Dashboard Features
- Toggle between different time ranges (1h, 6h, 24h, 7d)
- Click on slow queries to see details
- Monitor plugin performance impact
- Watch real-time metrics update every 5 seconds

### Test Performance Scenarios
- Use the Performance Simulator plugin to create controlled load
- Monitor how different scenarios affect dashboard metrics
- Observe slow query generation and memory usage patterns

### Connect External Tools
- Use the demo database as a data source for other monitoring tools
- Connect MySQL clients to explore the performance data structure
- Export performance data for analysis

### Customize the Demo
- Modify `docker-compose.demo.yml` to adjust configurations
- Edit demo data generation in `demo/scripts/generate-demo-data.js`
- Customize performance scenarios in the Performance Simulator plugin

## Demo Environment Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Nginx Proxy   │───▶│   WordPress     │───▶│   MySQL 8.0     │
│   Port: 8090    │    │   (Latest)      │    │   Port: 3307    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                                       ▲
┌─────────────────┐                                   │
│ Perf Dashboard  │                                   │
│   Port: 3001    │───────────────────────────────────┘
└─────────────────┘

┌─────────────────┐
│ Data Generator  │ (One-time initialization)
│  (Node.js)      │
└─────────────────┘
```

The demo provides a complete, realistic WordPress performance monitoring environment that showcases all dashboard capabilities with authentic data patterns and performance scenarios.

Happy monitoring! 🚀
