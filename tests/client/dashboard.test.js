const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

function loadScript(window, relativePath) {
  const script = fs.readFileSync(path.join(__dirname, '../../public/js', relativePath), 'utf8');
  window.eval(script);
}

function setupDom() {
  const dom = new JSDOM(`<!doctype html>
  <html>
    <body>
      <div id="connection-status"></div>
      <div id="demo-indicator"></div>
      <div id="demo-controls"></div>
      <button id="demo-toggle"></button>
      <button id="demo-refresh"></button>
      <button id="refreshBtn"></button>
      <div id="demo-status"></div>
      <div id="environment-label"></div>
      <div id="dashboard-alert" hidden></div>
      <div id="live-region"></div>
      <div id="last-updated"></div>
      <div id="snapshot-status"></div>
      <select id="timeRange"><option value="1h" selected>Last 1 Hour</option></select>
      <div id="slowQueries" style="height:100px; overflow:auto"></div>
      <div id="pluginPerformance" style="height:100px; overflow:auto"></div>
      <div id="recommendations"></div>
      <div id="slow-query-count"></div>
      <div id="slow-queries-state"></div>
      <div id="plugin-count"></div>
      <div id="plugins-state"></div>
      <div id="health-slow-queries"></div>
      <div id="health-avg-response"></div>
      <div id="health-cpu-usage"></div>
      <div id="health-memory-usage"></div>
      <div id="health-disk-usage"></div>
      <div id="health-cache-hit"></div>
      <div id="health-active-plugins"></div>
      <div id="health-status"></div>
      <div id="qps-value"></div>
      <div id="response-value"></div>
      <div id="memory-value"></div>
      <button class="metric-toggle active" data-metric="avg_response_time"></button>
      <button class="metric-toggle" data-metric="queries_per_second"></button>
      <canvas id="performanceChart"></canvas>
      <canvas id="adminAjaxChart"></canvas>
      <canvas id="qpsGauge"></canvas>
      <canvas id="responseGauge"></canvas>
      <canvas id="memoryGauge"></canvas>
    </body>
  </html>`, { url: 'http://localhost' , runScripts: 'dangerously' });

  const { window } = dom;
  global.window = window;
  global.document = window.document;
  global.performance = window.performance;
  global.navigator = window.navigator;
  global.fetch = jest.fn();
  window.fetch = global.fetch;
  window.Chart = function MockChart() {
    return {
      data: { labels: [], datasets: [{ data: [] }] },
      update: jest.fn(),
      destroy: jest.fn()
    };
  };
  window.io = jest.fn(() => ({ on: jest.fn(), disconnect: jest.fn() }));
  window.HTMLCanvasElement.prototype.getContext = jest.fn(() => ({}));
  return dom;
}

describe('dashboard lifecycle', () => {
  let dom;

  beforeEach(() => {
    jest.useFakeTimers();
    dom = setupDom();
    loadScript(window, 'content-management.js');
    loadScript(window, 'performance-monitor.js');
    loadScript(window, 'state.js');
    loadScript(window, 'api.js');
    loadScript(window, 'renderers.js');
    loadScript(window, 'realtime.js');
    loadScript(window, 'bootstrap.js');
  });

  afterEach(() => {
    jest.useRealTimers();
    dom.window.close();
    delete global.window;
    delete global.document;
    delete global.fetch;
  });

  test('loads one snapshot request and renders bounded list content', async () => {
    const snapshot = {
      metrics: [{ timestamp: '2026-01-01T00:00:00.000Z', avg_response_time: 150, queries_per_second: 12, memory_usage: 64 }],
      slowQueries: new Array(25).fill(null).map((_, index) => ({ query_text: `SELECT ${index}`, execution_time: 100 + index, rows_examined: 10, source_file: 'wp-db.php' })),
      adminAjax: [{ action_name: 'heartbeat', call_count: 4 }],
      plugins: new Array(60).fill(null).map((_, index) => ({ plugin_name: `Plugin ${index}`, impact_score: index, memory_usage: 10, query_count: 2, load_time: 40 })),
      systemHealth: { slow_queries_1h: 2, avg_response_time: 150, cpu_usage: 20, memory_used: 128, memory_total: 512, disk_usage: 40, cache_hit_ratio: 90, active_plugins: 8, status: 'healthy' },
      meta: { generatedAt: '2026-01-01T00:00:00.000Z', demo: false }
    };
    const demoStatus = { available: true };

    global.fetch.mockImplementation(async (url) => {
      if (url === '/api/demo-status') {
        return { ok: true, json: async () => demoStatus };
      }
      if (String(url).startsWith('/api/dashboard')) {
        return { ok: true, json: async () => snapshot };
      }
      throw new Error(`Unexpected URL: ${url}`);
    });

    const app = window.WPDashboard.createDashboardApp({ refreshMs: 30000, demoStatusMs: 30000 });
    app.start();
    await app.refreshDemoStatus();
    await app.loadSnapshot();

    expect(global.fetch).toHaveBeenCalled();
    expect(document.getElementById('slowQueries').children.length).toBe(20);
    expect(document.getElementById('pluginPerformance').children.length).toBe(50);
    expect(document.getElementById('health-status').textContent).toBe('healthy');
    app.stop();
  });

  test('stop clears timers and hidden tab pauses polling', async () => {
    global.fetch
      .mockResolvedValue({ ok: true, json: async () => ({ available: false, metrics: [], slowQueries: [], adminAjax: [], plugins: [], systemHealth: {}, meta: { generatedAt: new Date().toISOString() } }) });

    const app = window.WPDashboard.createDashboardApp({ refreshMs: 1000, demoStatusMs: 1000 });
    app.start();
    await Promise.resolve();
    const callCountAfterStart = global.fetch.mock.calls.length;

    Object.defineProperty(document, 'hidden', { value: true, configurable: true });
    document.dispatchEvent(new window.Event('visibilitychange'));
    jest.advanceTimersByTime(5000);
    expect(global.fetch.mock.calls.length).toBe(callCountAfterStart);

    app.stop();
    jest.advanceTimersByTime(5000);
    expect(global.fetch.mock.calls.length).toBe(callCountAfterStart);
  });

  test('failed refresh keeps existing content and exposes non-blocking error state', async () => {
    const snapshot = {
      metrics: [{ timestamp: '2026-01-01T00:00:00.000Z', avg_response_time: 150, queries_per_second: 12, memory_usage: 64 }],
      slowQueries: [{ query_text: 'SELECT 1', execution_time: 101, rows_examined: 10, source_file: 'wp-db.php' }],
      adminAjax: [{ action_name: 'heartbeat', call_count: 4 }],
      plugins: [{ plugin_name: 'Plugin 1', impact_score: 12, memory_usage: 10, query_count: 2, load_time: 40 }],
      systemHealth: { slow_queries_1h: 1, avg_response_time: 150, cpu_usage: 20, memory_used: 128, memory_total: 512, disk_usage: 40, cache_hit_ratio: 90, active_plugins: 8, status: 'healthy' },
      meta: { generatedAt: '2026-01-01T00:00:00.000Z', demo: false }
    };

    let dashboardCallCount = 0;
    global.fetch.mockImplementation(async (url) => {
      if (url === '/api/demo-status') {
        return { ok: true, json: async () => ({ available: true }) };
      }
      if (String(url).startsWith('/api/dashboard')) {
        dashboardCallCount += 1;
        if (dashboardCallCount === 1) {
          return { ok: true, json: async () => snapshot };
        }
        return { ok: false, json: async () => ({ error: 'Snapshot unavailable' }) };
      }
      throw new Error(`Unexpected URL: ${url}`);
    });

    const app = window.WPDashboard.createDashboardApp({ refreshMs: 30000, demoStatusMs: 30000 });
    app.start();
    await app.refreshDemoStatus();
    await app.loadSnapshot();
    expect(document.getElementById('slowQueries').children.length).toBe(1);

    await app.loadSnapshot();

    expect(document.getElementById('slowQueries').children.length).toBe(1);
    expect(document.getElementById('dashboard-alert').hidden).toBe(false);
    expect(document.getElementById('dashboard-alert').textContent).toContain('Snapshot unavailable');
    expect(document.getElementById('snapshot-status').dataset.state).toBe('warning');
    app.stop();
  });
});
