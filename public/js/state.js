(function(global) {
  function createDashboardState() {
    return {
      demoMode: false,
      demoAvailable: false,
      isLoading: false,
      lastUpdatedAt: null,
      hidden: false,
      timers: {
        refresh: null,
        demoStatus: null
      }
    };
  }

  global.WPDashboard = global.WPDashboard || {};
  global.WPDashboard.createDashboardState = createDashboardState;
})(window);
