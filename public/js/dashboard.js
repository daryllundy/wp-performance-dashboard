(function(global) {
  function createDashboardApp(options) {
    return global.WPDashboard.createDashboardApp(options);
  }

  global.createDashboardApp = createDashboardApp;

  if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
      global.dashboardApp = createDashboardApp();
      global.dashboardApp.start();
    });

    global.addEventListener('beforeunload', () => {
      if (global.dashboardApp) {
        global.dashboardApp.stop();
      }
    });
  }
})(window);
