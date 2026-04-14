const { createApp } = require('../../src/server/app');

function createFakePool() {
  return {
    async execute(sql) {
      if (sql.includes('FROM performance_metrics') && sql.includes('AVG(')) {
        return [[{ avg_qps: 18, avg_response: 142, avg_memory: 96 }]];
      }
      if (sql.includes('FROM performance_metrics') && sql.includes('LIMIT 1')) {
        return [[{ queries_per_second: 21, avg_response_time: 155, memory_usage: 104, timestamp: '2026-01-01T00:00:00.000Z' }]];
      }
      if (sql.includes('FROM performance_metrics')) {
        return [[
          { timestamp: '2026-01-01T00:00:00.000Z', avg_response_time: 140, memory_usage: 90, queries_per_second: 20 },
          { timestamp: '2026-01-01T00:05:00.000Z', avg_response_time: 155, memory_usage: 104, queries_per_second: 21 }
        ]];
      }
      if (sql.includes('FROM slow_queries') && sql.includes('COUNT(*)')) {
        return [[{ total: 3 }]];
      }
      if (sql.includes('FROM slow_queries')) {
        return [[
          { query_text: 'SELECT * FROM wp_posts WHERE post_status = "publish"', execution_time: 340, rows_examined: 1200, source_file: 'wp-db.php', timestamp: '2026-01-01T00:00:00.000Z' },
          { query_text: 'SELECT * FROM wp_options WHERE autoload = "yes"', execution_time: 290, rows_examined: 400, source_file: 'option.php', timestamp: '2026-01-01T00:01:00.000Z' }
        ]];
      }
      if (sql.includes('FROM admin_ajax_calls')) {
        return [[
          { action_name: 'heartbeat', call_count: 22, avg_response_time: 120, total_time: 2640, timestamp: '2026-01-01T00:00:00.000Z' },
          { action_name: 'save-widget', call_count: 8, avg_response_time: 240, total_time: 1920, timestamp: '2026-01-01T00:01:00.000Z' }
        ]];
      }
      if (sql.includes('FROM plugin_performance') && sql.includes('COUNT(*)')) {
        return [[{ total: 9 }]];
      }
      if (sql.includes('FROM plugin_performance')) {
        return [[
          { plugin_name: 'Object Cache Pro', impact_score: 24, memory_usage: 16, query_count: 3, load_time: 52, status: 'active', timestamp: '2026-01-01T00:00:00.000Z' },
          { plugin_name: 'WooCommerce', impact_score: 72, memory_usage: 48, query_count: 14, load_time: 210, status: 'active', timestamp: '2026-01-01T00:01:00.000Z' }
        ]];
      }
      if (sql.includes('FROM system_health')) {
        return [[{ cpu_usage: 34, memory_total: 512, memory_used: 224, disk_usage: 42, cache_hit_ratio: 91, active_connections: 12 }]];
      }
      if (sql.includes('SELECT 1 as test')) {
        return [[{ test: 1 }]];
      }
      if (sql.includes('FROM wp_posts')) {
        return [[{ count: 4 }]];
      }
      if (sql.includes('AVG(avg_response_time)')) {
        return [[{ avg: 142 }]];
      }
      return [[]];
    },
    async end() {}
  };
}

async function main() {
  const runtime = createApp({
    config: {
      port: 3100,
      isDemoMode: false,
      allowDemoDetection: true,
      useExternalWP: false,
      debugMonitoring: false,
      adminToken: 'browser-secret',
      corsOrigins: ['http://127.0.0.1:3100', 'http://localhost:3100'],
      jsonLimit: '100kb',
      rateLimitWindowMs: 60000,
      rateLimitMaxRequests: 3,
      realtimeIntervalMs: 1000,
      snapshotItemLimits: { metrics: 200, slowQueries: 100, adminAjax: 100, plugins: 100 },
      db: { host: 'localhost', user: 'root', password: '', database: 'wordpress_performance', port: 3306, waitForConnections: true, connectionLimit: 1, queueLimit: 0 },
      demoDb: { host: 'demo-mysql', user: 'demo_user', password: 'demo_password', database: 'demo_wordpress', port: 3306, waitForConnections: true, connectionLimit: 1, queueLimit: 0 },
      wpApi: null
    },
    pools: {
      primary: createFakePool(),
      demo: createFakePool()
    },
    spawnDemoRefresh: async () => ({ success: true, message: 'Demo data refreshed successfully', output: '' })
  });

  await runtime.start(3100);
  console.log('browser-mock-server listening on 3100');

  async function shutdown() {
    await runtime.stop();
    process.exit(0);
  }

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
