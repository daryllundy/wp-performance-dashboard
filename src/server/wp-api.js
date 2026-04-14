const fetch = require('node-fetch');

async function fetchFromWpApi(config, endpoint, { method = 'GET', data } = {}) {
  if (!config || !config.url) {
    throw new Error('WordPress API is not configured');
  }

  const headers = {
    'Content-Type': 'application/json'
  };

  if (config.username && config.password) {
    const auth = Buffer.from(`${config.username}:${config.password}`).toString('base64');
    headers.Authorization = `Basic ${auth}`;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), config.timeoutMs || 10000);

  try {
    const response = await fetch(`${config.url}${endpoint}`, {
      method,
      headers,
      body: data ? JSON.stringify(data) : undefined,
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`WP API request failed: ${response.status} ${response.statusText}`);
    }

    return response.json();
  } finally {
    clearTimeout(timeoutId);
  }
}

module.exports = {
  fetchFromWpApi
};
