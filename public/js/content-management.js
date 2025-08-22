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

        console.warn(`DOMCleanup: Performing emergency cleanup on ${element.id || 'unnamed'}`);
        
        // Clean up any charts first
        this.cleanupCharts(element);
        
        // Clear all content
        element.innerHTML = '<div class="cleanup-notice">Content cleared due to size limits. Refreshing...</div>';
        
        // Trigger a refresh after a short delay
        setTimeout(() => {
            if (typeof loadDashboardData === 'function') {
                loadDashboardData();
            }
        }, 1000);
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
        this.domSizeLimit = 1000; // Default DOM node limit per container
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
            emergencyCleanupThreshold = this.domSizeLimit
        } = options;

        // Prevent concurrent updates on the same container
        if (this.updateInProgress.has(containerId)) {
            console.debug(`ContentUpdateManager: Update already in progress for ${containerId}, queuing...`);
            return this.queueUpdate(containerId, updateFunction, data, options);
        }

        this.updateInProgress.add(containerId);

        try {
            const container = document.getElementById(containerId);
            if (!container) {
                throw new Error(`Container ${containerId} not found`);
            }

            // Check DOM size before update
            const sizeCheck = DOMCleanup.monitorDOMSize(container, emergencyCleanupThreshold);
            if (sizeCheck.warning) {
                console.warn(`ContentUpdateManager: Container ${containerId} exceeds size limit, performing emergency cleanup`);
                DOMCleanup.emergencyCleanup(container);
                return;
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

            // Execute the update function
            await updateFunction(data);

            // Restore scroll position if requested
            if (preserveScroll) {
                // Use requestAnimationFrame to ensure DOM has been updated
                requestAnimationFrame(() => {
                    this.scrollPreserver.restorePosition(containerId);
                });
            }

            // Monitor DOM size after update
            const postUpdateSize = DOMCleanup.monitorDOMSize(container, emergencyCleanupThreshold);
            console.debug(`ContentUpdateManager: Updated ${containerId}, DOM nodes: ${postUpdateSize.nodeCount}`);

        } catch (error) {
            console.error(`ContentUpdateManager: Error updating ${containerId}:`, error);
            throw error;
        } finally {
            this.updateInProgress.delete(containerId);
            
            // Process any queued updates
            this.processQueue(containerId);
        }
    }

    /**
     * Queue an update for later execution
     * @param {string} containerId - The ID of the container
     * @param {Function} updateFunction - Function that performs the update
     * @param {*} data - Data to pass to the update function
     * @param {Object} options - Update options
     */
    queueUpdate(containerId, updateFunction, data, options) {
        if (!this.updateQueue.has(containerId)) {
            this.updateQueue.set(containerId, []);
        }
        
        this.updateQueue.get(containerId).push({ updateFunction, data, options });
        console.debug(`ContentUpdateManager: Queued update for ${containerId}`);
    }

    /**
     * Process queued updates for a container
     * @param {string} containerId - The ID of the container
     */
    async processQueue(containerId) {
        const queue = this.updateQueue.get(containerId);
        if (!queue || queue.length === 0) return;

        // Take the most recent update (discard older ones to prevent accumulation)
        const latestUpdate = queue.pop();
        this.updateQueue.set(containerId, []); // Clear the queue

        console.debug(`ContentUpdateManager: Processing queued update for ${containerId}`);
        await this.updateContainer(containerId, latestUpdate.updateFunction, latestUpdate.data, latestUpdate.options);
    }

    /**
     * Set the DOM size limit for containers
     * @param {number} limit - Maximum number of DOM nodes per container
     */
    setDOMSizeLimit(limit) {
        this.domSizeLimit = limit;
    }

    /**
     * Get current update status for a container
     * @param {string} containerId - The ID of the container
     * @returns {Object} Status information
     */
    getUpdateStatus(containerId) {
        return {
            inProgress: this.updateInProgress.has(containerId),
            queueLength: this.updateQueue.get(containerId)?.length || 0
        };
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
        this.updateInProgress.clear();
        this.updateQueue.clear();
        this.scrollPreserver.clearAll();
        console.warn('ContentUpdateManager: Emergency stop executed');
    }
}

// Export classes for use in other modules
window.ScrollPreserver = ScrollPreserver;
window.DOMCleanup = DOMCleanup;
window.ContentUpdateManager = ContentUpdateManager;

// Create a global instance for immediate use
window.contentUpdateManager = new ContentUpdateManager();

console.log('Content Management utilities loaded successfully');
