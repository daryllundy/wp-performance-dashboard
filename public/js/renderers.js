(function(global) {
  function setText(id, value) {
    const element = document.getElementById(id);
    if (element) {
      element.textContent = value;
    }
  }

  function setStatusText(id, value, state) {
    const element = document.getElementById(id);
    if (!element) {
      return;
    }
    element.textContent = value;
    if (state) {
      element.dataset.state = state;
    }
  }

  function setStatusBadge(status) {
    const statusElement = document.getElementById('health-status');
    if (!statusElement) {
      return;
    }
    statusElement.textContent = status || 'Unknown';
    statusElement.dataset.status = status || 'unknown';
  }

  function createTextNode(tag, className, text) {
    const element = document.createElement(tag);
    if (className) {
      element.className = className;
    }
    element.textContent = text;
    return element;
  }

  function replaceChildren(container, children) {
    const fragment = document.createDocumentFragment();
    children.forEach((child) => fragment.appendChild(child));
    container.replaceChildren(fragment);
  }

  function renderSlowQueries(container, queries) {
    if (!container) {
      return;
    }
    if (!queries.length) {
      replaceChildren(container, [createTextNode('div', 'no-data', 'No slow queries detected')]);
      return;
    }
    const children = queries.slice(0, 20).map((query) => {
      const item = document.createElement('article');
      item.className = 'query-item';
      item.dataset.key = `${query.query_text}-${query.timestamp || ''}`;

      const header = document.createElement('div');
      header.className = 'query-header';
      header.append(
        createTextNode('strong', '', 'Query'),
        createTextNode('span', 'query-time', `${Math.round(query.execution_time || 0)}ms`)
      );

      const text = createTextNode('div', 'query-text', (query.query_text || '').slice(0, 160));
      const meta = createTextNode(
        'div',
        'query-meta',
        `${query.rows_examined || 0} rows | ${query.source_file || 'Unknown source'}`
      );

      item.append(header, text, meta);
      return item;
    });
    replaceChildren(container, children);
  }

  function renderPluginPerformance(container, plugins) {
    if (!container) {
      return;
    }
    if (!plugins.length) {
      replaceChildren(container, [createTextNode('div', 'no-data', 'No plugin data available')]);
      return;
    }
    const children = plugins.slice(0, 50).map((plugin) => {
      const item = document.createElement('article');
      item.className = 'plugin-item';
      item.dataset.key = plugin.plugin_name || 'plugin';

      const main = document.createElement('div');
      main.className = 'plugin-main';
      const impact = createTextNode('span', 'plugin-impact', `${Math.round(plugin.impact_score || 0)}/100`);
      const score = Number(plugin.impact_score || 0);
      impact.style.color = score > 70 ? '#f85149' : score > 40 ? '#f9826c' : '#238636';
      main.append(createTextNode('strong', '', plugin.plugin_name || 'Unknown Plugin'), impact);

      const stats = document.createElement('div');
      stats.className = 'plugin-stats';
      stats.append(
        createTextNode('span', '', `${Math.round(plugin.memory_usage || 0)}MB`),
        createTextNode('span', '', `${Math.round(plugin.query_count || 0)} queries`),
        createTextNode('span', '', `${Math.round(plugin.load_time || 0)}ms`)
      );

      item.append(main, stats);
      return item;
    });
    replaceChildren(container, children);
  }

  function renderRecommendations(container, health, queries, plugins) {
    if (!container) {
      return;
    }
    const recommendations = [];
    if ((health.avg_response_time || 0) > 1000) {
      recommendations.push({ title: 'Response time', message: 'Average response time is elevated.' });
    }
    if ((queries || []).length > 10) {
      recommendations.push({ title: 'Slow queries', message: 'Investigate the highest-cost queries first.' });
    }
    if ((plugins || []).some((plugin) => Number(plugin.impact_score || 0) > 70)) {
      recommendations.push({ title: 'Plugin impact', message: 'One or more active plugins have high impact scores.' });
    }
    if (!recommendations.length) {
      recommendations.push({ title: 'All clear', message: 'No critical performance issues detected for the selected range.' });
    }
    const children = recommendations.map((recommendation) => {
      const item = document.createElement('article');
      item.className = 'recommendation';
      item.append(
        createTextNode('strong', '', recommendation.title),
        createTextNode('p', '', recommendation.message)
      );
      return item;
    });
    replaceChildren(container, children);
  }

  function updateSystemHealth(health) {
    setText('health-slow-queries', `${health.slow_queries_1h || 0}`);
    setText('health-avg-response', `${Math.round(health.avg_response_time || 0)}ms`);
    setText('health-cpu-usage', `${Math.round(health.cpu_usage || 0)}%`);
    if (health.memory_total) {
      setText('health-memory-usage', `${Math.round(health.memory_used || 0)}MB / ${Math.round(health.memory_total)}MB`);
    } else {
      setText('health-memory-usage', `${Math.round(health.memory_used || 0)}MB`);
    }
    setText('health-disk-usage', `${Math.round(health.disk_usage || 0)}%`);
    setText('health-cache-hit', `${Math.round(health.cache_hit_ratio || 0)}%`);
    setText('health-active-plugins', `${health.active_plugins || 0}`);
    setStatusBadge(health.status || 'unknown');
  }

  function createCharts() {
    const performanceCtx = document.getElementById('performanceChart').getContext('2d');
    const adminAjaxCtx = document.getElementById('adminAjaxChart').getContext('2d');
    const qpsCtx = document.getElementById('qpsGauge').getContext('2d');
    const responseCtx = document.getElementById('responseGauge').getContext('2d');
    const memoryCtx = document.getElementById('memoryGauge').getContext('2d');

    const performanceChart = new Chart(performanceCtx, {
      type: 'line',
      data: { labels: [], datasets: [{ label: 'Response Time (ms)', data: [], borderColor: '#58a6ff', tension: 0.25 }] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
    });

    const adminAjaxChart = new Chart(adminAjaxCtx, {
      type: 'bar',
      data: { labels: [], datasets: [{ label: 'Calls', data: [], backgroundColor: '#f85149' }] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
    });

    function createGauge(ctx, color) {
      return new Chart(ctx, {
        type: 'doughnut',
        data: { datasets: [{ data: [0, 100], backgroundColor: [color, '#30363d'], borderWidth: 0 }] },
        options: { responsive: true, maintainAspectRatio: false, cutout: '70%', plugins: { legend: { display: false }, tooltip: { enabled: false } } }
      });
    }

    return {
      performanceChart,
      adminAjaxChart,
      qpsGauge: createGauge(qpsCtx, '#58a6ff'),
      responseGauge: createGauge(responseCtx, '#f85149'),
      memoryGauge: createGauge(memoryCtx, '#238636')
    };
  }

  function updateGauge(chart, value, maxValue) {
    const percent = Math.max(0, Math.min(100, Math.round((value / maxValue) * 100)));
    chart.data.datasets[0].data = [percent, 100 - percent];
    chart.update('none');
  }

  function updateCharts(charts, metrics, adminAjax, currentMetric) {
    if (metrics && metrics.length) {
      const ordered = metrics.slice().reverse();
      charts.performanceChart.data.labels = ordered.map((row) => new Date(row.timestamp).toLocaleTimeString());
      charts.performanceChart.data.datasets[0].label = currentMetric;
      charts.performanceChart.data.datasets[0].data = ordered.map((row) => Number(row[currentMetric] || 0));
      charts.performanceChart.update('none');
    }

    if (adminAjax && adminAjax.length) {
      charts.adminAjaxChart.data.labels = adminAjax.map((row) => row.action_name || 'unknown');
      charts.adminAjaxChart.data.datasets[0].data = adminAjax.map((row) => Number(row.call_count || 0));
      charts.adminAjaxChart.update('none');
    }
  }

  function updateRealtimeMetrics(charts, metrics) {
    setText('qps-value', `${Math.round(metrics.queries_per_second || 0)}`);
    setText('response-value', `${Math.round(metrics.avg_response_time || 0)}ms`);
    setText('memory-value', `${Math.round(metrics.memory_usage || 0)}MB`);
    updateGauge(charts.qpsGauge, Number(metrics.queries_per_second || 0), 100);
    updateGauge(charts.responseGauge, Number(metrics.avg_response_time || 0), 1000);
    updateGauge(charts.memoryGauge, Number(metrics.memory_usage || 0), 512);
  }

  function renderSnapshot(view, snapshot, metricKey) {
    const slowQueries = Array.isArray(snapshot.slowQueries) ? snapshot.slowQueries : [];
    const plugins = Array.isArray(snapshot.plugins) ? snapshot.plugins : [];
    const metrics = Array.isArray(snapshot.metrics) ? snapshot.metrics : [];
    const adminAjax = Array.isArray(snapshot.adminAjax) ? snapshot.adminAjax : [];
    const systemHealth = snapshot.systemHealth || {};
    const generatedAt = snapshot.meta && snapshot.meta.generatedAt ? snapshot.meta.generatedAt : new Date().toISOString();

    setText('slow-query-count', `${slowQueries.length} queries`);
    setText('plugin-count', `${plugins.length} plugins`);
    setStatusText('slow-queries-state', slowQueries.length ? 'Loaded' : 'Empty', slowQueries.length ? 'success' : 'warning');
    setStatusText('plugins-state', plugins.length ? 'Loaded' : 'Empty', plugins.length ? 'success' : 'warning');
    updateSystemHealth(systemHealth);
    renderSlowQueries(view.slowQueries, slowQueries);
    renderPluginPerformance(view.pluginPerformance, plugins);
    renderRecommendations(view.recommendations, systemHealth, slowQueries, plugins);
    updateCharts(view.charts, metrics, adminAjax, metricKey);
    setText('last-updated', `Updated ${new Date(generatedAt).toLocaleTimeString()}`);
  }

  function createView(charts) {
    return {
      charts,
      slowQueries: document.getElementById('slowQueries'),
      pluginPerformance: document.getElementById('pluginPerformance'),
      recommendations: document.getElementById('recommendations')
    };
  }

  global.WPDashboard = global.WPDashboard || {};
  Object.assign(global.WPDashboard, {
    createCharts,
    createView,
    renderSnapshot,
    setStatusText,
    updateRealtimeMetrics,
    updateSystemHealth,
    renderSlowQueries,
    renderPluginPerformance
  });
})(window);
