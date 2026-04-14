(function(global) {
  class ScrollManager {
    constructor() {
      this.positions = new Map();
      this.lastInteraction = new Map();
    }

    watch(container) {
      if (!container || container.__scrollManagerBound) {
        return;
      }
      container.__scrollManagerBound = true;
      container.addEventListener('scroll', () => {
        this.lastInteraction.set(container.id, Date.now());
      }, { passive: true });
    }

    save(container) {
      if (!container || !container.id) {
        return;
      }
      this.watch(container);
      this.positions.set(container.id, {
        top: container.scrollTop,
        height: container.scrollHeight,
        clientHeight: container.clientHeight,
        timestamp: Date.now()
      });
    }

    restore(container) {
      if (!container || !container.id) {
        return;
      }
      const snapshot = this.positions.get(container.id);
      if (!snapshot) {
        return;
      }
      const lastInteraction = this.lastInteraction.get(container.id) || 0;
      if (Date.now() - lastInteraction < 400) {
        return;
      }
      const previousScrollable = Math.max(snapshot.height - snapshot.clientHeight, 0);
      const currentScrollable = Math.max(container.scrollHeight - container.clientHeight, 0);
      if (previousScrollable <= 0 || currentScrollable <= 0) {
        container.scrollTop = 0;
      } else {
        const ratio = snapshot.top / previousScrollable;
        container.scrollTop = Math.round(ratio * currentScrollable);
      }
      this.positions.delete(container.id);
    }
  }

  class ContentUpdateManager {
    constructor() {
      this.scrollManager = new ScrollManager();
    }

    updateList(containerId, items, renderItems) {
      const container = document.getElementById(containerId);
      if (!container) {
        return;
      }
      this.scrollManager.save(container);
      renderItems(container, items);
      this.scrollManager.restore(container);
    }

    async updateContainer(containerId, updateFunction, data) {
      const container = document.getElementById(containerId);
      if (container) {
        this.scrollManager.save(container);
      }
      const result = await Promise.resolve(updateFunction(data));
      if (container) {
        this.scrollManager.restore(container);
      }
      return result;
    }

    createContainerSnapshot(containerId) {
      const container = document.getElementById(containerId);
      if (!container) {
        return null;
      }
      return {
        containerId,
        scrollTop: container.scrollTop,
        childCount: container.childElementCount
      };
    }

    async rollbackContainer() {
      return false;
    }

    stopDOMMonitoring() {}
    emergencyStop() {}
    resumeOperations() {}
    clearErrorLog() {}
    clearAllSnapshots() {}
    clearUpdateHistory() {}
    getDOMStats() { return {}; }
    getAllUpdateStatus() { return {}; }
    getThrottlingStats() { return {}; }
    getErrorRecoveryStatus() { return {}; }
    getErrorLog() { return []; }
    performHealthCheck() { return {}; }
  }

  global.ScrollManager = ScrollManager;
  global.ContentUpdateManager = ContentUpdateManager;
  global.contentUpdateManager = new ContentUpdateManager();
})(window);
