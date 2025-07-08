const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const mysql = require('mysql2/promise');
const helmet = require('helmet');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Security middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// Database connection
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'wordpress_performance',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

const pool = mysql.createPool(dbConfig);

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

app.get('/api/metrics', async (req, res) => {
  try {
    const [rows] = await pool.execute(`
      SELECT 
        query_type,
        avg_execution_time,
        total_queries,
        slow_queries,
        timestamp
      FROM performance_metrics 
      ORDER BY timestamp DESC 
      LIMIT 100
    `);
    res.json(rows);
  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({ error: 'Database query failed' });
  }
});

app.get('/api/slow-queries', async (req, res) => {
  try {
    const [rows] = await pool.execute(`
      SELECT 
        query_text,
        execution_time,
        rows_examined,
        timestamp,
        source_file
      FROM slow_queries 
      ORDER BY execution_time DESC 
      LIMIT 50
    `);
    res.json(rows);
  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({ error: 'Database query failed' });
  }
});

app.get('/api/admin-ajax', async (req, res) => {
  try {
    const [rows] = await pool.execute(`
      SELECT 
        action_name,
        call_count,
        avg_response_time,
        total_time,
        timestamp
      FROM admin_ajax_calls 
      ORDER BY call_count DESC 
      LIMIT 100
    `);
    res.json(rows);
  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({ error: 'Database query failed' });
  }
});

app.get('/api/plugins', async (req, res) => {
  try {
    const [rows] = await pool.execute(`
      SELECT 
        plugin_name,
        impact_score,
        memory_usage,
        query_count,
        load_time,
        status
      FROM plugin_performance 
      ORDER BY impact_score DESC
    `);
    res.json(rows);
  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({ error: 'Database query failed' });
  }
});

// WebSocket connection
io.on('connection', (socket) => {
  console.log('Client connected');
  
  // Send real-time metrics every 5 seconds
  const metricsInterval = setInterval(async () => {
    try {
      const [metrics] = await pool.execute(`
        SELECT * FROM performance_metrics 
        ORDER BY timestamp DESC 
        LIMIT 1
      `);
      
      if (metrics.length > 0) {
        socket.emit('real-time-metrics', metrics[0]);
      }
    } catch (error) {
      console.error('Real-time metrics error:', error);
    }
  }, 5000);

  socket.on('disconnect', () => {
    console.log('Client disconnected');
    clearInterval(metricsInterval);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 WordPress Performance Dashboard running on port ${PORT}`);
  console.log(`📊 Dashboard: http://localhost:${PORT}`);
});
