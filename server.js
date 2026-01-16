const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const mysql = require('mysql2/promise');
const path = require('path');
const fetch = require('node-fetch');
const { spawn } = require('child_process');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Configuration
const useExternalWP = !!process.env.WP_API_URL;
const wpApiUrl = process.env.WP_API_URL;
const wpApiUsername = process.env.WP_API_USERNAME;
const wpApiPassword = process.env.WP_API_PASSWORD;

// Demo environment detection
const isDemoMode = process.env.DEMO_MODE === 'true' || process.env.NODE_ENV === 'demo';
const demoDbConfig = {
  host: 'demo-mysql',
  user: 'demo_user',
  password: 'demo_password',
  database: 'demo_wordpress',
  port: 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

// Database configuration
let pool = null;
let demoPool = null;

if (!useExternalWP) {
  const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'password',
    database: process.env.DB_NAME || 'wordpress_performance',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
  };
  pool = mysql.createPool(dbConfig);
}

// Initialize demo database connection if in demo mode or for demo detection
if (isDemoMode) {
  demoPool = mysql.createPool(demoDbConfig);
  console.log('🎭 Demo mode enabled - connecting to demo database');
} else {
  // Try to connect to demo database for detection (non-blocking)
  try {
    demoPool = mysql.createPool({...demoDbConfig, acquireTimeout: 2000, timeout: 2000});
  } catch (error) {
    console.log('Demo database not available for detection');
  }
}

// WordPress API helper functions
async function fetchFromWPApi(endpoint, method = 'GET', data = null) {
  if (!wpApiUrl) {
    throw new Error('WordPress API URL not configured');
  }

  const url = `${wpApiUrl}${endpoint}`;
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
    }
  };

  // Add basic auth if credentials are provided
  if (wpApiUsername && wpApiPassword) {
    const auth = Buffer.from(`${wpApiUsername}:${wpApiPassword}`).toString('base64');
    options.headers.Authorization = `Basic ${auth}`;
  }

  if (data && (method === 'POST' || method === 'PUT')) {
    options.body = JSON.stringify(data);
  }

  const response = await fetch(url, options);
  if (!response.ok) {
    throw new Error(`WP API request failed: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Helper function to get appropriate database pool
function getDbPool(req) {
  const useDemo = req.query.demo === 'true' || isDemoMode;
  return useDemo && demoPool ? demoPool : pool;
}

function getTimeRangeInterval(timeRange) {
  switch (timeRange) {
    case '1h':
      return '1 HOUR';
    case '6h':
      return '6 HOUR';
    case '24h':
      return '24 HOUR';
    case '7d':
      return '7 DAY';
    default:
      return null;
  }
}

// API Routes
app.get('/api/metrics', async (req, res) => {
  try {
    const timeRange = req.query.timeRange || '1h';
    const limit = req.query.limit || 50;
    const useDemo = req.query.demo === 'true' || isDemoMode;

    if (useExternalWP && !useDemo) {
      // Use WordPress API for external WordPress
      const data = await fetchFromWPApi(`/wp-json/wp-performance-dashboard/v1/metrics?timeRange=${timeRange}&limit=${limit}`);
      res.json(data);
    } else {
      // Use direct database query for local setup or demo
      const dbPool = getDbPool(req);
      if (!dbPool) {
        return res.status(400).json({ error: 'Database not available' });
      }

      const interval = getTimeRangeInterval(timeRange);
      const limitValue = parseInt(limit);
      const query = interval
        ? `SELECT * FROM performance_metrics WHERE timestamp > DATE_SUB(NOW(), INTERVAL ${interval}) ORDER BY timestamp DESC LIMIT ?`
        : 'SELECT * FROM performance_metrics ORDER BY timestamp DESC LIMIT ?';

      const [rows] = await dbPool.execute(query, [limitValue]);
      res.json(rows);
    }
  } catch (error) {
    console.error('Error fetching metrics:', error);
    res.status(500).json({ error: 'Failed to fetch metrics' });
  }
});

app.get('/api/slow-queries', async (req, res) => {
  try {
    const limit = req.query.limit || 20;
    const timeRange = req.query.timeRange || '1h';
    const useDemo = req.query.demo === 'true' || isDemoMode;

    if (useExternalWP && !useDemo) {
      // Use WordPress API for external WordPress
      const data = await fetchFromWPApi(`/wp-json/wp-performance-dashboard/v1/slow-queries?limit=${limit}&timeRange=${timeRange}`);
      res.json(data);
    } else {
      // Use direct database query for local setup or demo
      const dbPool = getDbPool(req);
      if (!dbPool) {
        return res.status(400).json({ error: 'Database not available' });
      }

      const interval = getTimeRangeInterval(timeRange);
      const limitValue = parseInt(limit);
      const query = interval
        ? 'SELECT * FROM slow_queries WHERE timestamp > DATE_SUB(NOW(), INTERVAL ' + interval + ') ORDER BY execution_time DESC LIMIT ?'
        : 'SELECT * FROM slow_queries ORDER BY execution_time DESC LIMIT ?';

      const [rows] = await dbPool.execute(query, [limitValue]);
      res.json(rows);
    }
  } catch (error) {
    console.error('Error fetching slow queries:', error);
    res.status(500).json({ error: 'Failed to fetch slow queries' });
  }
});

app.get('/api/admin-ajax', async (req, res) => {
  try {
    const timeRange = req.query.timeRange || '1h';
    const limit = req.query.limit || 20;
    const useDemo = req.query.demo === 'true' || isDemoMode;

    if (useExternalWP && !useDemo) {
      // Use WordPress API for external WordPress
      const data = await fetchFromWPApi(`/wp-json/wp-performance-dashboard/v1/admin-ajax?timeRange=${timeRange}&limit=${limit}`);
      res.json(data);
    } else {
      // Use direct database query for local setup or demo
      const dbPool = getDbPool(req);
      if (!dbPool) {
        return res.status(400).json({ error: 'Database not available' });
      }

      const interval = getTimeRangeInterval(timeRange);
      const limitValue = parseInt(limit);
      const query = interval
        ? 'SELECT * FROM admin_ajax_calls WHERE timestamp > DATE_SUB(NOW(), INTERVAL ' + interval + ') ORDER BY call_count DESC LIMIT ?'
        : 'SELECT * FROM admin_ajax_calls ORDER BY call_count DESC LIMIT ?';

      const [rows] = await dbPool.execute(query, [limitValue]);
      res.json(rows);
    }
  } catch (error) {
    console.error('Error fetching admin-ajax data:', error);
    res.status(500).json({ error: 'Failed to fetch admin-ajax data' });
  }
});

app.get('/api/plugins', async (req, res) => {
  try {
    const timeRange = req.query.timeRange || '1h';
    const limit = req.query.limit || 100;
    const includeInactive = req.query.includeInactive === 'true';
    const useDemo = req.query.demo === 'true' || isDemoMode;

    if (useExternalWP && !useDemo) {
      // Use WordPress API for external WordPress
      const data = await fetchFromWPApi(`/wp-json/wp-performance-dashboard/v1/plugins?timeRange=${timeRange}&limit=${limit}&includeInactive=${includeInactive}`);
      res.json(data);
    } else {
      // Use direct database query for local setup or demo
      const dbPool = getDbPool(req);
      if (!dbPool) {
        return res.status(400).json({ error: 'Database not available' });
      }

      const interval = getTimeRangeInterval(timeRange);
      const limitValue = parseInt(limit);
      const statusClause = includeInactive ? '' : 'status = "active"';
      const timeClause = interval ? 'timestamp > DATE_SUB(NOW(), INTERVAL ' + interval + ')' : '';
      const whereClauses = [statusClause, timeClause].filter(Boolean).join(' AND ');
      const whereSql = whereClauses ? `WHERE ${whereClauses}` : '';
      const query = `SELECT * FROM plugin_performance ${whereSql} ORDER BY impact_score DESC LIMIT ?`;

      const [rows] = await dbPool.execute(query, [limitValue]);
      res.json(rows);
    }
  } catch (error) {
    console.error('Error fetching plugin data:', error);
    res.status(500).json({ error: 'Failed to fetch plugin data' });
  }
});

// Real-time metrics endpoint
app.get('/api/realtime-metrics', async (req, res) => {
  try {
    const useDemo = req.query.demo === 'true' || isDemoMode;

    if (useExternalWP && !useDemo) {
      // Use WordPress API for external WordPress
      const data = await fetchFromWPApi('/wp-json/wp-performance-dashboard/v1/realtime-metrics');
      res.json(data);
    } else {
      // Use direct database query for local setup or demo
      const dbPool = getDbPool(req);
      if (!dbPool) {
        return res.status(400).json({ error: 'Database not available' });
      }

      const [metrics] = await dbPool.execute(
        'SELECT AVG(queries_per_second) as avg_qps, AVG(avg_response_time) as avg_response, AVG(memory_usage) as avg_memory FROM performance_metrics WHERE timestamp > DATE_SUB(NOW(), INTERVAL 5 MINUTE)'
      );
      res.json(metrics[0] || { avg_qps: 0, avg_response: 0, avg_memory: 0 });
    }
  } catch (error) {
    console.error('Error fetching realtime metrics:', error);
    res.status(500).json({ error: 'Failed to fetch realtime metrics' });
  }
});

// System health endpoint
app.get('/api/system-health', async (req, res) => {
  try {
    const timeRange = req.query.timeRange || '1h';
    const useDemo = req.query.demo === 'true' || isDemoMode;

    if (useExternalWP && !useDemo) {
      // Use WordPress API for external WordPress
      const data = await fetchFromWPApi(`/wp-json/wp-performance-dashboard/v1/system-health?timeRange=${timeRange}`);
      res.json(data);
    } else {
      // Use direct database query for local setup or demo
      const dbPool = getDbPool(req);
      if (!dbPool) {
        return res.status(400).json({ error: 'Database not available' });
      }

      const interval = getTimeRangeInterval(timeRange) || '1 HOUR';
      const [queryCount] = await dbPool.execute(
        'SELECT COUNT(*) as total FROM slow_queries WHERE timestamp > DATE_SUB(NOW(), INTERVAL ' + interval + ')'
      );
      const [pluginCount] = await dbPool.execute(
        'SELECT COUNT(*) as total FROM plugin_performance WHERE status = "active"'
      );
      const [avgResponse] = await dbPool.execute(
        'SELECT AVG(avg_response_time) as avg FROM performance_metrics WHERE timestamp > DATE_SUB(NOW(), INTERVAL ' + interval + ')'
      );
      const [systemHealth] = await dbPool.execute(
        'SELECT * FROM system_health ORDER BY timestamp DESC LIMIT 1'
      );

      const latestHealth = systemHealth[0] || {};
      const avgResponseTime = avgResponse[0].avg || 0;
      const cpuUsage = latestHealth.cpu_usage || 0;
      const memoryTotal = latestHealth.memory_total || 0;
      const memoryUsed = latestHealth.memory_used || 0;
      const diskUsage = latestHealth.disk_usage || 0;
      const cacheHitRatio = latestHealth.cache_hit_ratio || 0;

      const status = avgResponseTime > 2000 || cpuUsage > 80 || memoryUsed > 0.8 * memoryTotal
        ? 'warning'
        : 'healthy';

      res.json({
        slow_queries_1h: queryCount[0].total,
        active_plugins: pluginCount[0].total,
        avg_response_time: avgResponseTime,
        cpu_usage: cpuUsage,
        memory_total: memoryTotal,
        memory_used: memoryUsed,
        memory_usage_percent: memoryTotal ? (memoryUsed / memoryTotal) * 100 : 0,
        disk_usage: diskUsage,
        cache_hit_ratio: cacheHitRatio,
        active_connections: latestHealth.active_connections || 0,
        status,
        demo_mode: useDemo
      });
    }
  } catch (error) {
    console.error('Error fetching system health:', error);
    res.status(500).json({ error: 'Failed to fetch system health' });
  }
});

// Demo environment status endpoint
app.get('/api/demo-status', async (req, res) => {
  try {
    const status = {
      available: false,
      services: {
        mysql: false,
        wordpress: false,
        nginx: false
      },
      mode: isDemoMode ? 'active' : 'detection',
      connection: null,
      lastCheck: new Date().toISOString()
    };

    if (demoPool) {
      try {
        // Test demo database connection
        const [rows] = await demoPool.execute('SELECT 1 as test');
        status.services.mysql = true;
        status.connection = 'mysql_connected';
        
        // Check for demo data presence
        const [demoData] = await demoPool.execute('SELECT COUNT(*) as count FROM wp_posts WHERE post_status = "publish"');
        status.demoDataCount = demoData[0].count;
        
        // Test WordPress service (if accessible)
        try {
          const response = await fetch('http://demo-nginx:80/', { timeout: 2000 });
          if (response.ok) {
            status.services.nginx = true;
            status.services.wordpress = true;
          }
        } catch (wpError) {
          // WordPress/Nginx not accessible, but MySQL is working
        }
        
        status.available = status.services.mysql;
      } catch (dbError) {
        status.connection = `mysql_error: ${dbError.message}`;
      }
    }

    res.json(status);
  } catch (error) {
    console.error('Error checking demo status:', error);
    res.status(500).json({ 
      error: 'Failed to check demo status',
      available: false,
      mode: isDemoMode ? 'active' : 'detection',
      lastCheck: new Date().toISOString()
    });
  }
});

// Demo data refresh endpoint
app.post('/api/demo-refresh', async (req, res) => {
  try {
    if (!demoPool) {
      return res.status(400).json({ error: 'Demo environment not available' });
    }

    // Trigger demo data regeneration
    const refreshProcess = spawn('node', ['/app/demo/scripts/generate-demo-data.js'], {
      env: {
        ...process.env,
        DB_HOST: 'demo-mysql',
        DB_USER: 'demo_user',
        DB_PASSWORD: 'demo_password',
        DB_NAME: 'demo_wordpress'
      }
    });

    let output = '';
    refreshProcess.stdout.on('data', (data) => {
      output += data.toString();
    });

    refreshProcess.on('close', (code) => {
      if (code === 0) {
        res.json({ 
          success: true, 
          message: 'Demo data refreshed successfully',
          output: output.slice(-500) // Last 500 chars of output
        });
      } else {
        res.status(500).json({ 
          error: 'Demo data refresh failed', 
          code: code,
          output: output.slice(-500)
        });
      }
    });

    // Timeout after 30 seconds
    setTimeout(() => {
      refreshProcess.kill();
      res.status(408).json({ error: 'Demo refresh timeout' });
    }, 30000);

  } catch (error) {
    console.error('Error refreshing demo data:', error);
    res.status(500).json({ error: 'Failed to refresh demo data' });
  }
});

// Health check endpoint for Docker
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    demoMode: isDemoMode,
    demoAvailable: !!demoPool
  });
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
    if (useExternalWP && !isDemoMode) {
      // Use WordPress API for external WordPress
      const data = await fetchFromWPApi('/wp-json/wp-performance-dashboard/v1/realtime-metrics');
      if (data && data.queries_per_second !== undefined) {
        io.emit('real-time-metrics', {
          queries_per_second: data.queries_per_second,
          avg_response_time: data.avg_response_time,
          memory_usage: data.memory_usage,
          timestamp: data.timestamp || new Date().toISOString(),
          demo_mode: false
        });
      }
    } else {
      // Use direct database query for local setup or demo
      const dbPool = isDemoMode && demoPool ? demoPool : pool;
      if (dbPool) {
        const [metrics] = await dbPool.execute(
          'SELECT * FROM performance_metrics ORDER BY timestamp DESC LIMIT 1'
        );

        if (metrics.length > 0) {
          const latestMetrics = metrics[0];
          io.emit('real-time-metrics', {
            queries_per_second: latestMetrics.queries_per_second,
            avg_response_time: latestMetrics.avg_response_time,
            memory_usage: latestMetrics.memory_usage,
            timestamp: latestMetrics.timestamp,
            demo_mode: isDemoMode
          });
        }
      }
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
