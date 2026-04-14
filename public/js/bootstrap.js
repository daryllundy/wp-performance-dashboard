(function(global) {
  function createDashboardApp(options = {}) {
    const api = options.api || global.WPDashboard.createApiClient();
    const state = options.state || global.WPDashboard.createDashboardState();
    const charts = options.charts || global.WPDashboard.createCharts();
    const view = global.WPDashboard.createView(charts);
    const contentUpdateManager = options.contentUpdateManager || global.contentUpdateManager;
    const performanceMonitor = options.performanceMonitor || global.performanceMonitor;
    const refreshMs = options.refreshMs || 30000;
    const demoStatusMs = options.demoStatusMs || 30000;
    let currentMetric = 'avg_response_time';
    let realtime = null;
    let controlsBound = false;

    function selectedTimeRange() {
      const selector = document.getElementById('timeRange');
      return selector ? selector.value : '1h';
    }

    function setConnectionStatus(connected) {
      const dot = document.getElementById('connection-status');
      if (dot) {
        dot.style.background = connected ? '#238636' : '#f85149';
      }
      global.WPDashboard.setStatusText('snapshot-status', connected ? 'Realtime connected' : 'Realtime disconnected', connected ? 'success' : 'warning');
    }

    function setModeUi() {
      const indicator = document.getElementById('demo-indicator');
      const controls = document.getElementById('demo-controls');
      const toggle = document.getElementById('demo-toggle');
      const status = document.getElementById('demo-status');
      const environment = document.getElementById('environment-label');
      if (indicator) {
        indicator.style.display = state.demoAvailable || state.demoMode ? 'flex' : 'none';
      }
      if (controls) {
        controls.style.display = state.demoAvailable ? 'flex' : 'none';
      }
      if (toggle) {
        toggle.textContent = state.demoMode ? 'Switch to Live' : 'Switch to Demo';
        toggle.setAttribute('aria-pressed', state.demoMode ? 'true' : 'false');
      }
      if (status) {
        status.textContent = state.demoMode ? 'Demo data active' : (state.demoAvailable ? 'Live data active' : 'Demo unavailable');
      }
      if (environment) {
        environment.textContent = state.demoMode ? 'Environment: Demo' : 'Environment: Live';
      }
    }

    function setLoading(loading) {
      state.isLoading = loading;
      const refreshButton = document.getElementById('refreshBtn');
      if (refreshButton) {
        refreshButton.disabled = loading;
        refreshButton.textContent = loading ? 'Refreshing…' : 'Refresh';
      }
      const cards = [document.getElementById('slowQueries')?.closest('.card'), document.getElementById('pluginPerformance')?.closest('.card')];
      cards.filter(Boolean).forEach((card) => card.setAttribute('aria-busy', loading ? 'true' : 'false'));
      if (loading) {
        global.WPDashboard.setStatusText('snapshot-status', 'Loading snapshot…', 'loading');
        global.WPDashboard.setStatusText('slow-queries-state', 'Loading', 'loading');
        global.WPDashboard.setStatusText('plugins-state', 'Loading', 'loading');
      }
    }

    function showMessage(message, type = 'info') {
      const region = document.getElementById('live-region');
      if (!region) {
        return;
      }
      region.textContent = `${type}: ${message}`;
      const alert = document.getElementById('dashboard-alert');
      if (!alert) {
        return;
      }
      if (type === 'error') {
        alert.hidden = false;
        alert.textContent = message;
      } else {
        alert.hidden = true;
        alert.textContent = '';
      }
    }

    async function loadSnapshot() {
      if (state.isLoading) {
        return;
      }
      setLoading(true);
      try {
        const snapshot = await api.fetchDashboardSnapshot({
          timeRange: selectedTimeRange(),
          demo: state.demoMode,
          includeInactive: false
        });
        contentUpdateManager.updateList('slowQueries', snapshot.slowQueries, (container, items) => {
          global.WPDashboard.renderSlowQueries(container, items);
        });
        contentUpdateManager.updateList('pluginPerformance', snapshot.plugins, (container, items) => {
          global.WPDashboard.renderPluginPerformance(container, items);
        });
        global.WPDashboard.renderSnapshot(view, snapshot, currentMetric);
        state.lastUpdatedAt = snapshot.meta.generatedAt;
        global.WPDashboard.setStatusText('snapshot-status', 'Snapshot current', 'success');
        showMessage(`Snapshot updated at ${new Date(snapshot.meta.generatedAt).toLocaleTimeString()}`);
      } catch (error) {
        global.WPDashboard.setStatusText('snapshot-status', 'Snapshot stale', 'warning');
        global.WPDashboard.setStatusText('slow-queries-state', 'Unavailable', 'warning');
        global.WPDashboard.setStatusText('plugins-state', 'Unavailable', 'warning');
        showMessage(error.message, 'error');
      } finally {
        setLoading(false);
      }
    }

    async function refreshDemoStatus() {
      try {
        const status = await api.fetchDemoStatus();
        state.demoAvailable = Boolean(status.available);
        setModeUi();
      } catch (error) {
        state.demoAvailable = false;
        setModeUi();
      }
    }

    async function triggerDemoRefresh() {
      const refreshButton = document.getElementById('demo-refresh');
      if (refreshButton) {
        refreshButton.disabled = true;
        refreshButton.classList.add('loading');
      }
      try {
        await api.triggerDemoRefresh(global.DASHBOARD_ADMIN_TOKEN || '');
        showMessage('Demo data refreshed');
        await loadSnapshot();
      } catch (error) {
        showMessage(error.message, 'error');
      } finally {
        if (refreshButton) {
          refreshButton.disabled = false;
          refreshButton.classList.remove('loading');
        }
      }
    }

    function bindControls() {
      if (controlsBound) {
        return;
      }
      controlsBound = true;
      document.querySelectorAll('.metric-toggle').forEach((button) => {
        button.addEventListener('click', (event) => {
          document.querySelectorAll('.metric-toggle').forEach((candidate) => candidate.classList.remove('active'));
          event.currentTarget.classList.add('active');
          currentMetric = event.currentTarget.dataset.metric;
          loadSnapshot();
        });
      });

      const refreshBtn = document.getElementById('refreshBtn');
      if (refreshBtn) {
        refreshBtn.addEventListener('click', () => loadSnapshot());
      }

      const timeRange = document.getElementById('timeRange');
      if (timeRange) {
        timeRange.addEventListener('change', () => loadSnapshot());
      }

      const demoToggle = document.getElementById('demo-toggle');
      if (demoToggle) {
        demoToggle.addEventListener('click', async () => {
          state.demoMode = !state.demoMode;
          setModeUi();
          await loadSnapshot();
        });
      }

      const demoRefresh = document.getElementById('demo-refresh');
      if (demoRefresh) {
        demoRefresh.addEventListener('click', triggerDemoRefresh);
      }

      document.addEventListener('visibilitychange', () => {
        state.hidden = document.hidden;
        if (state.hidden) {
          stopTimers();
        } else {
          startTimers();
          loadSnapshot();
        }
      });
    }

    function startTimers() {
      if (!state.hidden && !state.timers.refresh) {
        state.timers.refresh = setInterval(loadSnapshot, refreshMs);
      }
      if (!state.hidden && !state.timers.demoStatus) {
        state.timers.demoStatus = setInterval(refreshDemoStatus, demoStatusMs);
      }
    }

    function stopTimers() {
      if (state.timers.refresh) {
        clearInterval(state.timers.refresh);
        state.timers.refresh = null;
      }
      if (state.timers.demoStatus) {
        clearInterval(state.timers.demoStatus);
        state.timers.demoStatus = null;
      }
    }

    function start() {
      bindControls();
      setModeUi();
      if (global.DEBUG_MONITORING && performanceMonitor) {
        performanceMonitor.startMonitoring({ memoryFrequency: 15000, enableMemoryAlerts: true });
      }
      realtime = global.WPDashboard.createRealtimeController({
        onConnect: () => setConnectionStatus(true),
        onDisconnect: () => setConnectionStatus(false),
        onMetrics: (metrics) => {
          if (metrics && metrics.demo_mode !== undefined) {
            state.demoMode = Boolean(metrics.demo_mode);
            setModeUi();
          }
          global.WPDashboard.updateRealtimeMetrics(charts, metrics);
        }
      });
      realtime.start();
      startTimers();
      refreshDemoStatus();
      loadSnapshot();
    }

    function stop() {
      stopTimers();
      if (realtime) {
        realtime.stop();
      }
      if (performanceMonitor) {
        performanceMonitor.stopMonitoring();
      }
    }

    return {
      loadSnapshot,
      refreshDemoStatus,
      start,
      stop,
      state,
      charts,
      getRealtimeController: () => realtime
    };
  }

  global.WPDashboard = global.WPDashboard || {};
  global.WPDashboard.createDashboardApp = createDashboardApp;
})(window);
