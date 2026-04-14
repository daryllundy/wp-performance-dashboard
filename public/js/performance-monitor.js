(function(global) {
  class PerformanceTimer {
    constructor() {
      this.timers = new Map();
      this.measurements = new Map();
    }

    start(operationId, metadata = {}) {
      this.timers.set(operationId, {
        startTime: performance.now(),
        metadata,
        timestamp: Date.now()
      });
    }

    end(operationId, extra = {}) {
      const timer = this.timers.get(operationId);
      if (!timer) {
        return null;
      }
      const measurement = {
        operationId,
        duration: performance.now() - timer.startTime,
        timestamp: timer.timestamp,
        metadata: timer.metadata,
        ...extra
      };
      if (!this.measurements.has(operationId)) {
        this.measurements.set(operationId, []);
      }
      this.measurements.get(operationId).push(measurement);
      this.timers.delete(operationId);
      return measurement;
    }

    getMeasurements(operationId, limit = 100) {
      return (this.measurements.get(operationId) || []).slice(-limit);
    }

    clearAll() {
      this.timers.clear();
      this.measurements.clear();
    }
  }

  class MemoryMonitor {
    constructor() {
      this.measurements = [];
      this.monitoringInterval = null;
      this.monitoringFrequency = 10000;
    }

    getMemoryInfo() {
      const memory = { timestamp: Date.now() };
      if (performance.memory) {
        memory.jsHeapSizeLimit = performance.memory.jsHeapSizeLimit;
        memory.totalJSHeapSize = performance.memory.totalJSHeapSize;
        memory.usedJSHeapSize = performance.memory.usedJSHeapSize;
        memory.heapUsagePercent = memory.jsHeapSizeLimit ? (memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100 : 0;
      }
      return memory;
    }

    measure(context = 'manual') {
      const measurement = {
        context,
        timestamp: Date.now(),
        memory: this.getMemoryInfo()
      };
      this.measurements.push(measurement);
      if (this.measurements.length > 200) {
        this.measurements.shift();
      }
      return measurement;
    }

    startMonitoring(frequency = this.monitoringFrequency) {
      if (this.monitoringInterval) {
        return;
      }
      this.monitoringFrequency = frequency;
      this.measure('monitoring_start');
      this.monitoringInterval = setInterval(() => this.measure('continuous'), frequency);
    }

    stopMonitoring() {
      if (!this.monitoringInterval) {
        return;
      }
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    clearMeasurements() {
      this.measurements = [];
    }
  }

  class PerformanceMonitor {
    constructor() {
      this.timer = new PerformanceTimer();
      this.memoryMonitor = new MemoryMonitor();
      this.started = false;
    }

    startMonitoring(options = {}) {
      if (this.started) {
        return;
      }
      this.started = true;
      if (options.enableMemoryAlerts || options.memoryFrequency) {
        this.memoryMonitor.startMonitoring(options.memoryFrequency || 15000);
      }
    }

    stopMonitoring() {
      this.started = false;
      this.memoryMonitor.stopMonitoring();
    }

    getPerformanceReport() {
      return {
        memory: {
          measurements: this.memoryMonitor.measurements.length
        }
      };
    }

    generateOptimizationRecommendations() {
      return [];
    }

    clearAllData() {
      this.timer.clearAll();
      this.memoryMonitor.clearMeasurements();
    }
  }

  global.PerformanceTimer = PerformanceTimer;
  global.MemoryMonitor = MemoryMonitor;
  global.PerformanceMonitor = PerformanceMonitor;
  global.performanceMonitor = new PerformanceMonitor();
})(window);
