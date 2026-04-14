const request = require('supertest');
const fetch = require('node-fetch');
const { createApp } = require('../../src/server/app');
const { createRealtimeBroadcaster } = require('../../src/server/realtime');

function createFakePool() {
  return {
    async execute(sql, params = []) {
      if (sql.includes('FROM performance_metrics') && sql.includes('AVG(')) {
        return [[{ avg_qps: 10, avg_response: 150, avg_memory: 64 }]];
      }
      if (sql.includes('FROM performance_metrics') && sql.includes('LIMIT 1')) {
        return [[{ queries_per_second: 12, avg_response_time: 180, memory_usage: 72, timestamp: '2026-01-01T00:00:00.000Z' }]];
      }
      if (sql.includes('FROM performance_metrics')) {
        return [[
          { timestamp: '2026-01-01T00:00:00.000Z', avg_response_time: 150, memory_usage: 64, queries_per_second: 12 }
        ]];
      }
      if (sql.includes('FROM slow_queries') && sql.includes('COUNT(*)')) {
        return [[{ total: 2 }]];
      }
      if (sql.includes('FROM slow_queries')) {
        return [[
          { query_text: 'SELECT * FROM wp_posts', execution_time: 321, rows_examined: 1200, source_file: 'wp-db.php', timestamp: '2026-01-01T00:00:00.000Z' }
        ]];
      }
      if (sql.includes('FROM admin_ajax_calls')) {
        return [[
          { action_name: 'heartbeat', call_count: 14, avg_response_time: 120, total_time: 1680, timestamp: '2026-01-01T00:00:00.000Z' }
        ]];
      }
      if (sql.includes('FROM plugin_performance') && sql.includes('COUNT(*)')) {
        return [[{ total: 7 }]];
      }
      if (sql.includes('FROM plugin_performance')) {
        return [[
          { plugin_name: 'Object Cache Pro', impact_score: 18, memory_usage: 12, query_count: 3, load_time: 45, status: 'active', timestamp: '2026-01-01T00:00:00.000Z' }
        ]];
      }
      if (sql.includes('FROM system_health')) {
        return [[{ cpu_usage: 31, memory_total: 512, memory_used: 192, disk_usage: 41, cache_hit_ratio: 93, active_connections: 14 }]];
      }
      if (sql.includes('SELECT 1 as test')) {
        return [[{ test: 1 }]];
      }
      if (sql.includes('FROM wp_posts')) {
        return [[{ count: 4 }]];
      }
      if (sql.includes('AVG(avg_response_time)')) {
        return [[{ avg: 150 }]];
      }
      return [[]];
    },
    end: jest.fn().mockResolvedValue(undefined)
  };
}

function createTestRuntime(overrides = {}) {
  const config = {
    port: 0,
    isDemoMode: true,
    allowDemoDetection: true,
    useExternalWP: false,
    debugMonitoring: false,
    adminToken: 'secret-token',
    corsOrigins: ['http://localhost:3000'],
    jsonLimit: '100kb',
    rateLimitWindowMs: 60000,
    rateLimitMaxRequests: 3,
    realtimeIntervalMs: 5000,
    snapshotItemLimits: { metrics: 200, slowQueries: 100, adminAjax: 100, plugins: 100 },
    db: { host: 'localhost' },
    demoDb: { host: 'demo-mysql', user: 'demo_user', password: 'demo_password', database: 'demo_wordpress' },
    wpApi: null,
    ...overrides.config
  };

  const pools = overrides.pools || {
    primary: createFakePool(),
    demo: createFakePool()
  };

  return createApp({
    config,
    pools,
    fetchImpl: overrides.fetchImpl || jest.fn().mockResolvedValue({ ok: true }),
    spawnDemoRefresh: overrides.spawnDemoRefresh || jest.fn().mockResolvedValue({ success: true, message: 'ok', output: '' })
  });
}

describe('server app', () => {
  test('returns aggregated dashboard payload', async () => {
    const runtime = createTestRuntime();
    const response = await request(runtime.app).get('/api/dashboard?demo=true&timeRange=1h');

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('metrics');
    expect(response.body).toHaveProperty('slowQueries');
    expect(response.body).toHaveProperty('adminAjax');
    expect(response.body).toHaveProperty('plugins');
    expect(response.body).toHaveProperty('systemHealth');
    expect(response.body.meta.demo).toBe(true);
  });

  test('rejects invalid timeRange and limit', async () => {
    const runtime = createTestRuntime();
    const badTimeRange = await request(runtime.app).get('/api/dashboard?timeRange=2h&demo=true');
    const badLimit = await request(runtime.app).get('/api/metrics?timeRange=1h&limit=5000&demo=true');

    expect(badTimeRange.status).toBe(400);
    expect(badLimit.status).toBe(400);
  });

  test('requires auth for demo refresh', async () => {
    const runtime = createTestRuntime();
    const response = await request(runtime.app).post('/api/demo-refresh');

    expect(response.status).toBe(401);
  });

  test('blocks concurrent demo refresh requests', async () => {
    let releaseRefresh;
    const spawnDemoRefresh = jest.fn().mockImplementation(() => new Promise((resolve) => {
      releaseRefresh = resolve;
    }));
    const runtime = createTestRuntime({ spawnDemoRefresh });
    await runtime.start(0);
    const port = runtime.server.address().port;

    const firstRequest = fetch(`http://127.0.0.1:${port}/api/demo-refresh`, {
      method: 'POST',
      headers: { 'x-admin-token': 'secret-token' }
    });

    await new Promise((resolve) => setTimeout(resolve, 50));

    const secondResponse = await fetch(`http://127.0.0.1:${port}/api/demo-refresh`, {
      method: 'POST',
      headers: { 'x-admin-token': 'secret-token' }
    });

    releaseRefresh({ success: true, message: 'done', output: '' });
    const firstResponse = await firstRequest;
    await runtime.stop();

    expect(firstResponse.status).toBe(200);
    expect(secondResponse.status).toBe(409);
  });

  test('realtime broadcaster stays idle without clients', async () => {
    jest.useFakeTimers();
    const io = { emit: jest.fn() };
    const broadcaster = createRealtimeBroadcaster({
      io,
      config: { realtimeIntervalMs: 5000 },
      getRealtimePayload: jest.fn().mockResolvedValue({ ok: true })
    });

    jest.advanceTimersByTime(20000);
    expect(io.emit).not.toHaveBeenCalled();

    const handlers = {};
    broadcaster.handleConnection({ on(event, handler) { handlers[event] = handler; } });
    jest.advanceTimersByTime(5000);
    await Promise.resolve();
    expect(io.emit).toHaveBeenCalled();

    handlers.disconnect();
    io.emit.mockClear();
    jest.advanceTimersByTime(10000);
    expect(io.emit).not.toHaveBeenCalled();
    jest.useRealTimers();
  });
});
