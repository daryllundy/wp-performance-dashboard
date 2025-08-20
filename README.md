# 🚀 WordPress Performance Dashboard

A comprehensive, real-time WordPress performance monitoring dashboard built with modern web technologies. This dashboard provides detailed insights into WordPress performance metrics, database queries, plugin impact, and system health - designed in the style of professional monitoring tools like Grafana and Netdata.

## ✨ Features

### 📊 Real-time Performance Monitoring

- **Live Metrics**: Real-time tracking of queries per second, response times, and memory usage
- **Interactive Gauges**: Visual gauges for key performance indicators
- **Time Series Charts**: Historical performance data with interactive time range selection
- **WebSocket Updates**: Real-time data streaming every 5 seconds

### 🔍 Advanced Analytics

- **Slow Query Analysis**: Detailed breakdown of slow database queries with execution times
- **Plugin Performance Matrix**: Impact scoring for all active WordPress plugins
- **Admin-Ajax Monitoring**: Track admin-ajax calls and their performance impact
- **System Health Overview**: CPU, memory, and disk usage monitoring

### 🎨 Modern UI/UX

- **Grafana/Netdata Inspired**: Professional dark theme with modern card-based layout
- **Interactive Controls**: Metric toggles, time range selectors, and refresh controls
- **Responsive Design**: Works perfectly on desktop, tablet, and mobile devices
- **Smooth Animations**: Elegant transitions and hover effects

### 🛠️ Technical Features

- **Database Integration**: Direct MySQL connection for real-time data
- **RESTful API**: Comprehensive API endpoints for all dashboard data
- **Error Handling**: Robust error handling with user-friendly notifications
- **Performance Optimized**: Efficient database queries and caching strategies

## 🏗️ Architecture

### Backend

- **Node.js/Express**: High-performance web server with RESTful APIs
- **MySQL**: Database for storing performance metrics with connection pooling
- **Socket.IO**: Real-time bidirectional communication (5-second intervals)
- **Environment Configuration**: .env support for flexible deployment

### Frontend

- **Vanilla JavaScript**: No heavy frameworks, optimized for performance
- **Chart.js**: Advanced charting library with time series support
- **CSS Grid/Flexbox**: Modern responsive layout techniques
- **WebSocket Integration**: Real-time dashboard updates
- **Modern UI**: Grafana/Netdata-inspired dark theme with smooth animations

### Infrastructure

- **Docker Support**: Complete containerization with docker-compose
- **WordPress Integration**: Direct database monitoring capabilities
- **Demo Data**: Sample data generation for testing and demonstrations

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ and npm
- MySQL 8.0+
- Docker and Docker Compose (optional)

### Installation Options

#### Option 1: Direct Node.js Setup

1. **Clone the repository**

   ```bash
   git clone https://github.com/daryllundy/wp-performance-dashboard.git
   cd wp-performance-dashboard
   ```
2. **Install dependencies**

   ```bash
   npm install
   ```
3. **Set up environment variables**

   ```bash
   cp .env.dashboard.example .env
   # Edit .env with your database credentials
   # Note: For full stack setup, configure with your local database settings
   ```
4. **Set up database**

   ```bash
   # Create the WordPress performance database
   mysql -u root -p -e "CREATE DATABASE wordpress_performance;"
   ```
5. **Generate demo data**

   ```bash
   npm run seed:sample-data
   ```
6. **Start the application**

   ```bash
   npm start
   ```

The dashboard will be available at: http://localhost:3000

#### Option 2: Docker Setup

The project now provides two Docker Compose configurations:

**2a. Full Stack Setup** (includes WordPress + MySQL + Dashboard):

```bash
# Start the complete stack with WordPress and database
docker-compose -f docker-compose.full.yml up -d

# Access points:
# - WordPress: http://localhost:8080
# - Performance Dashboard: http://localhost:3000
```

**2b. Dashboard-Only Setup** (connects to external WordPress):

```bash
# Copy and configure environment file
cp .env.dashboard.example .env
# Edit .env with your WordPress API details

# Start dashboard-only configuration
docker-compose -f docker-compose.dashboard.yml up -d

# Access dashboard at: http://localhost:3000
```

**2c. Legacy Docker Setup** (using start.sh):

```bash
# Start with automatic port detection
./start.sh
```

For detailed setup instructions, see [DOCKER-SETUP.md](DOCKER-SETUP.md).

## 📡 API Endpoints

### Performance Metrics

- `GET /api/metrics` - Retrieve performance metrics
- `GET /api/slow-queries` - Get slow query analysis
- `GET /api/admin-ajax` - Admin-ajax usage statistics
- `GET /api/plugins` - Plugin performance data
- `GET /api/system-health` - System health overview
- `GET /api/realtime-metrics` - Real-time metrics snapshot

### Query Parameters

- `?limit=N` - Limit number of results
- `?timeRange=1h|6h|24h|7d` - Filter by time range

## 🎯 Dashboard Components

### 1. System Health Overview

- **Slow Queries Counter**: Number of slow queries in the last hour
- **Average Response Time**: Current system response time
- **Active Plugins**: Count of active WordPress plugins
- **System Status**: Overall health indicator

### 2. Performance Metrics Chart

- **Interactive Time Series**: Toggle between response time, memory usage, and queries per second
- **Time Range Selection**: View data for last 1 hour, 6 hours, 24 hours, or 7 days
- **Smooth Animations**: Elegant chart transitions and hover effects

### 3. Real-time Gauges

- **Queries per Second**: Live QPS monitoring with visual gauge
- **Response Time**: Current response time with threshold indicators
- **Memory Usage**: Real-time memory consumption tracking

### 4. Slow Query Analysis

- **Query Details**: Full query text with execution times
- **Performance Impact**: Rows examined and source file information
- **Syntax Highlighting**: Monospace font for better query readability

### 5. Plugin Performance Matrix

- **Impact Scoring**: Color-coded impact scores (0-100)
- **Resource Usage**: Memory consumption and query count per plugin
- **Load Time Analysis**: Plugin loading performance metrics

### 6. Admin-Ajax Monitoring

- **Call Frequency**: Most frequently called admin-ajax actions
- **Response Times**: Average response time per action
- **Performance Impact**: Total time spent on each action

### 7. Intelligent Recommendations

- **Query Optimization**: Suggestions for slow query improvements
- **Plugin Management**: Recommendations for high-impact plugins
- **Caching Strategies**: Performance optimization suggestions

## 🔧 Configuration

### Environment Variables

```env
# Database Configuration
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=password
DB_NAME=wordpress_performance

# Server Configuration
PORT=3000
NODE_ENV=production

# Monitoring Configuration
REFRESH_INTERVAL=5000
MAX_SLOW_QUERIES=20
```

### Docker Configuration

The project includes flexible Docker configurations for different deployment scenarios:

**Full Stack Deployment:**

- `docker-compose.full.yml` - Complete WordPress + MySQL + Dashboard setup
- `Dockerfile` - Application container definition

**Dashboard-Only Deployment:**

- `docker-compose.dashboard.yml` - Dashboard-only with external WordPress API support
- `.env.dashboard.example` - Environment template for external WordPress configuration

**Legacy Support:**

- `start.sh` - Automatic port detection and startup script
- `DOCKER-SETUP.md` - Comprehensive Docker setup documentation

## 📊 Database Schema

### Performance Metrics Table

```sql
CREATE TABLE performance_metrics (
  id INT AUTO_INCREMENT PRIMARY KEY,
  query_type VARCHAR(50),
  avg_execution_time FLOAT,
  total_queries INT,
  slow_queries INT,
  queries_per_second FLOAT,
  avg_response_time FLOAT,
  memory_usage FLOAT,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### Slow Queries Table

```sql
CREATE TABLE slow_queries (
  id INT AUTO_INCREMENT PRIMARY KEY,
  query_text TEXT,
  execution_time FLOAT,
  rows_examined INT,
  source_file VARCHAR(255),
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### Plugin Performance Table

```sql
CREATE TABLE plugin_performance (
  id INT AUTO_INCREMENT PRIMARY KEY,
  plugin_name VARCHAR(255),
  impact_score FLOAT,
  memory_usage FLOAT,
  query_count INT,
  status ENUM('active', 'inactive'),
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

## 🚀 WordPress Integration

### Direct Database Connection

Connect directly to your WordPress database for real-time monitoring:

```javascript
// Example configuration for WordPress database
const wpDbConfig = {
  host: 'your-wordpress-db-host',
  user: 'wp_user',
  password: 'wp_password',
  database: 'wordpress_db'
};
```

### Plugin Integration

For enhanced monitoring, install the companion WordPress plugin:

1. Tracks real-time query performance
2. Monitors plugin resource usage
3. Logs admin-ajax calls
4. Provides detailed performance metrics

## 📈 Performance Metrics

### Key Performance Indicators

- **Response Time**: Average HTTP response time
- **Query Performance**: Database query execution times
- **Memory Usage**: PHP memory consumption
- **Plugin Impact**: Resource usage by WordPress plugins
- **Cache Hit Ratio**: Effectiveness of caching layers

### Monitoring Thresholds

- **Slow Query**: > 1000ms execution time
- **High Memory**: > 256MB PHP memory usage
- **Heavy Plugin**: > 70 impact score
- **Poor Response**: > 2000ms response time

## 🛡️ Security Considerations

### Database Security

- Use dedicated monitoring database user
- Implement read-only permissions where possible
- Enable SSL/TLS for database connections
- Regular security updates

### Application Security

- Input validation and sanitization
- Rate limiting on API endpoints
- CORS configuration for production
- Environment variable protection

## 🔍 Troubleshooting

### Common Issues

1. **Database Connection Failed**

   - Check database credentials in .env file
   - Verify MySQL service is running
   - Ensure network connectivity to database host
2. **No Real-time Data**

   - Verify WebSocket connection (check browser console)
   - Ensure Socket.IO server is running
   - Check browser network tab for connection errors
3. **Missing Charts**

   - Confirm Chart.js is loaded (check network tab)
   - Check for JavaScript errors in browser console
   - Verify canvas elements exist in DOM
4. **Punycode Deprecation Warning**

   - This is a harmless warning from Node.js about the deprecated `punycode` module
   - The application will continue to work normally
   - Warning can be safely ignored: `(node:XXXX) [DEP0040] DeprecationWarning: The \`punycode\` module is deprecated. Please use a userland alternative instead.`
5. **Docker Issues**

   - Ensure Docker daemon is running
   - Check port conflicts with `docker ps`
   - Verify docker-compose file syntax

## 🏗️ Development

### Project Structure

```
wp-performance-dashboard/
├── public/              # Frontend assets
│   ├── index.html      # Main dashboard page
│   ├── css/            # Stylesheets
│   └── js/             # JavaScript files
├── scripts/            # Utility scripts
│   └── generate-demo-data.js # Demo data generator
├── src/                # Source files
│   └── server.js       # Alternative server implementation
├── tests/              # Test files
│   ├── docker-build.test.js
│   └── docker-functionality.test.js
├── demo/               # Demo assets
├── docs/               # Documentation
├── config/             # Configuration files
├── wp-content/         # WordPress content (themes/plugins)
├── .env.dashboard.example # Environment template for dashboard-only
├── docker-compose.full.yml    # Full stack deployment
├── docker-compose.dashboard.yml # Dashboard-only deployment
├── Dockerfile         # Container definition
├── DOCKER-SETUP.md    # Docker setup documentation
├── jest.config.js     # Test configuration
├── package.json       # Dependencies and scripts
├── server.js          # Main server file
└── README.md          # Documentation
```

### Available Scripts

```bash
npm start              # Start the WordPress Performance Dashboard server on port 3000
npm run seed:sample-data # Generate demo data (requires database connection)
npm test               # Run all tests (requires Docker Compose setup)
npm run test:docker    # Run Docker-specific tests (requires Docker Compose setup)
```

### Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Add tests if applicable
5. Commit your changes (`git commit -m 'Add amazing feature'`)
6. Push to the branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request

## 📋 Testing

The project includes comprehensive testing:

```bash
# Run all tests
npm test

# Run Docker-specific tests
npm run test:docker

# Generate test coverage
npm run test:coverage
```

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙋‍♂️ Support

For support and questions:

- **Documentation**: Check this README and the `/docs` folder
- **Issues**: Create an issue on GitHub
- **Discussions**: Use GitHub Discussions for questions
- **Troubleshooting**: Review the troubleshooting section above

## 🎯 Future Enhancements

- [ ] WordPress plugin for enhanced integration
- [ ] Alert system with email/SMS notifications
- [ ] Multi-site monitoring support
- [ ] Advanced filtering and search capabilities
- [ ] Performance benchmarking tools
- [ ] Custom dashboard layouts and themes
- [ ] Export functionality for reports (PDF/CSV)
- [ ] Integration with external monitoring services
- [ ] Historical data archiving
- [ ] API rate limiting and authentication
- [ ] Mobile app companion

---

**Built with ❤️ for WordPress Performance Optimization**

*Real-time monitoring for WordPress sites, because performance matters.*
