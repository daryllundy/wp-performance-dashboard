const express = require('express');
const { getDbPool } = require('./db');
const {
  parseBoolean,
  parseLimit,
  parseTimeRange
} = require('./validators');
const {
  queryAdminAjax,
  queryDemoStatus,
  queryMetrics,
  queryPlugins,
  queryRealtimeMetrics,
  querySlowQueries,
  querySystemHealth
} = require('./queries');

function createRateLimiter({ windowMs, maxRequests }) {
  const hits = new Map();

  return function rateLimit(req, res, next) {
    const key = req.ip || req.headers['x-forwarded-for'] || 'unknown';
    const now = Date.now();
    const entry = hits.get(key);
    if (!entry || now > entry.resetAt) {
      hits.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    if (entry.count >= maxRequests) {
      return res.status(429).json({ error: 'Rate limit exceeded' });
    }

    entry.count += 1;
    return next();
  };
}

function createAuthMiddleware(config) {
  return function requireAdminToken(req, res, next) {
    if (!config.adminToken) {
      return res.status(403).json({ error: 'Admin token not configured' });
    }

    const headerToken = req.headers['x-admin-token'];
    if (!headerToken || headerToken !== config.adminToken) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    return next();
  };
}

function noStore(_req, res, next) {
  res.set('Cache-Control', 'no-store');
  next();
}

function resolveUseDemo(req, config) {
  return parseBoolean(req.query.demo, 'demo', config.isDemoMode);
}

function validateReadOptions(req, config, defaults = {}) {
  return {
    useDemo: resolveUseDemo(req, config),
    timeRange: parseTimeRange(req.query.timeRange, defaults.timeRange || '1h'),
    limit: parseLimit(req.query.limit, defaults.limit || 50, defaults.maxLimit || 200),
    includeInactive: parseBoolean(req.query.includeInactive, 'includeInactive', false)
  };
}

function createRouter(deps) {
  const {
    config,
    pools,
    fetchFromWpApi,
    fetchImpl,
    spawnDemoRefresh
  } = deps;
  const router = express.Router();
  const rateLimit = createRateLimiter({
    windowMs: config.rateLimitWindowMs,
    maxRequests: config.rateLimitMaxRequests
  });
  const requireAdminToken = createAuthMiddleware(config);
  let activeRefresh = null;

  router.use('/api', noStore);

  async function withDataSource(req, res, options, wpEndpointBuilder, dbQuery) {
    const useDemo = options.useDemo;
    if (config.useExternalWP && !useDemo) {
      const data = await fetchFromWpApi(config.wpApi, wpEndpointBuilder(options));
      return res.json(data);
    }

    const dbPool = getDbPool({ pools, useDemo });
    if (!dbPool) {
      return res.status(503).json({ error: 'Database not available' });
    }

    const data = await dbQuery(dbPool, options);
    return res.json(data);
  }

  router.get('/api/metrics', async (req, res, next) => {
    try {
      const options = validateReadOptions(req, config, { limit: 50, maxLimit: 200 });
      await withDataSource(
        req,
        res,
        options,
        ({ timeRange, limit }) => `/wp-json/wp-performance-dashboard/v1/metrics?timeRange=${timeRange}&limit=${limit}`,
        queryMetrics
      );
    } catch (error) {
      next(error);
    }
  });

  router.get('/api/slow-queries', async (req, res, next) => {
    try {
      const options = validateReadOptions(req, config, { limit: 20, maxLimit: 100 });
      await withDataSource(
        req,
        res,
        options,
        ({ timeRange, limit }) => `/wp-json/wp-performance-dashboard/v1/slow-queries?timeRange=${timeRange}&limit=${limit}`,
        querySlowQueries
      );
    } catch (error) {
      next(error);
    }
  });

  router.get('/api/admin-ajax', async (req, res, next) => {
    try {
      const options = validateReadOptions(req, config, { limit: 20, maxLimit: 100 });
      await withDataSource(
        req,
        res,
        options,
        ({ timeRange, limit }) => `/wp-json/wp-performance-dashboard/v1/admin-ajax?timeRange=${timeRange}&limit=${limit}`,
        queryAdminAjax
      );
    } catch (error) {
      next(error);
    }
  });

  router.get('/api/plugins', async (req, res, next) => {
    try {
      const options = validateReadOptions(req, config, { limit: 100, maxLimit: 100 });
      await withDataSource(
        req,
        res,
        options,
        ({ timeRange, limit, includeInactive }) => `/wp-json/wp-performance-dashboard/v1/plugins?timeRange=${timeRange}&limit=${limit}&includeInactive=${includeInactive}`,
        queryPlugins
      );
    } catch (error) {
      next(error);
    }
  });

  router.get('/api/realtime-metrics', async (req, res, next) => {
    try {
      const useDemo = resolveUseDemo(req, config);
      if (config.useExternalWP && !useDemo) {
        const data = await fetchFromWpApi(config.wpApi, '/wp-json/wp-performance-dashboard/v1/realtime-metrics');
        return res.json(data);
      }

      const dbPool = getDbPool({ pools, useDemo });
      if (!dbPool) {
        return res.status(503).json({ error: 'Database not available' });
      }
      const data = await queryRealtimeMetrics(dbPool);
      return res.json(data);
    } catch (error) {
      next(error);
    }
  });

  router.get('/api/system-health', async (req, res, next) => {
    try {
      const options = validateReadOptions(req, config, { limit: 50, maxLimit: 50 });
      if (config.useExternalWP && !options.useDemo) {
        const data = await fetchFromWpApi(config.wpApi, `/wp-json/wp-performance-dashboard/v1/system-health?timeRange=${options.timeRange}`);
        return res.json(data);
      }

      const dbPool = getDbPool({ pools, useDemo: options.useDemo });
      if (!dbPool) {
        return res.status(503).json({ error: 'Database not available' });
      }
      const data = await querySystemHealth(dbPool, options);
      return res.json({ ...data, demo_mode: options.useDemo });
    } catch (error) {
      next(error);
    }
  });

  router.get('/api/dashboard', async (req, res, next) => {
    try {
      const options = validateReadOptions(req, config, { limit: 50, maxLimit: 100 });
      const queryOptions = {
        timeRange: options.timeRange,
        includeInactive: options.includeInactive,
        limit: options.limit
      };

      if (config.useExternalWP && !options.useDemo) {
        const data = await fetchFromWpApi(
          config.wpApi,
          `/wp-json/wp-performance-dashboard/v1/dashboard?timeRange=${options.timeRange}&limit=${options.limit}&includeInactive=${options.includeInactive}`
        );
        return res.json(data);
      }

      const dbPool = getDbPool({ pools, useDemo: options.useDemo });
      if (!dbPool) {
        return res.status(503).json({ error: 'Database not available' });
      }

      const [metrics, slowQueries, adminAjax, plugins, systemHealth] = await Promise.all([
        queryMetrics(dbPool, queryOptions),
        querySlowQueries(dbPool, { ...queryOptions, limit: Math.min(queryOptions.limit, 20) }),
        queryAdminAjax(dbPool, { ...queryOptions, limit: Math.min(queryOptions.limit, 20) }),
        queryPlugins(dbPool, { ...queryOptions, limit: Math.min(queryOptions.limit, 100) }),
        querySystemHealth(dbPool, queryOptions)
      ]);

      return res.json({
        metrics,
        slowQueries,
        adminAjax,
        plugins,
        systemHealth: {
          ...systemHealth,
          demo_mode: options.useDemo
        },
        meta: {
          timeRange: options.timeRange,
          demo: options.useDemo,
          generatedAt: new Date().toISOString()
        }
      });
    } catch (error) {
      next(error);
    }
  });

  router.get('/api/demo-status', async (req, res, next) => {
    try {
      const status = await queryDemoStatus(pools.demo, {
        isDemoMode: config.isDemoMode,
        fetchImpl
      });
      res.json(status);
    } catch (error) {
      next(error);
    }
  });

  router.post('/api/demo-refresh', requireAdminToken, rateLimit, async (req, res, next) => {
    try {
      if (!config.isDemoMode) {
        return res.status(403).json({ error: 'Demo refresh is only available in demo mode' });
      }
      if (!pools.demo) {
        return res.status(503).json({ error: 'Demo environment not available' });
      }
      if (activeRefresh) {
        return res.status(409).json({ error: 'A demo refresh is already running' });
      }

      activeRefresh = spawnDemoRefresh();
      const result = await activeRefresh;
      activeRefresh = null;
      return res.json(result);
    } catch (error) {
      activeRefresh = null;
      next(error);
    }
  });

  router.get('/health', (_req, res) => {
    res.status(200).json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      demoMode: config.isDemoMode,
      demoAvailable: Boolean(pools.demo)
    });
  });

  router.use((error, _req, res, _next) => {
    const statusCode = error.statusCode || 500;
    const message = statusCode >= 500 ? 'Internal server error' : error.message;
    if (statusCode >= 500) {
      console.error(error);
    }
    res.status(statusCode).json({ error: message });
  });

  return router;
}

module.exports = {
  createRouter
};
