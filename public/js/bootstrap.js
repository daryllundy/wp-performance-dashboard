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

    function selectedTimeRange() {
      const selector = document.getElementById('timeRange');
      return selector ? selector.value : '1h';
    }

    function setConnectionStatus(connected) {
      const dot = document.getElementById('connection-status');
      if (dot) {
        dot.style.background = connected ? '#238636' : '#f85149';
      }
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
    }

    function showMessage(message, type = 'info') {
      const region = document.getElementById('live-region');
      if (!region) {
        return;
      }
      region.textContent = `${type}: ${message}`;
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
        showMessage(`Snapshot updated at ${new Date(snapshot.meta.generatedAt).toLocaleTimeString()}`);
      } catch (error) {
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
        }
      }
    }

    function bindControls() {
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
