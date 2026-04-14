function createRealtimeBroadcaster({ io, config, getRealtimePayload }) {
  let intervalId = null;
  let clientCount = 0;

  async function broadcast() {
    try {
      const payload = await getRealtimePayload();
      if (payload) {
        io.emit('real-time-metrics', payload);
      }
    } catch (error) {
      console.error('Error broadcasting real-time data:', error);
    }
  }

  function ensureRunning() {
    if (!intervalId) {
      intervalId = setInterval(broadcast, config.realtimeIntervalMs);
    }
  }

  function ensureStopped() {
    if (intervalId && clientCount === 0) {
      clearInterval(intervalId);
      intervalId = null;
    }
  }

  function handleConnection(socket) {
    clientCount += 1;
    ensureRunning();

    socket.on('disconnect', () => {
      clientCount = Math.max(0, clientCount - 1);
      ensureStopped();
    });
  }

  function shutdown() {
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
    clientCount = 0;
  }

  return {
    handleConnection,
    shutdown,
    getClientCount: () => clientCount,
    isRunning: () => Boolean(intervalId)
  };
}

module.exports = {
  createRealtimeBroadcaster
};
