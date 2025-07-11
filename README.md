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
- **Node.js/Express**: High-performance web server
- **MySQL**: Database for storing performance metrics
- **Socket.IO**: Real-time bidirectional communication
- **Connection Pooling**: Efficient database connection management

### Frontend
- **Vanilla JavaScript**: No heavy frameworks, optimized for performance
- **Chart.js**: Advanced charting library for data visualization
- **CSS Grid/Flexbox**: Modern CSS layout techniques
- **WebSocket Integration**: Real-time data updates

## � Quick Start

### Prerequisites
- Node.js 16+ and npm
- MySQL 8.0+
- Docker and Docker Compose (optional)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-username/wp-performance-dashboard.git
   cd wp-performance-dashboard
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your database credentials
   ```

4. **Generate demo data**
   ```bash
   npm run seed:sample-data
   ```

5. **Start the application**
   ```bash
   ./start.sh
   ```

### Docker Setup

For quick deployment using Docker:

```bash
# Start with automatic port detection
./start.sh

# Or manually with docker-compose
docker-compose up
```

## � API Endpoints

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
The project includes Docker configuration for easy deployment:
- `Dockerfile` - Application container
- `docker-compose.yml` - Full stack deployment
- `start.sh` - Automatic port detection and startup

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
   - Check database credentials
   - Verify MySQL service is running
   - Ensure network connectivity

2. **No Real-time Data**
   - Verify WebSocket connection
   - Check browser console for errors
   - Ensure proper port configuration

3. **Missing Charts**
   - Confirm Chart.js is loaded
   - Check for JavaScript errors
   - Verify canvas element exists

## � Development

### Project Structure
```
wp-performance-dashboard/
├── public/              # Frontend assets
│   ├── index.html      # Main dashboard page
│   ├── css/            # Stylesheets
│   └── js/             # JavaScript files
├── scripts/            # Utility scripts
├── server.js           # Main server file
├── package.json        # Dependencies
└── README.md          # Documentation
```

### Contributing
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## � License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙋‍♂️ Support

For support and questions:
- Create an issue on GitHub
- Check the documentation
- Review the troubleshooting guide

## 🎯 Future Enhancements

- [ ] WordPress plugin for enhanced integration
- [ ] Alert system with email notifications
- [ ] Multi-site monitoring support
- [ ] Advanced filtering and search
- [ ] Performance benchmarking
- [ ] Custom dashboard layouts
- [ ] Export functionality for reports
- [ ] Integration with external monitoring services

---

**Built with ❤️ for WordPress Performance Optimization**
