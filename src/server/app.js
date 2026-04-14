const path = require('path');
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const helmet = require('helmet');
const cors = require('cors');
const fetch = require('node-fetch');
const { spawn } = require('child_process');
const { loadConfig } = require('./config');
const { createPools, closePools, getDbPool } = require('./db');
const { fetchFromWpApi } = require('./wp-api');
const { createRouter } = require('./routes');
const { queryLatestRealtimeSample } = require('./queries');
const { createRealtimeBroadcaster } = require('./realtime');

function createCorsMiddleware(config) {
  if (!config.corsOrigins.length) {
    return cors({ origin: false });
  }

  return cors({
    origin(origin, callback) {
      if (!origin || config.corsOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error('Not allowed by CORS'));
    }
  });
}

function createDemoRefreshRunner(config) {
  return function spawnDemoRefresh() {
    return new Promise((resolve, reject) => {
      const child = spawn('node', ['/app/demo/scripts/generate-demo-data.js'], {
        env: {
          ...process.env,
          DB_HOST: config.demoDb.host,
          DB_USER: config.demoDb.user,
          DB_PASSWORD: config.demoDb.password,
          DB_NAME: config.demoDb.database
        }
      });

      let settled = false;
      let output = '';
      const timeoutId = setTimeout(() => {
        if (settled) {
          return;
        }
        settled = true;
        child.kill('SIGTERM');
        reject(Object.assign(new Error('Demo refresh timeout'), { statusCode: 408 }));
      }, 30000);

      child.stdout.on('data', (data) => {
        output += data.toString();
      });

      child.stderr.on('data', (data) => {
        output += data.toString();
      });

      child.on('error', (error) => {
        if (settled) {
          return;
        }
        settled = true;
        clearTimeout(timeoutId);
        reject(error);
      });

      child.on('close', (code) => {
        if (settled) {
          return;
        }
        settled = true;
        clearTimeout(timeoutId);
        if (code === 0) {
          resolve({
            success: true,
            message: 'Demo data refreshed successfully',
            output: output.slice(-500)
          });
          return;
        }

        reject(Object.assign(new Error('Demo data refresh failed'), {
          statusCode: 500,
          details: { code, output: output.slice(-500) }
        }));
      });
    });
  };
}

function createApp(options = {}) {
  const config = options.config || loadConfig(options.env || process.env);
  const app = express();
  const server = http.createServer(app);
  const io = options.io || socketIo(server, {
    cors: {
      origin: config.corsOrigins.length ? config.corsOrigins : false,
      methods: ['GET', 'POST']
    }
  });
  const pools = options.pools || createPools(config);

  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", 'https://cdn.jsdelivr.net'],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:'],
        connectSrc: ["'self'", 'ws:', 'wss:'],
        fontSrc: ["'self'", 'data:'],
        objectSrc: ["'none'"],
        upgradeInsecureRequests: null
      }
    }
  }));
  app.use(createCorsMiddleware(config));
  app.use(express.json({ limit: config.jsonLimit }));
  app.use(express.static(path.join(__dirname, '../../public')));

  const spawnDemoRefresh = options.spawnDemoRefresh || createDemoRefreshRunner(config);
  const router = createRouter({
    config,
    pools,
    fetchFromWpApi,
    fetchImpl: options.fetchImpl || fetch,
    spawnDemoRefresh
  });

  app.use(router);
  app.get('/', (_req, res) => {
    res.sendFile(path.join(__dirname, '../../public/index.html'));
  });

  const broadcaster = createRealtimeBroadcaster({
    io,
    config,
    async getRealtimePayload() {
      const useDemo = config.isDemoMode;
      if (config.useExternalWP && !useDemo) {
        const data = await fetchFromWpApi(config.wpApi, '/wp-json/wp-performance-dashboard/v1/realtime-metrics');
        if (!data) {
          return null;
        }
        return {
          queries_per_second: data.queries_per_second,
          avg_response_time: data.avg_response_time,
          memory_usage: data.memory_usage,
          timestamp: data.timestamp || new Date().toISOString(),
          demo_mode: false
        };
      }

      const dbPool = getDbPool({ pools, useDemo });
      if (!dbPool) {
        return null;
      }

      const latest = await queryLatestRealtimeSample(dbPool);
      if (!latest) {
        return null;
      }

      return {
        queries_per_second: latest.queries_per_second,
        avg_response_time: latest.avg_response_time,
        memory_usage: latest.memory_usage,
        timestamp: latest.timestamp,
        demo_mode: useDemo
      };
    }
  });

  io.on('connection', (socket) => {
    broadcaster.handleConnection(socket);
  });

  async function start(port = config.port) {
    return new Promise((resolve) => {
      server.listen(port, () => resolve(server));
    });
  }

  async function stop() {
    broadcaster.shutdown();
    await closePools(pools);
    if (!server.listening) {
      return;
    }
    await new Promise((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
  }

  return {
    app,
    broadcaster,
    config,
    io,
    pools,
    server,
    start,
    stop
  };
}

module.exports = {
  createApp
};
