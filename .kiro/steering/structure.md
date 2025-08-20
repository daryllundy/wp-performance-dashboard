# Project Structure & Organization

## Root Directory Layout

```
wp-performance-dashboard/
├── public/                 # Frontend assets (served statically)
├── src/                   # Source files
├── scripts/               # Utility and data generation scripts
├── tests/                 # Test files (Jest)
├── demo/                  # Demo assets and recordings
├── docs/                  # Documentation
├── config/                # Configuration files
├── wp-content/            # WordPress themes/plugins for full stack mode
├── .kiro/                 # Kiro steering and configuration
├── server.js              # Main server entry point (symlinked from src/)
└── package.json           # Dependencies and npm scripts
```

## Key Directories

### `/public/` - Frontend Assets
- `index.html` - Main dashboard page
- `css/style.css` - Grafana-inspired dark theme styles
- `js/dashboard.js` - Vanilla JavaScript dashboard logic
- Static files served by Express

### `/src/` - Source Code
- `server.js` - Main server file (symlinked to root)
- Contains core application logic

### `/scripts/` - Utilities
- `generate-demo-data.js` - Demo data generation for testing
- Database setup and seeding scripts

### `/tests/` - Testing
- `docker-build.test.js` - Docker build validation
- `docker-functionality.test.js` - Docker runtime tests
- Jest configuration in `jest.config.js`

### `/wp-content/` - WordPress Assets
- Full WordPress themes and plugins
- Used in full stack deployment mode
- Mounted as volume in Docker containers

## Configuration Files

### Environment Configuration
- `.env` - Main environment variables
- `.env.dashboard.example` - Template for dashboard-only mode
- Supports both local database and external WordPress API modes

### Docker Configuration
- `Dockerfile` - Node.js 18 Alpine container definition
- `docker-compose.full.yml` - Complete stack (WordPress + MySQL + Dashboard)
- `docker-compose.dashboard.yml` - Dashboard-only mode
- `start.sh` - Legacy sta
