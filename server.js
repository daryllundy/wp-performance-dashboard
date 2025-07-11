const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Database configuration
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'password',
  database: process.env.DB_NAME || 'wordpress_performance',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

// Create database connection pool
const pool = mysql.createPool(dbConfig);

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// API Routes
app.get('/api/metrics', async (req, res) => {
  try {
    const timeRange = req.query.timeRange || '1h';
    const limit = req.query.limit || 50;

    const [rows] = await pool.execute(
      'SELECT * FROM performance_metrics ORDER BY timestamp DESC LIMIT ?',
      [parseInt(limit)]
    );
    res.json(rows);
  } catch (error) {
    console.error('Error fetching metrics:', error);
    res.status(500).json({ error: 'Failed to fetch metrics' });
  }
});

app.get('/api/slow-queries', async (req, res) => {
  try {
    const limit = req.query.limit || 20;
    const [rows] = await pool.execute(
      'SELECT * FROM slow_queries ORDER BY execution_time DESC LIMIT ?',
      [parseInt(limit)]
    );
    res.json(rows);
  } catch (error) {
    console.error('Error fetching slow queries:', error);
    res.status(500).json({ error: 'Failed to fetch slow queries' });
  }
});

app.get('/api/admin-ajax', async (req, res) => {
  try {
    const [rows] = await pool.execute(
      'SELECT * FROM admin_ajax_calls ORDER BY call_count DESC LIMIT 20'
    );
    res.json(rows);
  } catch (error) {
    console.error('Error fetching admin-ajax data:', error);
    res.status(500).json({ error: 'Failed to fetch admin-ajax data' });
  }
});

app.get('/api/plugins', async (req, res) => {
  try {
    const [rows] = await pool.execute(
      'SELECT * FROM plugin_performance ORDER BY impact_score DESC'
    );
    res.json(rows);
  } catch (error) {
    console.error('Error fetching plugin data:', error);
    res.status(500).json({ error: 'Failed to fetch plugin data' });
  }
});

// Real-time metrics endpoint
app.get('/api/realtime-metrics', async (req, res) => {
  try {
    const [metrics] = await pool.execute(
      'SELECT AVG(queries_per_second) as avg_qps, AVG(avg_response_time) as avg_response, AVG(memory_usage) as avg_memory FROM performance_metrics WHERE timestamp > DATE_SUB(NOW(), INTERVAL 5 MINUTE)'
    );
    res.json(metrics[0] || { avg_qps: 0, avg_response: 0, avg_memory: 0 });
  } catch (error) {
    console.error('Error fetching realtime metrics:', error);
    res.status(500).json({ error: 'Failed to fetch realtime metrics' });
  }
});

// System health endpoint
app.get('/api/system-health', async (req, res) => {
  try {
    const [queryCount] = await pool.execute('SELECT COUNT(*) as total FROM slow_queries WHERE timestamp > DATE_SUB(NOW(), INTERVAL 1 HOUR)');
    const [pluginCount] = await pool.execute('SELECT COUNT(*) as total FROM plugin_performance WHERE status = "active"');
    const [avgResponse] = await pool.execute('SELECT AVG(avg_response_time) as avg FROM performance_metrics WHERE timestamp > DATE_SUB(NOW(), INTERVAL 1 HOUR)');

    res.json({
      slow_queries_1h: queryCount[0].total,
      active_plugins: pluginCount[0].total,
      avg_response_time: avgResponse[0].avg || 0,
      status: 'healthy'
    });
  } catch (error) {
    console.error('Error fetching system health:', error);
    res.status(500).json({ error: 'Failed to fetch system health' });
  }
});

// WebSocket connection handling
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Real-time data broadcasting
setInterval(async () => {
  try {
    const [metrics] = await pool.execute(
      'SELECT * FROM performance_metrics ORDER BY timestamp DESC LIMIT 1'
    );

    if (metrics.length > 0) {
      const latestMetrics = metrics[0];
      io.emit('real-time-metrics', {
        queries_per_second: latestMetrics.queries_per_second,
        avg_response_time: latestMetrics.avg_response_time,
        memory_usage: latestMetrics.memory_usage,
        timestamp: latestMetrics.timestamp
      });
    }
  } catch (error) {
    console.error('Error broadcasting real-time data:', error);
  }
}, 5000); // Broadcast every 5 seconds

// Serve the main dashboard
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 WordPress Performance Dashboard running on port ${PORT}`);
  console.log(`📊 Dashboard available at: http://localhost:${PORT}`);
});
