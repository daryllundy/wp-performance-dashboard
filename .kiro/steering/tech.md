# Technology Stack & Build System

## Backend Stack

- **Runtime**: Node.js 18+ (Alpine Linux in Docker)
- **Framework**: Express.js for REST API and static file serving
- **Database**: MySQL 8.0 with connection pooling (mysql2 package)
- **Real-time**: Socket.IO for WebSocket communication (5-second intervals)
- **Environment**: dotenv for configuration management

## Frontend Stack

- **Architecture**: Vanilla JavaScript (no heavy frameworks)
- **Charts**: Chart.js with date-fns adapter for time series
- **Styling**: Modern CSS with Grid/Flexbox, dark theme inspired by Grafana/Netdata
- **Real-time**: WebSocket client integration with Socket.IO

## Key Dependencies

```json
{
  "express": "^4.18.2",
  "mysql2": "^3.6.0", 
  "socket.io": "^4.7.2",
  "dotenv": "^16.3.1",
  "node-fetch": "^2.7.0"
}
```

## Development & Testing

- **Test Framework**: Jest with 5-minute timeout for Docker tests
- **Test Types**: Unit tests and Docker integration tests
- **Coverage**: Source files in `src/` and `scripts/` directories

## Common Commands

```bash
# Development
npm start                    # Start the server (port 3000)
npm run seed:sample-data     # Generate demo data for testing

# Testing  
npm test                     # Run all tests
npm test:docker              # Run Docker-specific tests

# Docker Deployment
docker-compose -f docker-compose.full.yml up -d      # Full stack with WordPress
docker-compose -f docker-compose.dashboard.yml up -d # Dashboard-only mode
./start.sh                                           # Legacy startup with port detection
```

## Configuration Patterns

- **Environment Variables**: Use `.env` files for configuration
- **Dual Mode Support**: Check `process.env.WP_API_URL` to determine external vs local WordPress
- **Database Pooling**: Always use connection pools for MySQL (connectionLimit: 10)
- **Error Handling**: Comprehensive try-catch with user-friendly error responses

## Build & Deployment

- **Container**: Node.js 18 Alpine base image
- **Port**: Default 3000, configurable via PORT environment variable
- **Volumes**: Source code mounted for development, node_modules excluded
- **Dependencies**: npm install during Docker build process
