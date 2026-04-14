const DEFAULT_PORT = 3000;
const ALLOWED_TIME_RANGES = new Set(['1h', '6h', '24h', '7d']);

function parseOrigins(value) {
  if (!value) {
    return [];
  }

  return value
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function requireIf(condition, value, name) {
  if (condition && !value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function loadConfig(env = process.env) {
  const useExternalWP = Boolean(env.WP_API_URL);
  const isDemoMode = env.DEMO_MODE === 'true' || env.NODE_ENV === 'demo';
  const allowDemoDetection = env.ENABLE_DEMO_DETECTION !== 'false';
  const corsOrigins = parseOrigins(env.CORS_ORIGINS);
  const adminToken = env.ADMIN_TOKEN || '';
  const debugMonitoring = env.DEBUG_MONITORING === 'true';

  const config = {
    port: Number.parseInt(env.PORT || `${DEFAULT_PORT}`, 10),
    isDemoMode,
    allowDemoDetection,
    useExternalWP,
    debugMonitoring,
    adminToken,
    corsOrigins,
    jsonLimit: env.JSON_LIMIT || '100kb',
    rateLimitWindowMs: Number.parseInt(env.DEMO_REFRESH_WINDOW_MS || '60000', 10),
    rateLimitMaxRequests: Number.parseInt(env.DEMO_REFRESH_MAX_REQUESTS || '3', 10),
    realtimeIntervalMs: Number.parseInt(env.REALTIME_INTERVAL_MS || '5000', 10),
    snapshotItemLimits: {
      metrics: 200,
      slowQueries: 100,
      adminAjax: 100,
      plugins: 100
    },
    db: null,
    demoDb: {
      host: env.DEMO_DB_HOST || 'demo-mysql',
      user: env.DEMO_DB_USER || 'demo_user',
      password: env.DEMO_DB_PASSWORD || 'demo_password',
      database: env.DEMO_DB_NAME || 'demo_wordpress',
      port: Number.parseInt(env.DEMO_DB_PORT || '3306', 10),
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    },
    wpApi: null
  };

  if (!useExternalWP) {
    config.db = {
      host: requireIf(!isDemoMode, env.DB_HOST, 'DB_HOST') || 'localhost',
      user: requireIf(!isDemoMode, env.DB_USER, 'DB_USER') || 'root',
      password: requireIf(!isDemoMode, env.DB_PASSWORD, 'DB_PASSWORD') || '',
      database: requireIf(!isDemoMode, env.DB_NAME, 'DB_NAME') || 'wordpress_performance',
      port: Number.parseInt(env.DB_PORT || '3306', 10),
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    };
  }

  if (useExternalWP) {
    config.wpApi = {
      url: env.WP_API_URL,
      username: env.WP_API_USERNAME || '',
      password: env.WP_API_PASSWORD || '',
      timeoutMs: Number.parseInt(env.WP_API_TIMEOUT_MS || '10000', 10)
    };
  }

  return config;
}

module.exports = {
  ALLOWED_TIME_RANGES,
  loadConfig
};
