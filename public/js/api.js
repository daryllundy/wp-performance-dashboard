(function(global) {
  function buildQuery(params) {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        query.set(key, String(value));
      }
    });
    const suffix = query.toString();
    return suffix ? `?${suffix}` : '';
  }

  async function fetchJson(url, options = {}) {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Cache-Control': 'no-store',
        ...(options.headers || {})
      }
    });

    const data = await response.json();
    if (!response.ok) {
      const error = new Error(data.error || `Request failed: ${response.status}`);
      error.status = response.status;
      throw error;
    }
    return data;
  }

  function createApiClient() {
    return {
      fetchDashboardSnapshot({ timeRange, demo, includeInactive = false }) {
        return fetchJson(`/api/dashboard${buildQuery({ timeRange, demo, includeInactive })}`);
      },
      fetchDemoStatus() {
        return fetchJson('/api/demo-status');
      },
      triggerDemoRefresh(adminToken) {
        return fetchJson('/api/demo-refresh', {
          method: 'POST',
          headers: adminToken ? { 'x-admin-token': adminToken } : {}
        });
      }
    };
  }

  global.WPDashboard = global.WPDashboard || {};
  global.WPDashboard.createApiClient = createApiClient;
})(window);
