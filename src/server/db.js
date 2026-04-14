const mysql = require('mysql2/promise');

function createPools(config) {
  const pools = {
    primary: null,
    demo: null
  };

  if (config.db) {
    pools.primary = mysql.createPool(config.db);
  }

  if (config.isDemoMode || config.allowDemoDetection) {
    pools.demo = mysql.createPool(config.demoDb);
  }

  return pools;
}

function getDbPool({ pools, useDemo }) {
  return useDemo ? pools.demo : pools.primary;
}

async function closePools(pools) {
  const tasks = [pools.primary, pools.demo]
    .filter(Boolean)
    .map((pool) => pool.end().catch(() => undefined));
  await Promise.all(tasks);
}

module.exports = {
  closePools,
  createPools,
  getDbPool
};
