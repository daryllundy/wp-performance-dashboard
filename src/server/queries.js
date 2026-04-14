const { getTimeRangeInterval } = require('./validators');

async function queryMetrics(dbPool, { timeRange, limit }) {
  const interval = getTimeRangeInterval(timeRange);
  const sql = interval
    ? `SELECT * FROM performance_metrics WHERE timestamp > DATE_SUB(NOW(), INTERVAL ${interval}) ORDER BY timestamp DESC LIMIT ?`
    : 'SELECT * FROM performance_metrics ORDER BY timestamp DESC LIMIT ?';
  const [rows] = await dbPool.execute(sql, [limit]);
  return rows;
}

async function querySlowQueries(dbPool, { timeRange, limit }) {
  const interval = getTimeRangeInterval(timeRange);
  const sql = interval
    ? `SELECT * FROM slow_queries WHERE timestamp > DATE_SUB(NOW(), INTERVAL ${interval}) ORDER BY execution_time DESC LIMIT ?`
    : 'SELECT * FROM slow_queries ORDER BY execution_time DESC LIMIT ?';
  const [rows] = await dbPool.execute(sql, [limit]);
  return rows;
}

async function queryAdminAjax(dbPool, { timeRange, limit }) {
  const interval = getTimeRangeInterval(timeRange);
  const sql = interval
    ? `SELECT * FROM admin_ajax_calls WHERE timestamp > DATE_SUB(NOW(), INTERVAL ${interval}) ORDER BY call_count DESC LIMIT ?`
    : 'SELECT * FROM admin_ajax_calls ORDER BY call_count DESC LIMIT ?';
  const [rows] = await dbPool.execute(sql, [limit]);
  return rows;
}

async function queryPlugins(dbPool, { timeRange, limit, includeInactive }) {
  const interval = getTimeRangeInterval(timeRange);
  const clauses = [];
  if (!includeInactive) {
    clauses.push('status = "active"');
  }
  if (interval) {
    clauses.push(`timestamp > DATE_SUB(NOW(), INTERVAL ${interval})`);
  }
  const whereSql = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
  const sql = `SELECT * FROM plugin_performance ${whereSql} ORDER BY impact_score DESC LIMIT ?`;
  const [rows] = await dbPool.execute(sql, [limit]);
  return rows;
}

async function queryRealtimeMetrics(dbPool) {
  const [rows] = await dbPool.execute(
    'SELECT AVG(queries_per_second) as avg_qps, AVG(avg_response_time) as avg_response, AVG(memory_usage) as avg_memory FROM performance_metrics WHERE timestamp > DATE_SUB(NOW(), INTERVAL 5 MINUTE)'
  );
  return rows[0] || { avg_qps: 0, avg_response: 0, avg_memory: 0 };
}

async function queryLatestRealtimeSample(dbPool) {
  const [rows] = await dbPool.execute('SELECT * FROM performance_metrics ORDER BY timestamp DESC LIMIT 1');
  return rows[0] || null;
}

async function querySystemHealth(dbPool, { timeRange }) {
  const interval = getTimeRangeInterval(timeRange) || '1 HOUR';
  const [[queryCount]] = await dbPool.execute(
    `SELECT COUNT(*) as total FROM slow_queries WHERE timestamp > DATE_SUB(NOW(), INTERVAL ${interval})`
  );
  const [[pluginCount]] = await dbPool.execute(
    'SELECT COUNT(*) as total FROM plugin_performance WHERE status = "active"'
  );
  const [[avgResponse]] = await dbPool.execute(
    `SELECT AVG(avg_response_time) as avg FROM performance_metrics WHERE timestamp > DATE_SUB(NOW(), INTERVAL ${interval})`
  );
  const [systemHealthRows] = await dbPool.execute(
    'SELECT * FROM system_health ORDER BY timestamp DESC LIMIT 1'
  );

  const latestHealth = systemHealthRows[0] || {};
  const avgResponseTime = avgResponse.avg || 0;
  const cpuUsage = latestHealth.cpu_usage || 0;
  const memoryTotal = latestHealth.memory_total || 0;
  const memoryUsed = latestHealth.memory_used || 0;
  const status = avgResponseTime > 2000 || cpuUsage > 80 || memoryUsed > 0.8 * memoryTotal
    ? 'warning'
    : 'healthy';

  return {
    slow_queries_1h: queryCount.total,
    active_plugins: pluginCount.total,
    avg_response_time: avgResponseTime,
    cpu_usage: cpuUsage,
    memory_total: memoryTotal,
    memory_used: memoryUsed,
    memory_usage_percent: memoryTotal ? (memoryUsed / memoryTotal) * 100 : 0,
    disk_usage: latestHealth.disk_usage || 0,
    cache_hit_ratio: latestHealth.cache_hit_ratio || 0,
    active_connections: latestHealth.active_connections || 0,
    status
  };
}

async function queryDemoStatus(demoPool, { isDemoMode, fetchImpl }) {
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

  if (!demoPool) {
    return status;
  }

  try {
    await demoPool.execute('SELECT 1 as test');
    status.services.mysql = true;
    status.connection = 'mysql_connected';

    const [[demoData]] = await demoPool.execute('SELECT COUNT(*) as count FROM wp_posts WHERE post_status = "publish"');
    status.demoDataCount = demoData.count;

    if (fetchImpl) {
      try {
        const response = await fetchImpl('http://demo-nginx:80/');
        if (response && response.ok) {
          status.services.nginx = true;
          status.services.wordpress = true;
        }
      } catch (error) {
        // ignore wordpress/nginx probe failures
      }
    }

    status.available = true;
  } catch (error) {
    status.connection = `mysql_error: ${error.message}`;
  }

  return status;
}

module.exports = {
  queryAdminAjax,
  queryDemoStatus,
  queryLatestRealtimeSample,
  queryMetrics,
  queryPlugins,
  queryRealtimeMetrics,
  querySlowQueries,
  querySystemHealth
};
