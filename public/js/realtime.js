(function(global) {
  function createRealtimeController(options) {
    const {
      onConnect,
      onDisconnect,
      onMetrics,
      socketFactory = () => io()
    } = options;

    let socket = null;

    function start() {
      if (socket) {
        return socket;
      }
      socket = socketFactory();
      socket.on('connect', () => onConnect && onConnect());
      socket.on('disconnect', () => onDisconnect && onDisconnect());
      socket.on('real-time-metrics', (data) => onMetrics && onMetrics(data));
      return socket;
    }

    function stop() {
      if (!socket) {
        return;
      }
      socket.disconnect();
      socket = null;
    }

    return {
      start,
      stop,
      getSocket: () => socket
    };
  }

  global.WPDashboard = global.WPDashboard || {};
  global.WPDashboard.createRealtimeController = createRealtimeController;
})(window);
