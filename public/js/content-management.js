/**
 * Content Management Utilities for WordPress Performance Dashboard
 * 
 * This module provides utilities to handle content updates with proper cleanup,
 * scroll position preservation, and memory leak prevention.
 */

/**
 * ScrollPreserver utility class for saving and restoring scroll positions
 */
class ScrollPreserver {
    constructor() {
        this.scrollPositions = new Map();
    }

    /**
     * Save the current scroll position for a container
     * @param {string} containerId - The ID of the container
     */
    savePosition(containerId) {
        const container = document.getElementById(containerId);
        if (!container) {
            console.warn(`ScrollPreserver: Container ${containerId} not found`);
            return;
        }

        const scrollData = {
            scrollTop: container.scrollTop,
            scrollHeight: container.scrollHeight,
            clientHeight: container.clientHeight,
            timestamp: Date.now()
        };

        this.scrollPositions.set(containerId, scrollData);
        console.debug(`ScrollPreserver: Saved position for ${containerId}`, scrollData);
    }

    /**
     * Restore the scroll position for a container proportionally
     * @param {string} containerId - The ID of the container
     */
    restorePosition(containerId) {
        const container = document.getElementById(containerId);
        const savedPosition = this.scrollPositions.get(containerId);

        if (!container || !savedPosition) {
            console.debug(`ScrollPreserver: No saved position for ${containerId}`);
            return;
        }

        // Calculate proportional scroll position
        const oldScrollableHeight = savedPosition.scrollHeight - savedPosition.clientHeight;
        const newScrollableHeight = container.scrollHeight - container.clientHeight;

        if (oldScrollableHeight <= 0 || newScrollableHeight <= 0) {
            // No scrollable content, reset to top
            container.scrollTop = 0;
            // Clean up saved position even if no scrollable content
            this.scrollPositions.delete(containerId);
            return;
        }

        // Handle edge cases where content height changes significantly
        const heightChangeRatio = container.scrollHeight / savedPosition.scrollHeight;
        const scrollRatio = savedPosition.scrollTop / oldScrollableHeight;
        
        // If content height changed dramatically (more than 50% change), use a more conservative approach
        if (heightChangeRatio < 0.5 || heightChangeRatio > 2.0) {
            console.debug(`ScrollPreserver: Significant height change detected (${heightChangeRatio.toFixed(2)}x), using conservative restoration`);
            
            // For dramatic content changes, try to maintain relative position but be more conservative
            const conservativeScrollTop = Math.min(
                Math.round(scrollRatio * newScrollableHeight * 0.8), // Scale down by 20% for safety
                newScrollableHeight * 0.9 // Never scroll past 90% of new content
            );
            container.scrollTop = Math.max(0, conservativeScrollTop);
        } else {
            // Normal proportional restoration
            const newScrollTop = Math.round(scrollRatio * newScrollableHeight);
            container.scrollTop = Math.max(0, Math.min(newScrollTop, newScrollableHeight));
        }

        console.debug(`ScrollPreserver: Restored position for ${containerId}`, {
            oldScrollTop: savedPosition.scrollTop,
            newScrollTop: container.scrollTop,
            scrollRatio: scrollRatio,
            heightChangeRatio: heightChangeRatio,
            oldHeight: savedPosition.scrollHeight,
            newHeight: container.scrollHeight
        });

        // Clean up saved position after restoration
        this.scrollPositions.delete(containerId);
    }

    /**
     * Clear all saved positions
     */
    clearAll() {
        this.scrollPositions.clear();
    }

    /**
     * Clear saved position for a specific container
     * @param {string} containerId - The ID of the container
     */
    clear(containerId) {
        this.scrollPositions.delete(containerId);
    }

    /**
     * Check if user is actively scrolling (to avoid disrupting their interaction)
     * @param {string} containerId - The ID of the container
     * @returns {boolean} True if user is actively scrolling
     */
    isUserScrolling(containerId) {
        const container = document.getElementById(containerId);
        if (!container) return false;

        const savedPosition = this.scrollPositions.get(containerId);
        if (!savedPosition) return false;

        // Check if scroll position changed significantly since we saved it (within last 2 seconds)
        const timeSinceSave = Date.now() - savedPosition.timestamp;
        const currentScrollTop = container.scrollTop;
        const scrollDifference = Math.abs(currentScrollTop - savedPosition.scrollTop);

        // If less than 2 seconds have passed and scroll position changed by more than 50px,
        // assume user is actively scrolling
        return timeSinceSave < 2000 && scrollDifference > 50;
    }

    /**
     * Save position with user interaction detection
     * @param {string} containerId - The ID of the container
     * @param {boolean} forceUpdate - Force update even if user is scrolling
     */
    savePositionSafe(containerId, forceUpdate = false) {
        if (!forceUpdate && this.isUserScrolling(containerId)) {
            console.debug(`ScrollPreserver: User is actively scrolling ${containerId}, skipping save`);
            return false;
        }
        
        this.savePosition(containerId);
        return true;
    }
}

/**
 * DOMSizeMonitor utility class for tracking and managing DOM size across containers
 */
class DOMSizeMonitor {
    constructor() {
        this.containerLimits = new Map();
        this.monitoringInterval = null;
        this.defaultLimit = 1000;
        this.warningThreshold = 0.8; // Warn at 80% of limit
        this.emergencyThreshold = 1.2; // Emergency cleanup at 120% of limit
        this.monitoringFrequency = 30000; // Monitor every 30 seconds
    }

    /**
     * Set monitoring limit for a specific container
     * @param {string} containerId - The ID of the container
     * @param {number} limit - Maximum number of nodes allowed
     */
    setContainerLimit(containerId, limit) {
        this.containerLimits.set(containerId, limit);
        console.debug(`DOMSizeMonitor: Set limit for ${containerId}: ${limit} nodes`);
    }

    /**
     * Get the limit for a specific container
     * @param {string} containerId - The ID of the container
     * @returns {number} The node limit for the container
     */
    getContainerLimit(containerId) {
        return this.containerLimits.get(containerId) || this.defaultLimit;
    }

    /**
     * Count DOM nodes in a container (including all descendants)
     * @param {HTMLElement|string} container - The container element or its ID
     * @returns {Object} Node count information
     */
    countNodes(container) {
        const element = typeof container === 'string' ? 
            document.getElementById(container) : container;

        if (!element) {
            return { 
                nodeCount: 0, 
                textNodes: 0, 
                elementNodes: 0, 
                error: 'Container not found' 
            };
        }

        // Count all nodes including text nodes
        const walker = document.createTreeWalker(
            element,
            NodeFilter.SHOW_ALL,
            null,
            false
        );

        let totalNodes = 1; // Count the container element itself
        let textNodes = 0;
        let elementNodes = 1;

        while (walker.nextNode()) {
            totalNodes++;
            if (walker.currentNode.nodeType === Node.TEXT_NODE) {
                textNodes++;
            } else if (walker.currentNode.nodeType === Node.ELEMENT_NODE) {
                elementNodes++;
            }
        }

        return {
            nodeCount: totalNodes,
            textNodes,
            elementNodes,
            containerId: element.id || 'unnamed'
        };
    }

    /**
     * Monitor a specific container and log warnings if needed
     * @param {string} containerId - The ID of the container to monitor
     * @returns {Object} Monitoring result
     */
    monitorContainer(containerId) {
        const element = document.getElementById(containerId);
        if (!element) {
            return { error: `Container ${containerId} not found` };
        }

        const nodeInfo = this.countNodes(element);
        const limit = this.getContainerLimit(containerId);
        const warningLimit = Math.floor(limit * this.warningThreshold);
        const emergencyLimit = Math.floor(limit * this.emergencyThreshold);

        const result = {
            containerId,
            ...nodeInfo,
            limit,
            warningLimit,
            emergencyLimit,
            status: 'normal',
            percentage: Math.round((nodeInfo.nodeCount / limit) * 100)
        };

        // Determine status and log appropriate messages
        if (nodeInfo.nodeCount >= emergencyLimit) {
            result.status = 'emergency';
            console.error(`🚨 DOMSizeMonitor: EMERGENCY - Container ${containerId} has ${nodeInfo.nodeCount} nodes (${result.percentage}% of limit ${limit}). Emergency cleanup required!`);
        } else if (nodeInfo.nodeCount >= limit) {
            result.status = 'critical';
            console.warn(`⚠️ DOMSizeMonitor: CRITICAL - Container ${containerId} has ${nodeInfo.nodeCount} nodes (${result.percentage}% of limit ${limit}). Cleanup recommended!`);
        } else if (nodeInfo.nodeCount >= warningLimit) {
            result.status = 'warning';
            console.warn(`⚠️ DOMSizeMonitor: WARNING - Container ${containerId} has ${nodeInfo.nodeCount} nodes (${result.percentage}% of limit ${limit}). Monitor closely.`);
        } else {
            console.debug(`✅ DOMSizeMonitor: Container ${containerId} has ${nodeInfo.nodeCount} nodes (${result.percentage}% of limit ${limit}). Status: Normal`);
        }

        return result;
    }

    /**
     * Monitor all registered containers
     * @returns {Array} Array of monitoring results
     */
    monitorAllContainers() {
        const results = [];
        const scrollableContainers = ['slowQueries', 'pluginPerformance'];
        
        // Add any containers that have specific limits set
        for (const containerId of this.containerLimits.keys()) {
            if (!scrollableContainers.includes(containerId)) {
                scrollableContainers.push(containerId);
            }
        }

        scrollableContainers.forEach(containerId => {
            const result = this.monitorContainer(containerId);
            results.push(result);

            // Trigger emergency cleanup if needed
            if (result.status === 'emergency') {
                console.warn(`DOMSizeMonitor: Triggering emergency cleanup for ${containerId}`);
                DOMCleanup.emergencyCleanup(containerId);
            }
        });

        return results;
    }

    /**
     * Start periodic monitoring of all containers
     * @param {number} frequency - Monitoring frequency in milliseconds (default: 30000)
     */
    startMonitoring(frequency = this.monitoringFrequency) {
        if (this.monitoringInterval) {
            console.warn('DOMSizeMonitor: Monitoring already started');
            return;
        }

        this.monitoringFrequency = frequency;
        console.log(`DOMSizeMonitor: Starting periodic monitoring every ${frequency}ms`);

        this.monitoringInterval = setInterval(() => {
            const results = this.monitorAllContainers();
            const criticalContainers = results.filter(r => r.status === 'critical' || r.status === 'emergency');
            
            if (criticalContainers.length > 0) {
                console.warn(`DOMSizeMonitor: ${criticalContainers.length} containers need attention:`, 
                    criticalContainers.map(c => `${c.containerId}: ${c.nodeCount} nodes`));
            }
        }, frequency);
    }

    /**
     * Stop periodic monitoring
     */
    stopMonitoring() {
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
            this.monitoringInterval = null;
            console.log('DOMSizeMonitor: Stopped periodic monitoring');
        }
    }

    /**
     * Get monitoring statistics for all containers
     * @returns {Object} Summary statistics
     */
    getMonitoringStats() {
        const results = this.monitorAllContainers();
        const stats = {
            totalContainers: results.length,
            normal: results.filter(r => r.status === 'normal').length,
            warning: results.filter(r => r.status === 'warning').length,
            critical: results.filter(r => r.status === 'critical').length,
            emergency: results.filter(r => r.status === 'emergency').length,
            totalNodes: results.reduce((sum, r) => sum + (r.nodeCount || 0), 0),
            containers: results
        };

        console.log('DOMSizeMonitor: Current statistics:', stats);
        return stats;
    }
}

/**
 * DOMCleanup utility class for preventing memory leaks
 */
class DOMCleanup {
    /**
     * Clean up a container and its children to prevent memory leaks
     * @param {HTMLElement|string} container - The container element or its ID
     */
    static cleanupContainer(container) {
        const element = typeof container === 'string' ? 
            document.getElementById(container) : container;

        if (!element) {
            console.warn('DOMCleanup: Container not found for cleanup');
            return;
        }

        // Remove all event listeners by cloning and replacing the element
        // This is more thorough than trying to track individual listeners
        const cleanElement = element.cloneNode(false);
        
        // Preserve the original content structure but remove event listeners
        cleanElement.innerHTML = element.innerHTML;
        
        // Replace the original element
        if (element.parentNode) {
            element.parentNode.replaceChild(cleanElement, element);
        }

        console.debug(`DOMCleanup: Cleaned up container ${element.id || 'unnamed'}`);
        return cleanElement;
    }

    /**
     * Clean up Chart.js instances to prevent memory leaks
     * @param {HTMLElement|string} container - The container element or its ID
     */
    static cleanupCharts(container) {
        const element = typeof container === 'string' ? 
            document.getElementById(container) : container;

        if (!element) return;

        // Find all canvas elements that might have Chart.js instances
        const canvases = element.querySelectorAll('canvas');
        canvases.forEach(canvas => {
            // Check if canvas has a Chart.js instance
            const chart = Chart.getChart(canvas);
            if (chart) {
                chart.destroy();
                console.debug('DOMCleanup: Destroyed Chart.js instance');
            }
        });
    }

    /**
     * Monitor DOM size and log warnings if it exceeds limits
     * @param {HTMLElement|string} container - The container element or its ID
     * @param {number} maxNodes - Maximum number of nodes allowed (default: 1000)
     * @deprecated Use DOMSizeMonitor.monitorContainer() instead
     */
    static monitorDOMSize(container, maxNodes = 1000) {
        const element = typeof container === 'string' ? 
            document.getElementById(container) : container;

        if (!element) return { nodeCount: 0, warning: false };

        const nodeCount = element.querySelectorAll('*').length;
        const warning = nodeCount > maxNodes;

        if (warning) {
            console.warn(`DOMCleanup: Container ${element.id || 'unnamed'} has ${nodeCount} nodes (limit: ${maxNodes})`);
        }

        return { nodeCount, warning };
    }

    /**
     * Emergency cleanup for containers that have grown too large
     * @param {HTMLElement|string} container - The container element or its ID
     */
    static emergencyCleanup(container) {
        const element = typeof container === 'string' ? 
            document.getElementById(container) : container;

        if (!element) return;

        const containerId = element.id || 'unnamed';
        console.warn(`🚨 DOMCleanup: Performing emergency cleanup on ${containerId}`);
        
        // Clean up any charts first
        this.cleanupCharts(element);
        
        // Clear all content with a styled notice
        element.innerHTML = `
            <div class="cleanup-notice" style="
                text-align: center; 
                padding: 40px 20px; 
                color: #f85149; 
                background: rgba(248, 81, 73, 0.1); 
                border: 1px solid rgba(248, 81, 73, 0.3); 
                border-radius: 8px; 
                margin: 20px 0;
            ">
                <div style="font-size: 24px; margin-bottom: 10px;">🚨</div>
                <div style="font-weight: bold; margin-bottom: 8px;">Emergency Cleanup Performed</div>
                <div style="font-size: 14px; color: #8b949e;">
                    Container exceeded size limits and was cleared.<br>
                    Refreshing data...
                </div>
            </div>
        `;
        
        // Log the cleanup event
        console.warn(`DOMCleanup: Emergency cleanup completed for ${containerId}. Triggering data refresh.`);
        
        // Trigger a refresh after a short delay
        setTimeout(() => {
            if (typeof loadDashboardData === 'function') {
                loadDashboardData();
            }
        }, 2000); // Increased delay to show the notice
    }

    /**
     * Perform a thorough cleanup of a container with size verification
     * @param {HTMLElement|string} container - The container element or its ID
     * @param {number} targetMaxNodes - Target maximum nodes after cleanup
     */
    static thoroughCleanup(container, targetMaxNodes = 500) {
        const element = typeof container === 'string' ? 
            document.getElementById(container) : container;

        if (!element) return;

        const containerId = element.id || 'unnamed';
        const initialNodeCount = element.querySelectorAll('*').length;
        
        console.log(`DOMCleanup: Starting thorough cleanup of ${containerId} (${initialNodeCount} nodes)`);

        // Step 1: Clean up charts
        this.cleanupCharts(element);

        // Step 2: Remove any accumulated duplicate content
        const duplicateSelectors = [
            '.query-item', 
            '.plugin-item', 
            '.metric-item',
            '.performance-item'
        ];

        duplicateSelectors.forEach(selector => {
            const items = element.querySelectorAll(selector);
            if (items.length > targetMaxNodes / 10) { // Keep only reasonable number of items
                console.warn(`DOMCleanup: Found ${items.length} ${selector} items, keeping only the first ${Math.floor(targetMaxNodes / 10)}`);
                for (let i = Math.floor(targetMaxNodes / 10); i < items.length; i++) {
                    items[i].remove();
                }
            }
        });

        // Step 3: Verify cleanup was effective
        const finalNodeCount = element.querySelectorAll('*').length;
        const cleanupEffectiveness = ((initialNodeCount - finalNodeCount) / initialNodeCount) * 100;

        console.log(`DOMCleanup: Thorough cleanup completed for ${containerId}. Reduced from ${initialNodeCount} to ${finalNodeCount} nodes (${cleanupEffectiveness.toFixed(1)}% reduction)`);

        // Step 4: If still too large, perform emergency cleanup
        if (finalNodeCount > targetMaxNodes * 1.5) {
            console.warn(`DOMCleanup: Thorough cleanup insufficient, performing emergency cleanup`);
            this.emergencyCleanup(element);
        }
    }
}

/**
 * UpdateThrottler utility class for preventing rapid successive updates
 */
class UpdateThrottler {
    constructor() {
        this.throttleTimers = new Map();
        this.lastUpdateTimes = new Map();
        this.pendingUpdates = new Map();
        this.defaultThrottleDelay = 1000; // 1 second default throttle
    }

    /**
     * Throttle an update function to prevent rapid successive calls
     * @param {string} key - Unique key for the update (usually containerId)
     * @param {Function} updateFunction - Function to throttle
     * @param {number} delay - Throttle delay in milliseconds
     * @returns {Promise} Promise that resolves when the update is executed
     */
    throttleUpdate(key, updateFunction, delay = this.defaultThrottleDelay) {
        return new Promise((resolve, reject) => {
            const now = Date.now();
            const lastUpdate = this.lastUpdateTimes.get(key) || 0;
            const timeSinceLastUpdate = now - lastUpdate;

            // Clear any existing timer for this key
            if (this.throttleTimers.has(key)) {
                clearTimeout(this.throttleTimers.get(key));
            }

            // Store the pending update
            this.pendingUpdates.set(key, { updateFunction, resolve, reject, timestamp: now });

            if (timeSinceLastUpdate >= delay) {
                // Execute immediately if enough time has passed
                this.executeUpdate(key);
            } else {
                // Schedule execution after remaining delay
                const remainingDelay = delay - timeSinceLastUpdate;
                console.debug(`UpdateThrottler: Throttling update for ${key}, executing in ${remainingDelay}ms`);
                
                const timer = setTimeout(() => {
                    this.executeUpdate(key);
                }, remainingDelay);
                
                this.throttleTimers.set(key, timer);
            }
        });
    }

    /**
     * Execute the pending update for a key
     * @param {string} key - The key to execute update for
     */
    async executeUpdate(key) {
        const pendingUpdate = this.pendingUpdates.get(key);
        if (!pendingUpdate) return;

        try {
            console.debug(`UpdateThrottler: Executing throttled update for ${key}`);
            const result = await pendingUpdate.updateFunction();
            this.lastUpdateTimes.set(key, Date.now());
            pendingUpdate.resolve(result);
        } catch (error) {
            console.error(`UpdateThrottler: Error executing throttled update for ${key}:`, error);
            pendingUpdate.reject(error);
        } finally {
            // Clean up
            this.pendingUpdates.delete(key);
            this.throttleTimers.delete(key);
        }
    }

    /**
     * Cancel a pending throttled update
     * @param {string} key - The key to cancel
     */
    cancelUpdate(key) {
        if (this.throttleTimers.has(key)) {
            clearTimeout(this.throttleTimers.get(key));
            this.throttleTimers.delete(key);
        }
        
        const pendingUpdate = this.pendingUpdates.get(key);
        if (pendingUpdate) {
            pendingUpdate.reject(new Error(`Update cancelled for ${key}`));
            this.pendingUpdates.delete(key);
        }
        
        console.debug(`UpdateThrottler: Cancelled update for ${key}`);
    }

    /**
     * Cancel all pending updates
     */
    cancelAllUpdates() {
        for (const key of this.throttleTimers.keys()) {
            this.cancelUpdate(key);
        }
        console.debug('UpdateThrottler: Cancelled all pending updates');
    }

    /**
     * Get throttling status for a key
     * @param {string} key - The key to check
     * @returns {Object} Status information
     */
    getThrottleStatus(key) {
        const lastUpdate = this.lastUpdateTimes.get(key) || 0;
        const hasPendingUpdate = this.pendingUpdates.has(key);
        const hasTimer = this.throttleTimers.has(key);
        
        return {
            lastUpdateTime: lastUpdate,
            timeSinceLastUpdate: Date.now() - lastUpdate,
            hasPendingUpdate,
            hasTimer,
            canUpdateImmediately: !hasPendingUpdate && !hasTimer
        };
    }

    /**
     * Set default throttle delay
     * @param {number} delay - Default delay in milliseconds
     */
    setDefaultDelay(delay) {
        this.defaultThrottleDelay = delay;
        console.debug(`UpdateThrottler: Set default throttle delay to ${delay}ms`);
    }

    /**
     * Force execute all pending updates immediately (bypass throttling)
     */
    async flushAllUpdates() {
        console.debug('UpdateThrottler: Flushing all pending updates');
        const keys = Array.from(this.pendingUpdates.keys());
        
        for (const key of keys) {
            if (this.throttleTimers.has(key)) {
                clearTimeout(this.throttleTimers.get(key));
                this.throttleTimers.delete(key);
            }
            await this.executeUpdate(key);
        }
    }
}

/**
 * ContentUpdateManager class for coordinated content updates with cleanup and scroll preservation
 */
class ContentUpdateManager {
    constructor() {
        this.scrollPreserver = new ScrollPreserver();
        this.updateInProgress = new Set();
        this.updateQueue = new Map();
        this.updateLocks = new Map(); // Enhanced locking mechanism
        this.updateThrottler = new UpdateThrottler();
        this.domSizeLimit = 1000; // Default DOM node limit per container
        this.domSizeMonitor = new DOMSizeMonitor();
        
        // Error recovery and rollback mechanisms
        this.containerSnapshots = new Map(); // Store container snapshots for rollback
        this.updateHistory = new Map(); // Track update history for debugging
        this.errorLog = []; // Comprehensive error logging
        this.maxErrorLogSize = 100; // Maximum error log entries
        this.rollbackEnabled = true; // Enable/disable rollback functionality
        this.corruptionDetection = true; // Enable/disable corruption detection
        this.maxRollbackAttempts = 3; // Maximum rollback attempts per container
        this.rollbackAttempts = new Map(); // Track rollback attempts per container
        this.pendingTimeouts = new Set();
        this.monitoringStartTimeout = null;
        
        // Throttling configuration
        this.throttleDelays = new Map(); // Per-container throttle delays
        this.defaultThrottleDelay = 1000; // 1 second default
        this.maxQueueSize = 5; // Maximum queued updates per container
        
        // Coordination settings
        this.globalUpdateLock = false; // Global lock for emergency situations
        this.updateCoordinator = new Map(); // Track update dependencies
        
        // Set up default limits for scrollable containers
        this.domSizeMonitor.setContainerLimit('slowQueries', 1000);
        this.domSizeMonitor.setContainerLimit('pluginPerformance', 1000);
        
        // Set up default throttle delays for different container types
        this.setContainerThrottleDelay('slowQueries', 2000); // 2 seconds for slow queries
        this.setContainerThrottleDelay('pluginPerformance', 1500); // 1.5 seconds for plugins
        this.setContainerThrottleDelay('real-time-metrics', 500); // 0.5 seconds for real-time data
        
        // Start monitoring after a short delay to allow DOM to initialize
        this.monitoringStartTimeout = setTimeout(() => {
            this.domSizeMonitor.startMonitoring();
        }, 5000);
    }

    /**
     * Create a snapshot of a container's current state for rollback purposes
     * @param {string} containerId - The ID of the container
     * @returns {Object} Container snapshot
     */
    createContainerSnapshot(containerId) {
        const container = document.getElementById(containerId);
        if (!container) {
            this.logError('SNAPSHOT_FAILED', `Container ${containerId} not found for snapshot`, { containerId });
            return null;
        }

        const snapshot = {
            containerId,
            innerHTML: container.innerHTML,
            scrollTop: container.scrollTop,
            scrollHeight: container.scrollHeight,
            clientHeight: container.clientHeight,
            nodeCount: container.querySelectorAll('*').length,
            timestamp: Date.now(),
            snapshotId: Math.random().toString(36).substr(2, 9)
        };

        this.containerSnapshots.set(containerId, snapshot);
        console.debug(`ContentUpdateManager: Created snapshot for ${containerId} (${snapshot.nodeCount} nodes)`);
        
        return snapshot;
    }

    /**
     * Rollback a container to its previous snapshot
     * @param {string} containerId - The ID of the container
     * @param {string} reason - Reason for rollback
     * @returns {boolean} True if rollback was successful
     */
    async rollbackContainer(containerId, reason = 'Update failed') {
        if (!this.rollbackEnabled) {
            this.logError('ROLLBACK_DISABLED', `Rollback disabled for ${containerId}`, { containerId, reason });
            return false;
        }

        const snapshot = this.containerSnapshots.get(containerId);
        if (!snapshot) {
            this.logError('ROLLBACK_NO_SNAPSHOT', `No snapshot available for rollback of ${containerId}`, { containerId, reason });
            return false;
        }

        // Check rollback attempt limits
        const attempts = this.rollbackAttempts.get(containerId) || 0;
        if (attempts >= this.maxRollbackAttempts) {
            this.logError('ROLLBACK_MAX_ATTEMPTS', `Maximum rollback attempts exceeded for ${containerId}`, { 
                containerId, 
                attempts, 
                maxAttempts: this.maxRollbackAttempts,
                reason 
            });
            
            // Force container recreation as last resort
            return this.recreateContainer(containerId, 'Max rollback attempts exceeded');
        }

        try {
            const container = document.getElementById(containerId);
            if (!container) {
                this.logError('ROLLBACK_CONTAINER_MISSING', `Container ${containerId} missing during rollback`, { containerId, reason });
                return false;
            }

            console.warn(`ContentUpdateManager: Rolling back ${containerId} - ${reason}`);
            
            // Increment rollback attempts
            this.rollbackAttempts.set(containerId, attempts + 1);
            
            // Clean up any existing charts before rollback
            DOMCleanup.cleanupCharts(container);
            
            // Restore container content
            container.innerHTML = snapshot.innerHTML;
            
            // Restore scroll position
            container.scrollTop = snapshot.scrollTop;
            
            // Verify rollback success
            const postRollbackNodeCount = container.querySelectorAll('*').length;
            const rollbackSuccess = Math.abs(postRollbackNodeCount - snapshot.nodeCount) <= 5; // Allow small variance
            
            if (rollbackSuccess) {
                console.log(`ContentUpdateManager: Successfully rolled back ${containerId} to snapshot ${snapshot.snapshotId}`);
                
                // Log successful rollback
                this.logError('ROLLBACK_SUCCESS', `Container ${containerId} successfully rolled back`, {
                    containerId,
                    reason,
                    snapshotId: snapshot.snapshotId,
                    snapshotAge: Date.now() - snapshot.timestamp,
                    nodeCountBefore: postRollbackNodeCount,
                    nodeCountAfter: snapshot.nodeCount
                });
                
                // Reset rollback attempts on successful rollback
                this.rollbackAttempts.delete(containerId);
                
                return true;
            } else {
                this.logError('ROLLBACK_VERIFICATION_FAILED', `Rollback verification failed for ${containerId}`, {
                    containerId,
                    reason,
                    expectedNodes: snapshot.nodeCount,
                    actualNodes: postRollbackNodeCount,
                    difference: Math.abs(postRollbackNodeCount - snapshot.nodeCount)
                });
                
                // Try container recreation as fallback
                return this.recreateContainer(containerId, 'Rollback verification failed');
            }
            
        } catch (error) {
            this.logError('ROLLBACK_EXCEPTION', `Exception during rollback of ${containerId}`, {
                containerId,
                reason,
                error: error.message,
                stack: error.stack
            });
            
            // Try container recreation as fallback
            return this.recreateContainer(containerId, `Rollback exception: ${error.message}`);
        }
    }

    /**
     * Recreate a container completely as a fallback mechanism
     * @param {string} containerId - The ID of the container
     * @param {string} reason - Reason for recreation
     * @returns {boolean} True if recreation was successful
     */
    async recreateContainer(containerId, reason = 'Container corruption detected') {
        try {
            const container = document.getElementById(containerId);
            if (!container) {
                this.logError('RECREATION_CONTAINER_MISSING', `Container ${containerId} missing during recreation`, { containerId, reason });
                return false;
            }

            console.warn(`ContentUpdateManager: Recreating container ${containerId} - ${reason}`);
            
            // Clean up existing content thoroughly
            DOMCleanup.cleanupCharts(container);
            
            // Create a clean container with basic structure
            const containerClass = container.className;
            const containerStyle = container.getAttribute('style') || '';
            
            // Clear all content and rebuild basic structure
            container.innerHTML = `
                <div class="container-recreation-notice" style="
                    text-align: center; 
                    padding: 30px 20px; 
                    color: #f79000; 
                    background: rgba(247, 144, 0, 0.1); 
                    border: 1px solid rgba(247, 144, 0, 0.3); 
                    border-radius: 8px; 
                    margin: 20px 0;
                ">
                    <div style="font-size: 20px; margin-bottom: 8px;">🔄</div>
                    <div style="font-weight: bold; margin-bottom: 6px;">Container Recreated</div>
                    <div style="font-size: 13px; color: #8b949e;">
                        ${reason}<br>
                        Loading fresh data...
                    </div>
                </div>
            `;
            
            // Reset container attributes
            container.className = containerClass;
            if (containerStyle) {
                container.setAttribute('style', containerStyle);
            }
            
            // Reset scroll position
            container.scrollTop = 0;
            
            // Clear any cached state for this container
            this.containerSnapshots.delete(containerId);
            this.rollbackAttempts.delete(containerId);
            this.scrollPreserver.clear(containerId);
            
            // Log successful recreation
            this.logError('CONTAINER_RECREATED', `Container ${containerId} successfully recreated`, {
                containerId,
                reason,
                timestamp: Date.now()
            });
            
            console.log(`ContentUpdateManager: Successfully recreated container ${containerId}`);
            
            // Trigger data refresh after a delay
            const refreshTimeout = setTimeout(() => {
                this.pendingTimeouts.delete(refreshTimeout);
                if (typeof loadDashboardData === 'function') {
                    console.log(`ContentUpdateManager: Triggering data refresh after container recreation`);
                    loadDashboardData();
                }
            }, 2000);
            this.pendingTimeouts.add(refreshTimeout);
            
            return true;
            
        } catch (error) {
            this.logError('RECREATION_EXCEPTION', `Exception during recreation of ${containerId}`, {
                containerId,
                reason,
                error: error.message,
                stack: error.stack
            });
            
            console.error(`ContentUpdateManager: Failed to recreate container ${containerId}:`, error);
            return false;
        }
    }

    /**
     * Detect if a container is corrupted or in an invalid state
     * @param {string} containerId - The ID of the container
     * @returns {Object} Corruption detection result
     */
    detectContainerCorruption(containerId) {
        if (!this.corruptionDetection) {
            return { corrupted: false, reason: 'Detection disabled' };
        }

        const container = document.getElementById(containerId);
        if (!container) {
            return { corrupted: true, reason: 'Container not found' };
        }

        const nodeCount = container.querySelectorAll('*').length;
        const limit = this.domSizeMonitor.getContainerLimit(containerId);
        
        // Check for various corruption indicators
        const corruptionChecks = {
            // Excessive DOM size
            excessiveSize: nodeCount > limit * 2,
            
            // Duplicate content patterns (common sign of accumulation)
            duplicateContent: this.detectDuplicateContent(container),
            
            // Malformed HTML structure
            malformedStructure: this.detectMalformedStructure(container),
            
            // Memory leak indicators
            memoryLeakSigns: this.detectMemoryLeakSigns(container),
            
            // Scroll position anomalies
            scrollAnomalies: this.detectScrollAnomalies(container)
        };

        const corruptionReasons = [];
        let corrupted = false;

        for (const [check, result] of Object.entries(corruptionChecks)) {
            if (result) {
                corrupted = true;
                corruptionReasons.push(check);
            }
        }

        const corruptionResult = {
            corrupted,
            reasons: corruptionReasons,
            nodeCount,
            limit,
            checks: corruptionChecks,
            severity: corrupted ? (corruptionReasons.length > 2 ? 'critical' : 'moderate') : 'none'
        };

        if (corrupted) {
            this.logError('CORRUPTION_DETECTED', `Container corruption detected for ${containerId}`, {
                containerId,
                ...corruptionResult
            });
        }

        return corruptionResult;
    }

    /**
     * Detect duplicate content patterns in a container
     * @param {HTMLElement} container - The container element
     * @returns {boolean} True if duplicate content is detected
     */
    detectDuplicateContent(container) {
        const items = container.querySelectorAll('.query-item, .plugin-item, .metric-item, .performance-item');
        if (items.length < 10) return false; // Not enough items to detect duplicates reliably

        const contentHashes = new Map();
        let duplicateCount = 0;

        items.forEach(item => {
            // Create a simple hash of the item's text content
            const content = item.textContent.trim();
            const hash = content.substring(0, 100); // Use first 100 chars as hash
            
            if (contentHashes.has(hash)) {
                contentHashes.set(hash, contentHashes.get(hash) + 1);
                duplicateCount++;
            } else {
                contentHashes.set(hash, 1);
            }
        });

        // Consider it duplicate content if more than 20% of items are duplicates
        return duplicateCount > items.length * 0.2;
    }

    /**
     * Detect malformed HTML structure in a container
     * @param {HTMLElement} container - The container element
     * @returns {boolean} True if malformed structure is detected
     */
    detectMalformedStructure(container) {
        try {
            const html = container.innerHTML;
            if (!html || !html.includes('<')) {
                return false;
            }

            const openCount = (html.match(/</g) || []).length;
            const closeCount = (html.match(/>/g) || []).length;

            return openCount !== closeCount;
        } catch (error) {
            return false;
        }
    }

    /**
     * Detect memory leak signs in a container
     * @param {HTMLElement} container - The container element
     * @returns {boolean} True if memory leak signs are detected
     */
    detectMemoryLeakSigns(container) {
        // Check for excessive event listeners (approximation)
        const elementsWithEvents = container.querySelectorAll('[onclick], [onload], [onerror]');
        
        // Check for excessive inline styles (can indicate dynamic accumulation)
        const elementsWithInlineStyles = container.querySelectorAll('[style]');
        
        // Check for excessive data attributes (can indicate state accumulation)
        const elementsWithDataAttrs = container.querySelectorAll('[data-chart-id], [data-update-id]');
        
        const totalElements = container.querySelectorAll('*').length;
        if (totalElements < 20) {
            return false;
        }
        
        // Consider it a memory leak sign if more than 60% of elements have these attributes
        return (elementsWithEvents.length + elementsWithInlineStyles.length + elementsWithDataAttrs.length) > totalElements * 0.6;
    }

    /**
     * Detect scroll position anomalies in a container
     * @param {HTMLElement} container - The container element
     * @returns {boolean} True if scroll anomalies are detected
     */
    detectScrollAnomalies(container) {
        if (container.scrollHeight === 0 || container.clientHeight === 0) {
            return false;
        }

        // Check if scroll position is beyond content bounds
        if (container.scrollTop > container.scrollHeight - container.clientHeight + 10) {
            return true;
        }
        
        // Check if scroll height is unreasonably large compared to client height
        if (container.scrollHeight > container.clientHeight * 50) {
            return true;
        }
        
        return false;
    }

    /**
     * Log errors with comprehensive context for debugging
     * @param {string} errorType - Type of error
     * @param {string} message - Error message
     * @param {Object} context - Additional context data
     */
    logError(errorType, message, context = {}) {
        const errorEntry = {
            type: errorType,
            message,
            context,
            timestamp: Date.now(),
            userAgent: navigator.userAgent,
            url: window.location.href,
            memoryUsage: performance.memory ? {
                used: performance.memory.usedJSHeapSize,
                total: performance.memory.totalJSHeapSize,
                limit: performance.memory.jsHeapSizeLimit
            } : null,
            errorId: Math.random().toString(36).substr(2, 9)
        };

        // Add to error log
        this.errorLog.push(errorEntry);
        
        // Maintain log size limit
        if (this.errorLog.length > this.maxErrorLogSize) {
            this.errorLog.shift(); // Remove oldest entry
        }

        // Log to console based on error type severity
        const severityMap = {
            'ROLLBACK_SUCCESS': 'log',
            'CONTAINER_RECREATED': 'log',
            'CORRUPTION_DETECTED': 'warn',
            'ROLLBACK_FAILED': 'error',
            'RECREATION_EXCEPTION': 'error'
        };

        const logLevel = severityMap[errorType] || 'warn';
        console[logLevel](`ContentUpdateManager [${errorType}]: ${message}`, context);

        // Store in session storage for debugging (optional)
        try {
            const existingLogs = JSON.parse(sessionStorage.getItem('contentUpdateManagerErrors') || '[]');
            existingLogs.push(errorEntry);
            
            // Keep only last 50 entries in session storage
            if (existingLogs.length > 50) {
                existingLogs.splice(0, existingLogs.length - 50);
            }
            
            sessionStorage.setItem('contentUpdateManagerErrors', JSON.stringify(existingLogs));
        } catch (storageError) {
            console.warn('Could not store error log in session storage:', storageError);
        }
    }

    /**
     * Get error log entries
     * @param {string} filterType - Optional error type filter
     * @returns {Array} Array of error log entries
     */
    getErrorLog(filterType = null) {
        if (filterType) {
            return this.errorLog.filter(entry => entry.type === filterType);
        }
        return [...this.errorLog];
    }

    /**
     * Clear error log
     */
    clearErrorLog() {
        this.errorLog = [];
        try {
            sessionStorage.removeItem('contentUpdateManagerErrors');
        } catch (error) {
            console.warn('Could not clear error log from session storage:', error);
        }
        console.log('ContentUpdateManager: Error log cleared');
    }

    /**
     * Update a container with proper cleanup and scroll preservation
     * @param {string} containerId - The ID of the container to update
     * @param {Function} updateFunction - Function that performs the actual update
     * @param {*} data - Data to pass to the update function
     * @param {Object} options - Update options
     */
     async updateContainer(containerId, updateFunction, data, options = {}) {
        const {
            preserveScroll = true,
            cleanupRequired = true,
            emergencyCleanupThreshold = this.domSizeLimit,
            bypassThrottle = false,
            priority = 'normal', // 'low', 'normal', 'high', 'critical'
            retryAttempts = 0,
            retryDelay = 0,
            allowMissingContainer = true
        } = options;
        const suppressErrors = options.suppressErrors ?? (priority !== 'high' && priority !== 'critical');


        // Check global lock
        if (this.globalUpdateLock && priority !== 'critical') {
            console.warn(`ContentUpdateManager: Global update lock active, rejecting ${priority} priority update for ${containerId}`);
            throw new Error(`Global update lock active - ${containerId} update rejected`);
        }

        const resolvedOptions = {
            preserveScroll,
            cleanupRequired,
            emergencyCleanupThreshold,
            bypassThrottle,
            priority,
            retryAttempts,
            retryDelay,
            suppressErrors,
            allowMissingContainer
        };

        // Apply throttling unless bypassed or critical priority
        if (!bypassThrottle && priority !== 'critical') {
            const throttleDelay = this.getContainerThrottleDelay(containerId);
            
            return this.updateThrottler.throttleUpdate(
                containerId,
                () => this.executeContainerUpdate(containerId, updateFunction, data, resolvedOptions),
                throttleDelay
            );
        }

        // Execute immediately for critical updates or when throttling is bypassed
        return this.executeContainerUpdate(containerId, updateFunction, data, resolvedOptions);
    }

    /**
     * Execute the actual container update (internal method)
     * @param {string} containerId - The ID of the container to update
     * @param {Function} updateFunction - Function that performs the actual update
     * @param {*} data - Data to pass to the update function
     * @param {Object} options - Update options
     */
    async executeContainerUpdate(containerId, updateFunction, data, options = {}) {
        const {
            preserveScroll = true,
            cleanupRequired = true,
            emergencyCleanupThreshold = this.domSizeLimit,
            priority = 'normal',
            enablePerformanceMonitoring = true,
            retryAttempts = 0,
            retryDelay = 0,
            suppressErrors = false,
            allowMissingContainer = true
        } = options;

        // Acquire update lock
        if (!this.acquireUpdateLock(containerId, priority)) {
            console.debug(`ContentUpdateManager: Could not acquire lock for ${containerId}, queuing...`);
            return this.queueUpdate(containerId, updateFunction, data, options);
        }

        // Prevent concurrent updates on the same container (additional safety check)
        if (this.updateInProgress.has(containerId)) {
            console.debug(`ContentUpdateManager: Update already in progress for ${containerId}, queuing...`);
            this.releaseUpdateLock(containerId);
            return this.queueUpdate(containerId, updateFunction, data, options);
        }

        this.updateInProgress.add(containerId);

        try {
            let container = document.getElementById(containerId);
            if (!container && allowMissingContainer) {
                container = document.createElement('div');
                container.id = containerId;
                document.body.appendChild(container);
                console.warn(`ContentUpdateManager: Recreated missing container ${containerId} in document body`);
            }

            if (!container) {
                throw new Error(`Container ${containerId} not found`);
            }

            let attempt = 0;
            while (attempt <= retryAttempts) {
                try {
                    if (enablePerformanceMonitoring && window.performanceMonitor) {
                        return await window.performanceMonitor.instrumentUpdate(
                            containerId,
                            async (updateData) => {
                                return await this.executeUpdateWithMonitoring(containerId, updateFunction, updateData, options);
                            },
                            data
                        );
                    }

                    // Fallback to direct execution without performance monitoring
                    return await this.executeUpdateWithMonitoring(containerId, updateFunction, data, options);
                } catch (error) {
                    attempt += 1;
                    if (attempt > retryAttempts) {
                        if (suppressErrors) {
                            return null;
                        }
                        throw error;
                    }

                    if (retryDelay > 0) {
                        await new Promise(resolve => setTimeout(resolve, retryDelay));
                    }
                }
            }

            return null;
        } catch (error) {
            console.error(`ContentUpdateManager: Error updating ${containerId}:`, error);
            throw error;
        } finally {
            this.updateInProgress.delete(containerId);
            this.releaseUpdateLock(containerId);
            
            // Process any queued updates
            this.processQueue(containerId);
        }
    }

    /**
     * Execute update with monitoring (internal method)
     * @param {string} containerId - The ID of the container to update
     * @param {Function} updateFunction - Function that performs the actual update
     * @param {*} data - Data to pass to the update function
     * @param {Object} options - Update options
     */
    async executeUpdateWithMonitoring(containerId, updateFunction, data, options = {}) {
        const {
            preserveScroll = true,
            cleanupRequired = true,
            enableRollback = this.rollbackEnabled,
            suppressErrors = false
        } = options;

        const container = document.getElementById(containerId);
        if (!container) {
            const error = new Error(`Container ${containerId} not found`);
            this.logError('CONTAINER_NOT_FOUND', error.message, { containerId, options });
            throw error;
        }

        // Create snapshot for rollback if enabled
        let snapshot = null;
        if (enableRollback) {
            snapshot = this.createContainerSnapshot(containerId);
        }

        // Check for corruption before update
        const corruptionCheck = this.detectContainerCorruption(containerId);
        if (corruptionCheck.corrupted && corruptionCheck.severity === 'critical') {
            console.warn(`ContentUpdateManager: Critical corruption detected in ${containerId}, recreating container`);
            const recreated = await this.recreateContainer(containerId, `Critical corruption: ${corruptionCheck.reasons.join(', ')}`);
            if (!recreated) {
                const error = new Error(`Failed to recreate corrupted container ${containerId}`);
                this.logError('RECREATION_FAILED', error.message, { containerId, corruptionCheck });
                throw error;
            }
            return; // Exit early after recreation
        }

        // Record pre-update state for performance analysis
        const preUpdateTime = performance.now();
        const preUpdateNodeCount = container.querySelectorAll('*').length;
        const preUpdateMemory = performance.memory ? performance.memory.usedJSHeapSize : 0;

        // Check DOM size before update using the new monitoring system
        const preUpdateMonitoring = this.domSizeMonitor.monitorContainer(containerId);
        
        if (preUpdateMonitoring.status === 'emergency') {
            console.warn(`ContentUpdateManager: Container ${containerId} in emergency state, performing cleanup before update`);
            DOMCleanup.emergencyCleanup(container);
            return;
        } else if (preUpdateMonitoring.status === 'critical') {
            console.warn(`ContentUpdateManager: Container ${containerId} in critical state, performing thorough cleanup before update`);
            DOMCleanup.thoroughCleanup(container, Math.floor(preUpdateMonitoring.limit * 0.5));
        }

        // Save scroll position if requested (with user interaction detection)
        if (preserveScroll) {
            const saved = this.scrollPreserver.savePositionSafe(containerId);
            if (!saved) {
                console.debug(`ContentUpdateManager: Skipping scroll preservation for ${containerId} due to user interaction`);
            }
        }

        // Perform cleanup if requested
        if (cleanupRequired) {
            DOMCleanup.cleanupCharts(container);
        }

        let result = null;
        let updateSuccessful = false;

        try {
            // Execute the update function
            result = await updateFunction(data);
            updateSuccessful = true;

            // Verify update success by checking for corruption
            const postUpdateCorruption = this.detectContainerCorruption(containerId);
            if (postUpdateCorruption.corrupted) {
                throw new Error(`Update resulted in container corruption: ${postUpdateCorruption.reasons.join(', ')}`);
            }

        } catch (updateError) {
            this.logError('UPDATE_FAILED', `Update failed for ${containerId}: ${updateError.message}`, {
                containerId,
                error: updateError.message,
                stack: updateError.stack,
                data: typeof data === 'object' ? JSON.stringify(data).substring(0, 500) : String(data).substring(0, 500)
            });

            // Attempt rollback if enabled and snapshot exists
            if (enableRollback && snapshot) {
                console.warn(`ContentUpdateManager: Attempting rollback for ${containerId} due to update failure`);
                const rollbackSuccess = await this.rollbackContainer(containerId, `Update failed: ${updateError.message}`);
                
                if (rollbackSuccess) {
                    if (suppressErrors) {
                        return null;
                    }
                    throw updateError;
                } else {
                    // Rollback failed, log additional error
                    this.logError('ROLLBACK_AFTER_UPDATE_FAILED', `Both update and rollback failed for ${containerId}`, {
                        containerId,
                        originalError: updateError.message,
                        rollbackFailed: true
                    });
                }
            }

            // If rollback is disabled or failed, try container recreation
            console.warn(`ContentUpdateManager: Attempting container recreation for ${containerId} as fallback`);
            const recreationSuccess = await this.recreateContainer(containerId, `Update failed and rollback unavailable: ${updateError.message}`);
            
            if (!recreationSuccess) {
                // Both rollback and recreation failed - this is a critical error
                this.logError('COMPLETE_RECOVERY_FAILED', `All recovery mechanisms failed for ${containerId}`, {
                    containerId,
                    originalError: updateError.message,
                    rollbackAttempted: enableRollback && snapshot,
                    recreationAttempted: true
                });
                
                // Re-throw the original error since we couldn't recover
                throw updateError;
            }

            if (suppressErrors) {
                return null;
            }
            throw updateError;
        }

        // If we reach here, the update was successful
        // Record post-update metrics
        const postUpdateTime = performance.now();
        const postUpdateNodeCount = container.querySelectorAll('*').length;
        const postUpdateMemory = performance.memory ? performance.memory.usedJSHeapSize : 0;
        const updateDuration = postUpdateTime - preUpdateTime;

        // Restore scroll position if requested
        if (preserveScroll) {
            // Use requestAnimationFrame to ensure DOM has been updated
            requestAnimationFrame(() => {
                this.scrollPreserver.restorePosition(containerId);
            });
        }

        // Monitor DOM size after update and log results
        const postUpdateMonitoring = this.domSizeMonitor.monitorContainer(containerId);
        
        // Compile comprehensive performance metrics
        const performanceMetrics = {
            containerId,
            updateDuration: parseFloat(updateDuration.toFixed(2)),
            nodeCountBefore: preUpdateNodeCount,
            nodeCountAfter: postUpdateNodeCount,
            nodeCountDelta: postUpdateNodeCount - preUpdateNodeCount,
            memoryBefore: preUpdateMemory,
            memoryAfter: postUpdateMemory,
            memoryDelta: postUpdateMemory - preUpdateMemory,
            domStatus: postUpdateMonitoring.status,
            domUsagePercent: postUpdateMonitoring.percentage,
            timestamp: Date.now(),
            rollbackEnabled: enableRollback,
            snapshotCreated: !!snapshot,
            updateSuccessful: true
        };

        // Log performance metrics based on severity
        if (postUpdateMonitoring.status === 'warning' || postUpdateMonitoring.status === 'critical' || updateDuration > 200) {
            console.warn(`ContentUpdateManager: Performance concern for ${containerId}:`, performanceMetrics);
        } else {
            console.debug(`ContentUpdateManager: Updated ${containerId}:`, performanceMetrics);
        }

        // Store performance data for benchmarking if performance monitor is available
        if (window.performanceMonitor && window.performanceMonitor.frequencyBenchmark) {
            window.performanceMonitor.frequencyBenchmark.recordUpdate(containerId, {
                ...performanceMetrics,
                success: true
            });
        }

        // Store successful update in history for debugging
        this.updateHistory.set(containerId, {
            timestamp: Date.now(),
            nodeCount: postUpdateNodeCount,
            duration: updateDuration,
            success: true,
            dataSize: typeof data === 'object' ? JSON.stringify(data).length : String(data).length
        });

        // Clear rollback attempts on successful update
        this.rollbackAttempts.delete(containerId);

        return result;
    }

    /**
     * Acquire an update lock for a container
     * @param {string} containerId - The ID of the container
     * @param {string} priority - Priority level of the update
     * @returns {boolean} True if lock was acquired
     */
    acquireUpdateLock(containerId, priority = 'normal') {
        const existingLock = this.updateLocks.get(containerId);
        
        if (!existingLock) {
            // No existing lock, acquire it
            this.updateLocks.set(containerId, {
                priority,
                timestamp: Date.now(),
                lockId: Math.random().toString(36).substr(2, 9)
            });
            console.debug(`ContentUpdateManager: Acquired lock for ${containerId} (priority: ${priority})`);
            return true;
        }

        // Check if we can override existing lock based on priority
        const priorityLevels = { 'low': 1, 'normal': 2, 'high': 3, 'critical': 4 };
        const currentPriority = priorityLevels[existingLock.priority] || 2;
        const requestedPriority = priorityLevels[priority] || 2;

        if (requestedPriority > currentPriority) {
            console.warn(`ContentUpdateManager: Overriding ${existingLock.priority} lock with ${priority} priority for ${containerId}`);
            this.updateLocks.set(containerId, {
                priority,
                timestamp: Date.now(),
                lockId: Math.random().toString(36).substr(2, 9)
            });
            return true;
        }

        // Check for stale locks (older than 30 seconds)
        const lockAge = Date.now() - existingLock.timestamp;
        if (lockAge > 30000) {
            console.warn(`ContentUpdateManager: Removing stale lock for ${containerId} (age: ${lockAge}ms)`);
            this.updateLocks.set(containerId, {
                priority,
                timestamp: Date.now(),
                lockId: Math.random().toString(36).substr(2, 9)
            });
            return true;
        }

        console.debug(`ContentUpdateManager: Could not acquire lock for ${containerId} (existing: ${existingLock.priority}, requested: ${priority})`);
        return false;
    }

    /**
     * Release an update lock for a container
     * @param {string} containerId - The ID of the container
     */
    releaseUpdateLock(containerId) {
        if (this.updateLocks.has(containerId)) {
            const lock = this.updateLocks.get(containerId);
            this.updateLocks.delete(containerId);
            console.debug(`ContentUpdateManager: Released lock for ${containerId} (was ${lock.priority} priority)`);
        }
    }

    /**
     * Set throttle delay for a specific container
     * @param {string} containerId - The ID of the container
     * @param {number} delay - Throttle delay in milliseconds
     */
    setContainerThrottleDelay(containerId, delay) {
        this.throttleDelays.set(containerId, delay);
        console.debug(`ContentUpdateManager: Set throttle delay for ${containerId}: ${delay}ms`);
    }

    /**
     * Get throttle delay for a specific container
     * @param {string} containerId - The ID of the container
     * @returns {number} Throttle delay in milliseconds
     */
    getContainerThrottleDelay(containerId) {
        return this.throttleDelays.get(containerId) || this.defaultThrottleDelay;
    }

    /**
     * Queue an update for later execution with enhanced queue management
     * @param {string} containerId - The ID of the container
     * @param {Function} updateFunction - Function that performs the update
     * @param {*} data - Data to pass to the update function
     * @param {Object} options - Update options
     */
    queueUpdate(containerId, updateFunction, data, options) {
        if (!this.updateQueue.has(containerId)) {
            this.updateQueue.set(containerId, []);
        }
        
        const queue = this.updateQueue.get(containerId);
        const priority = options.priority || 'normal';
        
        // Check queue size limits
        if (queue.length >= this.maxQueueSize) {
            console.warn(`ContentUpdateManager: Queue full for ${containerId}, removing oldest update`);
            
            // Remove the oldest non-critical update
            const nonCriticalIndex = queue.findIndex(item => (item.options.priority || 'normal') !== 'critical');
            if (nonCriticalIndex !== -1) {
                queue.splice(nonCriticalIndex, 1);
            } else {
                // If all are critical, remove the oldest one anyway
                queue.shift();
            }
        }
        
        const queueItem = { 
            updateFunction, 
            data, 
            options, 
            timestamp: Date.now(),
            queueId: Math.random().toString(36).substr(2, 9)
        };
        
        // Insert based on priority (critical updates go to front)
        if (priority === 'critical') {
            queue.unshift(queueItem);
            console.debug(`ContentUpdateManager: Queued CRITICAL update for ${containerId} (queue size: ${queue.length})`);
        } else {
            queue.push(queueItem);
            console.debug(`ContentUpdateManager: Queued ${priority} update for ${containerId} (queue size: ${queue.length})`);
        }
    }

    /**
     * Process queued updates for a container with priority handling
     * @param {string} containerId - The ID of the container
     */
    async processQueue(containerId) {
        const queue = this.updateQueue.get(containerId);
        if (!queue || queue.length === 0) return;

        // Sort queue by priority and timestamp (critical first, then by age)
        queue.sort((a, b) => {
            const priorityLevels = { 'low': 1, 'normal': 2, 'high': 3, 'critical': 4 };
            const aPriority = priorityLevels[a.options.priority || 'normal'];
            const bPriority = priorityLevels[b.options.priority || 'normal'];
            
            if (aPriority !== bPriority) {
                return bPriority - aPriority; // Higher priority first
            }
            
            return a.timestamp - b.timestamp; // Older first for same priority
        });

        // Process the highest priority update
        const nextUpdate = queue.shift();
        
        // For non-critical updates, we might want to discard older updates of the same type
        // to prevent accumulation, but keep critical updates
        if (nextUpdate.options.priority !== 'critical' && queue.length > 0) {
            // Keep only critical updates and the most recent non-critical update
            const criticalUpdates = queue.filter(item => item.options.priority === 'critical');
            const nonCriticalUpdates = queue.filter(item => item.options.priority !== 'critical');
            
            if (nonCriticalUpdates.length > 0) {
                // Keep only the most recent non-critical update
                const mostRecentNonCritical = nonCriticalUpdates[nonCriticalUpdates.length - 1];
                this.updateQueue.set(containerId, [...criticalUpdates, mostRecentNonCritical]);
            } else {
                this.updateQueue.set(containerId, criticalUpdates);
            }
            
            console.debug(`ContentUpdateManager: Cleaned queue for ${containerId}, kept ${this.updateQueue.get(containerId).length} updates`);
        }

        console.debug(`ContentUpdateManager: Processing queued ${nextUpdate.options.priority || 'normal'} update for ${containerId}`);
        
        try {
            await this.executeContainerUpdate(
                containerId, 
                nextUpdate.updateFunction, 
                nextUpdate.data, 
                { ...nextUpdate.options, bypassThrottle: true }
            );
        } catch (error) {
            console.error(`ContentUpdateManager: Error processing queued update for ${containerId}:`, error);
        }
    }

    /**
     * Set the DOM size limit for containers
     * @param {number} limit - Maximum number of DOM nodes per container
     */
    setDOMSizeLimit(limit) {
        this.domSizeLimit = limit;
    }

    /**
     * Set global update lock (emergency coordination)
     * @param {boolean} locked - Whether to lock all updates
     * @param {string} reason - Reason for the lock
     */
    setGlobalUpdateLock(locked, reason = 'Emergency lock') {
        this.globalUpdateLock = locked;
        if (locked) {
            console.warn(`ContentUpdateManager: Global update lock ENABLED - ${reason}`);
        } else {
            console.log(`ContentUpdateManager: Global update lock DISABLED`);
        }
    }

    /**
     * Force release all locks (emergency recovery)
     */
    forceReleaseAllLocks() {
        console.warn('ContentUpdateManager: Force releasing all update locks');
        this.updateLocks.clear();
        this.updateInProgress.clear();
        this.globalUpdateLock = false;
    }

    /**
     * Get comprehensive update status for a container
     * @param {string} containerId - The ID of the container
     * @returns {Object} Detailed status information
     */
    getUpdateStatus(containerId) {
        const queue = this.updateQueue.get(containerId) || [];
        const lock = this.updateLocks.get(containerId);
        const throttleStatus = this.updateThrottler.getThrottleStatus(containerId);
        
        return {
            inProgress: this.updateInProgress.has(containerId),
            queueLength: queue.length,
            queuedPriorities: queue.map(item => item.options.priority || 'normal'),
            hasLock: !!lock,
            lockPriority: lock?.priority,
            lockAge: lock ? Date.now() - lock.timestamp : 0,
            throttleDelay: this.getContainerThrottleDelay(containerId),
            throttleStatus,
            globalLockActive: this.globalUpdateLock
        };
    }

    /**
     * Get status for all containers
     * @returns {Object} Status for all containers
     */
    getAllUpdateStatus() {
        const allContainers = new Set([
            ...this.updateInProgress,
            ...this.updateQueue.keys(),
            ...this.updateLocks.keys(),
            ...this.throttleDelays.keys()
        ]);

        const status = {
            globalLockActive: this.globalUpdateLock,
            totalActiveUpdates: this.updateInProgress.size,
            totalQueuedUpdates: Array.from(this.updateQueue.values()).reduce((sum, queue) => sum + queue.length, 0),
            totalLocks: this.updateLocks.size,
            containers: {}
        };

        for (const containerId of allContainers) {
            status.containers[containerId] = this.getUpdateStatus(containerId);
        }

        return status;
    }

    /**
     * Coordinate updates across multiple containers
     * @param {Array} containerUpdates - Array of {containerId, updateFunction, data, options}
     * @param {Object} coordinationOptions - Coordination options
     */
    async coordinateUpdates(containerUpdates, coordinationOptions = {}) {
        const {
            sequential = false, // Execute updates sequentially vs parallel
            priority = 'normal',
            maxConcurrent = 3, // Maximum concurrent updates when not sequential
            timeout = 30000 // Timeout for the entire coordination
        } = coordinationOptions;

        console.log(`ContentUpdateManager: Coordinating ${containerUpdates.length} updates (sequential: ${sequential})`);

        const coordinationId = Math.random().toString(36).substr(2, 9);
        const startTime = Date.now();

        try {
            if (sequential) {
                // Execute updates one by one
                for (const update of containerUpdates) {
                    const elapsed = Date.now() - startTime;
                    if (elapsed > timeout) {
                        throw new Error(`Coordination timeout after ${elapsed}ms`);
                    }

                        await this.updateContainer(
                            update.containerId,
                            update.updateFunction,
                            update.data,
                            { ...update.options, priority, coordinationId, bypassThrottle: true }
                        );
                }
            } else {
                // Execute updates in parallel with concurrency limit
                const chunks = [];
                for (let i = 0; i < containerUpdates.length; i += maxConcurrent) {
                    chunks.push(containerUpdates.slice(i, i + maxConcurrent));
                }

                for (const chunk of chunks) {
                    const elapsed = Date.now() - startTime;
                    if (elapsed > timeout) {
                        throw new Error(`Coordination timeout after ${elapsed}ms`);
                    }

                    const promises = chunk.map(update =>
                        this.updateContainer(
                            update.containerId,
                            update.updateFunction,
                            update.data,
                            { ...update.options, priority, coordinationId, bypassThrottle: true }
                        )
                    );

                    await Promise.all(promises);
                }
            }

            const totalTime = Date.now() - startTime;
            console.log(`ContentUpdateManager: Coordination ${coordinationId} completed in ${totalTime}ms`);

        } catch (error) {
            console.error(`ContentUpdateManager: Coordination ${coordinationId} failed:`, error);
            throw error;
        }
    }

    /**
     * Clear all queued updates
     */
    clearQueue() {
        this.updateQueue.clear();
        console.debug('ContentUpdateManager: Cleared all queued updates');
    }

    /**
     * Emergency stop all updates and clear queues
     */
    emergencyStop() {
        console.warn('ContentUpdateManager: EMERGENCY STOP - Halting all operations');
        
        // Stop all throttled updates
        this.updateThrottler.cancelAllUpdates();
        
        // Clear all state
        this.updateInProgress.clear();
        this.updateQueue.clear();
        this.updateLocks.clear();
        this.scrollPreserver.clearAll();
        this.domSizeMonitor.stopMonitoring();

        if (this.monitoringStartTimeout) {
            clearTimeout(this.monitoringStartTimeout);
            this.monitoringStartTimeout = null;
        }

        for (const timeoutId of this.pendingTimeouts) {
            clearTimeout(timeoutId);
        }
        this.pendingTimeouts.clear();
        
        // Set global lock
        this.setGlobalUpdateLock(true, 'Emergency stop activated');
        
        console.warn('ContentUpdateManager: Emergency stop completed - all updates halted');
    }

    /**
     * Resume operations after emergency stop
     */
    resumeOperations() {
        console.log('ContentUpdateManager: Resuming operations after emergency stop');
        
        // Release global lock
        this.setGlobalUpdateLock(false);
        
        // Restart DOM monitoring
        this.domSizeMonitor.startMonitoring();
        
        console.log('ContentUpdateManager: Operations resumed');
    }

    /**
     * Configure throttling for multiple containers at once
     * @param {Object} throttleConfig - Object mapping containerIds to delays
     */
    configureThrottling(throttleConfig) {
        for (const [containerId, delay] of Object.entries(throttleConfig)) {
            this.setContainerThrottleDelay(containerId, delay);
        }
        console.log('ContentUpdateManager: Configured throttling for containers:', Object.keys(throttleConfig));
    }

    /**
     * Get throttling statistics
     * @returns {Object} Throttling statistics
     */
    getThrottlingStats() {
        const stats = {
            defaultDelay: this.defaultThrottleDelay,
            containerDelays: Object.fromEntries(this.throttleDelays),
            activeThrottles: 0,
            pendingThrottles: 0
        };

        // Get stats from throttler
        for (const containerId of this.throttleDelays.keys()) {
            const status = this.updateThrottler.getThrottleStatus(containerId);
            if (status.hasPendingUpdate) stats.pendingThrottles++;
            if (status.hasTimer) stats.activeThrottles++;
        }

        return stats;
    }

    /**
     * Get DOM size monitoring statistics
     * @returns {Object} Monitoring statistics for all containers
     */
    getDOMStats() {
        return this.domSizeMonitor.getMonitoringStats();
    }

    /**
     * Set DOM size limit for a specific container
     * @param {string} containerId - The ID of the container
     * @param {number} limit - Maximum number of nodes allowed
     */
    setContainerLimit(containerId, limit) {
        this.domSizeMonitor.setContainerLimit(containerId, limit);
    }

    /**
     * Manually trigger monitoring for all containers
     * @returns {Array} Array of monitoring results
     */
    checkAllContainers() {
        return this.domSizeMonitor.monitorAllContainers();
    }

    /**
     * Start or restart DOM size monitoring
     * @param {number} frequency - Monitoring frequency in milliseconds
     */
    startDOMMonitoring(frequency) {
        this.domSizeMonitor.stopMonitoring();
        this.domSizeMonitor.startMonitoring(frequency);
    }

    /**
     * Stop DOM size monitoring
     */
    stopDOMMonitoring() {
        this.domSizeMonitor.stopMonitoring();
    }

    /**
     * Enable or disable rollback functionality
     * @param {boolean} enabled - Whether to enable rollback
     */
    setRollbackEnabled(enabled) {
        this.rollbackEnabled = enabled;
        console.log(`ContentUpdateManager: Rollback ${enabled ? 'enabled' : 'disabled'}`);
    }

    /**
     * Enable or disable corruption detection
     * @param {boolean} enabled - Whether to enable corruption detection
     */
    setCorruptionDetectionEnabled(enabled) {
        this.corruptionDetection = enabled;
        console.log(`ContentUpdateManager: Corruption detection ${enabled ? 'enabled' : 'disabled'}`);
    }

    /**
     * Set maximum rollback attempts per container
     * @param {number} maxAttempts - Maximum rollback attempts
     */
    setMaxRollbackAttempts(maxAttempts) {
        this.maxRollbackAttempts = Math.max(1, maxAttempts);
        console.log(`ContentUpdateManager: Max rollback attempts set to ${this.maxRollbackAttempts}`);
    }

    /**
     * Get comprehensive error recovery status
     * @returns {Object} Error recovery status
     */
    getErrorRecoveryStatus() {
        return {
            rollbackEnabled: this.rollbackEnabled,
            corruptionDetectionEnabled: this.corruptionDetection,
            maxRollbackAttempts: this.maxRollbackAttempts,
            errorLogSize: this.errorLog.length,
            maxErrorLogSize: this.maxErrorLogSize,
            snapshotCount: this.containerSnapshots.size,
            rollbackAttemptCounts: Object.fromEntries(this.rollbackAttempts),
            updateHistoryCount: this.updateHistory.size,
            recentErrors: this.errorLog.slice(-5).map(e => ({
                type: e.type,
                message: e.message,
                timestamp: e.timestamp,
                containerId: e.context.containerId
            }))
        };
    }

    /**
     * Force rollback a container (for manual recovery)
     * @param {string} containerId - The ID of the container
     * @param {string} reason - Reason for manual rollback
     * @returns {boolean} True if rollback was successful
     */
    async forceRollback(containerId, reason = 'Manual rollback requested') {
        console.warn(`ContentUpdateManager: Force rollback requested for ${containerId}`);
        return this.rollbackContainer(containerId, reason);
    }

    /**
     * Force recreation of a container (for manual recovery)
     * @param {string} containerId - The ID of the container
     * @param {string} reason - Reason for manual recreation
     * @returns {boolean} True if recreation was successful
     */
    async forceRecreation(containerId, reason = 'Manual recreation requested') {
        console.warn(`ContentUpdateManager: Force recreation requested for ${containerId}`);
        return this.recreateContainer(containerId, reason);
    }

    /**
     * Clear all snapshots (to free memory)
     */
    clearAllSnapshots() {
        const count = this.containerSnapshots.size;
        this.containerSnapshots.clear();
        console.log(`ContentUpdateManager: Cleared ${count} container snapshots`);
    }

    /**
     * Clear rollback attempts for a container
     * @param {string} containerId - The ID of the container
     */
    clearRollbackAttempts(containerId) {
        if (this.rollbackAttempts.has(containerId)) {
            this.rollbackAttempts.delete(containerId);
            console.log(`ContentUpdateManager: Cleared rollback attempts for ${containerId}`);
        }
    }

    /**
     * Get update history for a container
     * @param {string} containerId - The ID of the container
     * @returns {Object} Update history
     */
    getUpdateHistory(containerId) {
        return this.updateHistory.get(containerId) || null;
    }

    /**
     * Clear update history
     */
    clearUpdateHistory() {
        const count = this.updateHistory.size;
        this.updateHistory.clear();
        console.log(`ContentUpdateManager: Cleared update history for ${count} containers`);
    }

    /**
     * Perform health check on all containers
     * @returns {Object} Health check results
     */
    performHealthCheck() {
        const containers = ['slowQueries', 'pluginPerformance'];
        const healthResults = {
            timestamp: Date.now(),
            overallHealth: 'good',
            containers: {},
            recommendations: []
        };

        let criticalIssues = 0;
        let warnings = 0;

        containers.forEach(containerId => {
            const container = document.getElementById(containerId);
            if (!container) {
                healthResults.containers[containerId] = {
                    status: 'missing',
                    issues: ['Container not found']
                };
                criticalIssues++;
                return;
            }

            const corruption = this.detectContainerCorruption(containerId);
            const monitoring = this.domSizeMonitor.monitorContainer(containerId);
            const rollbackAttempts = this.rollbackAttempts.get(containerId) || 0;
            const updateHistory = this.getUpdateHistory(containerId);

            const containerHealth = {
                status: 'good',
                issues: [],
                nodeCount: monitoring.nodeCount,
                domStatus: monitoring.status,
                corrupted: corruption.corrupted,
                rollbackAttempts,
                lastUpdate: updateHistory?.timestamp || null
            };

            if (corruption.corrupted) {
                containerHealth.status = corruption.severity === 'critical' ? 'critical' : 'warning';
                containerHealth.issues.push(`Corruption detected: ${corruption.reasons.join(', ')}`);
                if (corruption.severity === 'critical') criticalIssues++;
                else warnings++;
            }

            if (monitoring.status === 'critical' || monitoring.status === 'emergency') {
                containerHealth.status = 'critical';
                containerHealth.issues.push(`DOM size ${monitoring.status}: ${monitoring.nodeCount} nodes`);
                criticalIssues++;
            } else if (monitoring.status === 'warning') {
                if (containerHealth.status === 'good') containerHealth.status = 'warning';
                containerHealth.issues.push(`DOM size warning: ${monitoring.nodeCount} nodes`);
                warnings++;
            }

            if (rollbackAttempts > 0) {
                containerHealth.issues.push(`${rollbackAttempts} rollback attempts`);
                if (rollbackAttempts >= this.maxRollbackAttempts) {
                    containerHealth.status = 'critical';
                    criticalIssues++;
                }
            }

            healthResults.containers[containerId] = containerHealth;
        });

        // Determine overall health
        if (criticalIssues > 0) {
            healthResults.overallHealth = 'critical';
            healthResults.recommendations.push('Immediate attention required for critical issues');
        } else if (warnings > 0) {
            healthResults.overallHealth = 'warning';
            healthResults.recommendations.push('Monitor containers with warnings closely');
        }

        // Add specific recommendations
        if (this.errorLog.length > this.maxErrorLogSize * 0.8) {
            healthResults.recommendations.push('Consider clearing error log to free memory');
        }

        if (this.containerSnapshots.size > 10) {
            healthResults.recommendations.push('Consider clearing old snapshots to free memory');
        }

        console.log('ContentUpdateManager: Health check completed', healthResults);
        return healthResults;
    }
}

// Export classes for use in other modules
window.UpdateThrottler = UpdateThrottler;
window.ScrollPreserver = ScrollPreserver;
window.DOMSizeMonitor = DOMSizeMonitor;
window.DOMCleanup = DOMCleanup;
window.ContentUpdateManager = ContentUpdateManager;

// Create a global instance for immediate use
window.contentUpdateManager = new ContentUpdateManager();

console.log('Content Management utilities loaded successfully');

// Add global utility functions for debugging and monitoring
window.checkDOMSizes = () => {
    console.log('=== DOM Size Check ===');
    return window.contentUpdateManager.getDOMStats();
};

window.emergencyCleanupAll = () => {
    console.warn('=== Emergency Cleanup All Containers ===');
    const containers = ['slowQueries', 'pluginPerformance'];
    containers.forEach(containerId => {
        const element = document.getElementById(containerId);
        if (element) {
            DOMCleanup.emergencyCleanup(element);
        }
    });
};

window.checkUpdateStatus = () => {
    console.log('=== Update Status Check ===');
    return window.contentUpdateManager.getAllUpdateStatus();
};

window.checkThrottlingStats = () => {
    console.log('=== Throttling Statistics ===');
    return window.contentUpdateManager.getThrottlingStats();
};

window.emergencyStopUpdates = () => {
    console.warn('=== EMERGENCY STOP - All Updates Halted ===');
    window.contentUpdateManager.emergencyStop();
};

window.resumeUpdates = () => {
    console.log('=== Resuming Update Operations ===');
    window.contentUpdateManager.resumeOperations();
};

window.forceFlushUpdates = () => {
    console.log('=== Force Flushing All Throttled Updates ===');
    return window.contentUpdateManager.updateThrottler.flushAllUpdates();
};

window.configureUpdateThrottling = (config) => {
    console.log('=== Configuring Update Throttling ===', config);
    window.contentUpdateManager.configureThrottling(config);
};

// Error Recovery and Rollback Utilities
window.getErrorRecoveryStatus = () => {
    console.log('=== Error Recovery Status ===');
    return window.contentUpdateManager.getErrorRecoveryStatus();
};

window.getErrorLog = (filterType = null) => {
    console.log('=== Error Log ===');
    return window.contentUpdateManager.getErrorLog(filterType);
};

window.clearErrorLog = () => {
    console.log('=== Clearing Error Log ===');
    window.contentUpdateManager.clearErrorLog();
};

window.forceRollback = (containerId, reason = 'Manual rollback') => {
    console.warn(`=== Force Rollback: ${containerId} ===`);
    return window.contentUpdateManager.forceRollback(containerId, reason);
};

window.forceRecreation = (containerId, reason = 'Manual recreation') => {
    console.warn(`=== Force Recreation: ${containerId} ===`);
    return window.contentUpdateManager.forceRecreation(containerId, reason);
};

window.performHealthCheck = () => {
    console.log('=== Container Health Check ===');
    return window.contentUpdateManager.performHealthCheck();
};

window.detectCorruption = (containerId) => {
    console.log(`=== Corruption Check: ${containerId} ===`);
    return window.contentUpdateManager.detectContainerCorruption(containerId);
};

window.clearAllSnapshots = () => {
    console.log('=== Clearing All Snapshots ===');
    window.contentUpdateManager.clearAllSnapshots();
};

window.setRollbackEnabled = (enabled) => {
    console.log(`=== ${enabled ? 'Enabling' : 'Disabling'} Rollback ===`);
    window.contentUpdateManager.setRollbackEnabled(enabled);
};

window.setCorruptionDetection = (enabled) => {
    console.log(`=== ${enabled ? 'Enabling' : 'Disabling'} Corruption Detection ===`);
    window.contentUpdateManager.setCorruptionDetectionEnabled(enabled);
};

window.getUpdateHistory = (containerId) => {
    console.log(`=== Update History: ${containerId} ===`);
    return window.contentUpdateManager.getUpdateHistory(containerId);
};

window.testErrorRecovery = async (containerId = 'slowQueries') => {
    console.warn(`=== Testing Error Recovery for ${containerId} ===`);
    
    // Simulate an update failure by corrupting the container
    const container = document.getElementById(containerId);
    if (!container) {
        console.error(`Container ${containerId} not found`);
        return;
    }
    
    // Create a snapshot first
    const snapshot = window.contentUpdateManager.createContainerSnapshot(containerId);
    console.log('Created snapshot:', snapshot);
    
    // Corrupt the container
    container.innerHTML += '<div>'.repeat(1000); // Add unclosed tags to simulate corruption
    console.log('Container corrupted');
    
    // Test corruption detection
    const corruption = window.contentUpdateManager.detectContainerCorruption(containerId);
    console.log('Corruption detected:', corruption);
    
    // Test rollback
    const rollbackSuccess = await window.contentUpdateManager.rollbackContainer(containerId, 'Test corruption');
    console.log('Rollback success:', rollbackSuccess);
    
    return { snapshot, corruption, rollbackSuccess };
};
