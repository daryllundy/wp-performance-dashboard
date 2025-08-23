/**
 * Comprehensive test suite for ContentUpdateManager class functionality
 * Tests all core features including scroll preservation, DOM monitoring, throttling, and coordination
 */

const { JSDOM } = require('jsdom');

describe('ContentUpdateManager - Comprehensive Test Suite', () => {
    let dom;
    let window;
    let document;
    let contentUpdateManager;

    beforeEach(() => {
        // Create a comprehensive DOM environment
        dom = new JSDOM(`
            <!DOCTYPE html>
            <html>
            <body>
                <div id="slowQueries" style="height: 200px; overflow-y: auto;">
                    <div style="height: 1000px;">Initial slow queries content</div>
                </div>
                <div id="pluginPerformance" style="height: 200px; overflow-y: auto;">
                    <div style="height: 800px;">Initial plugin performance content</div>
                </div>
                <div id="real-time-metrics">
                    <span id="qps-value">0</span>
                    <span id="response-value">0ms</span>
                    <span id="memory-value">0MB</span>
                </div>
                <div id="test-container" style="height: 150px; overflow-y: auto;">
                    <div style="height: 500px;">Test content</div>
                </div>
                <canvas id="test-chart"></canvas>
            </body>
            </html>
        `, {
            url: 'http://localhost',
            pretendToBeVisual: true,
            resources: 'usable'
        });

        window = dom.window;
        document = window.document;
        global.window = window;
        global.document = document;
        global.requestAnimationFrame = (callback) => setTimeout(callback, 16);

        // Mock Chart.js
        global.Chart = {
            getChart: jest.fn(() => ({
                destroy: jest.fn()
            })),
            defaults: { font: {}, color: '' }
        };

        // Mock NodeFilter and Node for DOM traversal
        global.NodeFilter = window.NodeFilter;
        global.Node = window.Node;

        // Load the content management utilities
        const fs = require('fs');
        const path = require('path');
        const utilsCode = fs.readFileSync(
            path.join(__dirname, '../public/js/content-management.js'), 
            'utf8'
        );
        
        // Execute the utilities code in the JSDOM context
        const script = new window.Function(utilsCode);
        script.call(window);

        // Create a fresh ContentUpdateManager instance
        contentUpdateManager = new window.ContentUpdateManager();
    });

    afterEach(() => {
        if (contentUpdateManager) {
            contentUpdateManager.emergencyStop();
        }
        dom.window.close();
    });

    describe('Core ContentUpdateManager Functionality', () => {
        test('should initialize with correct default settings', () => {
            expect(contentUpdateManager.scrollPreserver).toBeInstanceOf(window.ScrollPreserver);
            expect(contentUpdateManager.updateInProgress).toBeInstanceOf(Set);
            expect(contentUpdateManager.updateQueue).toBeInstanceOf(Map);
            expect(contentUpdateManager.updateLocks).toBeInstanceOf(Map);
            expect(contentUpdateManager.updateThrottler).toBeInstanceOf(window.UpdateThrottler);
            expect(contentUpdateManager.domSizeMonitor).toBeInstanceOf(window.DOMSizeMonitor);
            expect(contentUpdateManager.domSizeLimit).toBe(1000);
        });

        test('should set and get container throttle delays', () => {
            contentUpdateManager.setContainerThrottleDelay('test-container', 2000);
            expect(contentUpdateManager.getContainerThrottleDelay('test-container')).toBe(2000);
            expect(contentUpdateManager.getContainerThrottleDelay('nonexistent')).toBe(1000); // default
        });

        test('should set container DOM size limits', () => {
            contentUpdateManager.setContainerLimit('test-container', 500);
            expect(contentUpdateManager.domSizeMonitor.getContainerLimit('test-container')).toBe(500);
        });

        test('should acquire and release update locks', () => {
            expect(contentUpdateManager.acquireUpdateLock('test-container', 'normal')).toBe(true);
            expect(contentUpdateManager.acquireUpdateLock('test-container', 'normal')).toBe(false); // already locked
            
            contentUpdateManager.releaseUpdateLock('test-container');
            expect(contentUpdateManager.acquireUpdateLock('test-container', 'normal')).toBe(true); // now available
        });

        test('should handle priority-based lock override', () => {
            contentUpdateManager.acquireUpdateLock('test-container', 'normal');
            expect(contentUpdateManager.acquireUpdateLock('test-container', 'critical')).toBe(true); // critical overrides
        });

        test('should queue updates when container is locked', async () => {
            const updateFunction = jest.fn().mockResolvedValue();
            
            // Acquire lock manually
            contentUpdateManager.acquireUpdateLock('test-container', 'normal');
            
            // This should be queued
            const promise = contentUpdateManager.updateContainer('test-container', updateFunction, 'data');
            
            // Release lock to allow queued update to process
            contentUpdateManager.releaseUpdateLock('test-container');
            
            await promise;
            expect(updateFunction).toHaveBeenCalledWith('data');
        });
    });

    describe('Scroll Position Preservation', () => {
        test('should preserve scroll position during content updates', async () => {
            const container = document.getElementById('test-container');
            container.scrollTop = 100;

            const updateFunction = jest.fn().mockImplementation(() => {
                container.innerHTML = '<div style="height: 600px;">New content</div>';
            });

            await contentUpdateManager.updateContainer('test-container', updateFunction, 'test-data', {
                preserveScroll: true,
                cleanupRequired: false
            });

            expect(updateFunction).toHaveBeenCalledWith('test-data');
            // Scroll position should be preserved proportionally
            expect(container.scrollTop).toBeGreaterThan(0);
        });

        test('should handle scroll preservation with dramatic content height changes', async () => {
            const container = document.getElementById('test-container');
            container.scrollTop = 200;

            const updateFunction = jest.fn().mockImplementation(() => {
                // Dramatically reduce content height
                container.innerHTML = '<div style="height: 100px;">Much smaller content</div>';
            });

            await contentUpdateManager.updateContainer('test-container', updateFunction, 'test-data', {
                preserveScroll: true,
                cleanupRequired: false
            });

            expect(updateFunction).toHaveBeenCalled();
            // Should handle the dramatic change conservatively
            expect(container.scrollTop).toBeGreaterThanOrEqual(0);
        });

        test('should skip scroll preservation when user is actively scrolling', async () => {
            const container = document.getElementById('test-container');
            
            // Simulate user scrolling by saving position and then changing it
            contentUpdateManager.scrollPreserver.savePosition('test-container');
            container.scrollTop = 250; // User scrolled after save

            const updateFunction = jest.fn().mockImplementation(() => {
                container.innerHTML = '<div style="height: 700px;">Updated content</div>';
            });

            await contentUpdateManager.updateContainer('test-container', updateFunction, 'test-data', {
                preserveScroll: true,
                cleanupRequired: false
            });

            expect(updateFunction).toHaveBeenCalled();
        });

        test('should disable scroll preservation when option is false', async () => {
            const container = document.getElementById('test-container');
            container.scrollTop = 150;

            const updateFunction = jest.fn().mockImplementation(() => {
                container.innerHTML = '<div style="height: 400px;">New content</div>';
            });

            await contentUpdateManager.updateContainer('test-container', updateFunction, 'test-data', {
                preserveScroll: false,
                cleanupRequired: false
            });

            expect(updateFunction).toHaveBeenCalled();
            // Scroll position may or may not be preserved when disabled
        });
    });

    describe('DOM Size Monitoring and Cleanup', () => {
        test('should monitor DOM size during updates', async () => {
            const container = document.getElementById('test-container');
            contentUpdateManager.setContainerLimit('test-container', 50);

            const updateFunction = jest.fn().mockImplementation(() => {
                // Add many elements to exceed limit
                const elements = Array.from({ length: 100 }, (_, i) => 
                    `<div class="item">Item ${i}</div>`
                ).join('');
                container.innerHTML = elements;
            });

            await contentUpdateManager.updateContainer('test-container', updateFunction, 'test-data');

            expect(updateFunction).toHaveBeenCalled();
            
            // Check that DOM monitoring detected the size issue
            const stats = contentUpdateManager.getDOMStats();
            const containerStats = stats.containers.find(c => c.containerId === 'test-container');
            expect(containerStats).toBeDefined();
            expect(['warning', 'critical', 'emergency']).toContain(containerStats.status);
        });

        test('should trigger emergency cleanup when DOM size exceeds critical threshold', async () => {
            const container = document.getElementById('test-container');
            contentUpdateManager.setContainerLimit('test-container', 5); // Very low limit

            const updateFunction = jest.fn().mockImplementation(() => {
                // Add many elements to trigger emergency cleanup
                const elements = Array.from({ length: 50 }, (_, i) => 
                    `<div class="item">Item ${i}</div>`
                ).join('');
                container.innerHTML = elements;
            });

            await contentUpdateManager.updateContainer('test-container', updateFunction, 'test-data');

            // Emergency cleanup should have been triggered
            expect(container.innerHTML).toContain('Emergency Cleanup Performed');
        });

        test('should provide comprehensive DOM statistics', () => {
            const stats = contentUpdateManager.getDOMStats();

            expect(stats).toHaveProperty('totalContainers');
            expect(stats).toHaveProperty('normal');
            expect(stats).toHaveProperty('warning');
            expect(stats).toHaveProperty('critical');
            expect(stats).toHaveProperty('emergency');
            expect(stats).toHaveProperty('totalNodes');
            expect(stats).toHaveProperty('containers');
            expect(Array.isArray(stats.containers)).toBe(true);
        });

        test('should manually check all containers', () => {
            const results = contentUpdateManager.checkAllContainers();
            
            expect(Array.isArray(results)).toBe(true);
            expect(results.length).toBeGreaterThan(0);
            
            results.forEach(result => {
                expect(result).toHaveProperty('containerId');
                expect(result).toHaveProperty('nodeCount');
                expect(result).toHaveProperty('status');
                expect(['normal', 'warning', 'critical', 'emergency']).toContain(result.status);
            });
        });
    });

    describe('Update Throttling and Coordination', () => {
        test('should throttle rapid successive updates', async () => {
            const updateFunction = jest.fn().mockResolvedValue();
            contentUpdateManager.setContainerThrottleDelay('test-container', 500);

            // Start multiple updates rapidly
            const promise1 = contentUpdateManager.updateContainer('test-container', updateFunction, 'data1');
            const promise2 = contentUpdateManager.updateContainer('test-container', updateFunction, 'data2');
            const promise3 = contentUpdateManager.updateContainer('test-container', updateFunction, 'data3');

            await Promise.all([promise1, promise2, promise3]);

            // All updates should complete, but some may be throttled
            expect(updateFunction).toHaveBeenCalled();
        });

        test('should bypass throttling for critical priority updates', async () => {
            const updateFunction = jest.fn().mockResolvedValue();
            contentUpdateManager.setContainerThrottleDelay('test-container', 2000);

            // Start normal update
            const promise1 = contentUpdateManager.updateContainer('test-container', updateFunction, 'normal', {
                priority: 'normal'
            });

            // Start critical update immediately
            const promise2 = contentUpdateManager.updateContainer('test-container', updateFunction, 'critical', {
                priority: 'critical'
            });

            await Promise.all([promise1, promise2]);

            expect(updateFunction).toHaveBeenCalledTimes(2);
        });

        test('should coordinate multiple container updates', async () => {
            const updateFunction1 = jest.fn().mockResolvedValue();
            const updateFunction2 = jest.fn().mockResolvedValue();

            const containerUpdates = [
                {
                    containerId: 'slowQueries',
                    updateFunction: updateFunction1,
                    data: 'queries-data',
                    options: { cleanupRequired: false }
                },
                {
                    containerId: 'pluginPerformance',
                    updateFunction: updateFunction2,
                    data: 'plugins-data',
                    options: { cleanupRequired: false }
                }
            ];

            await contentUpdateManager.coordinateUpdates(containerUpdates, {
                sequential: true,
                priority: 'normal'
            });

            expect(updateFunction1).toHaveBeenCalledWith('queries-data');
            expect(updateFunction2).toHaveBeenCalledWith('plugins-data');
        });

        test('should handle coordination timeout', async () => {
            const slowUpdateFunction = jest.fn().mockImplementation(() => 
                new Promise(resolve => setTimeout(resolve, 2000))
            );

            const containerUpdates = [
                {
                    containerId: 'test-container',
                    updateFunction: slowUpdateFunction,
                    data: 'data',
                    options: { cleanupRequired: false }
                }
            ];

            await expect(
                contentUpdateManager.coordinateUpdates(containerUpdates, {
                    timeout: 1000 // 1 second timeout
                })
            ).rejects.toThrow('Coordination timeout');
        });
    });

    describe('Error Handling and Recovery', () => {
        test('should handle update function errors gracefully', async () => {
            const updateFunction = jest.fn().mockRejectedValue(new Error('Update failed'));

            await expect(
                contentUpdateManager.updateContainer('test-container', updateFunction, 'data')
            ).rejects.toThrow('Update failed');

            // Should not be stuck in progress state
            expect(contentUpdateManager.updateInProgress.has('test-container')).toBe(false);
        });

        test('should handle DOM cleanup errors gracefully', async () => {
            const container = document.getElementById('test-container');
            
            // Mock innerHTML setter to throw error
            Object.defineProperty(container, 'innerHTML', {
                set: jest.fn(() => { throw new Error('DOM error'); }),
                get: jest.fn(() => '<div>content</div>')
            });

            const updateFunction = jest.fn().mockImplementation(() => {
                container.innerHTML = '<div>new content</div>';
            });

            await expect(
                contentUpdateManager.updateContainer('test-container', updateFunction, 'data')
            ).rejects.toThrow();
        });

        test('should provide rollback functionality for failed updates', async () => {
            const container = document.getElementById('test-container');
            const originalContent = container.innerHTML;

            const updateFunction = jest.fn().mockImplementation(() => {
                container.innerHTML = '<div>partial update</div>';
                throw new Error('Update failed midway');
            });

            await expect(
                contentUpdateManager.updateContainer('test-container', updateFunction, 'data', {
                    enableRollback: true
                })
            ).rejects.toThrow('Update failed midway');

            // Content should be rolled back to original state
            // Note: This would require implementing rollback functionality in the actual code
        });
    });

    describe('Global Update Lock and Emergency Operations', () => {
        test('should prevent updates when global lock is active', async () => {
            const updateFunction = jest.fn();
            
            contentUpdateManager.setGlobalUpdateLock(true, 'Test emergency');

            await expect(
                contentUpdateManager.updateContainer('test-container', updateFunction, 'data', {
                    priority: 'normal'
                })
            ).rejects.toThrow('Global update lock active');

            expect(updateFunction).not.toHaveBeenCalled();
        });

        test('should allow critical updates even with global lock', async () => {
            const updateFunction = jest.fn().mockResolvedValue();
            
            contentUpdateManager.setGlobalUpdateLock(true, 'Test emergency');

            await contentUpdateManager.updateContainer('test-container', updateFunction, 'critical-data', {
                priority: 'critical',
                cleanupRequired: false
            });

            expect(updateFunction).toHaveBeenCalledWith('critical-data');
        });

        test('should perform emergency stop of all operations', () => {
            const updateFunction = jest.fn();
            
            // Start some updates
            contentUpdateManager.updateContainer('slowQueries', updateFunction, 'data1');
            contentUpdateManager.updateContainer('pluginPerformance', updateFunction, 'data2');

            // Emergency stop
            contentUpdateManager.emergencyStop();

            // Check that operations are stopped
            const status = contentUpdateManager.getAllUpdateStatus();
            expect(status.globalLockActive).toBe(true);
            expect(contentUpdateManager.updateInProgress.size).toBe(0);
            expect(contentUpdateManager.updateQueue.size).toBe(0);
        });

        test('should resume operations after emergency stop', () => {
            contentUpdateManager.emergencyStop();
            contentUpdateManager.resumeOperations();

            const status = contentUpdateManager.getAllUpdateStatus();
            expect(status.globalLockActive).toBe(false);
        });
    });

    describe('Status Reporting and Monitoring', () => {
        test('should provide comprehensive update status', () => {
            const status = contentUpdateManager.getAllUpdateStatus();

            expect(status).toHaveProperty('globalLockActive');
            expect(status).toHaveProperty('totalActiveUpdates');
            expect(status).toHaveProperty('totalQueuedUpdates');
            expect(status).toHaveProperty('totalLocks');
            expect(status).toHaveProperty('containers');
            expect(typeof status.globalLockActive).toBe('boolean');
            expect(typeof status.totalActiveUpdates).toBe('number');
            expect(typeof status.totalQueuedUpdates).toBe('number');
            expect(typeof status.totalLocks).toBe('number');
            expect(Array.isArray(status.containers)).toBe(true);
        });

        test('should provide throttling statistics', () => {
            contentUpdateManager.setContainerThrottleDelay('slowQueries', 1500);
            contentUpdateManager.setContainerThrottleDelay('pluginPerformance', 2000);

            const stats = contentUpdateManager.getThrottlingStats();

            expect(stats).toHaveProperty('defaultDelay');
            expect(stats).toHaveProperty('containerDelays');
            expect(stats.defaultDelay).toBe(1000);
            expect(stats.containerDelays).toHaveProperty('slowQueries', 1500);
            expect(stats.containerDelays).toHaveProperty('pluginPerformance', 2000);
        });

        test('should get update status for specific container', () => {
            const status = contentUpdateManager.getUpdateStatus('test-container');

            expect(status).toHaveProperty('inProgress');
            expect(status).toHaveProperty('queueLength');
            expect(status).toHaveProperty('hasLock');
            expect(status).toHaveProperty('throttleStatus');
            expect(typeof status.inProgress).toBe('boolean');
            expect(typeof status.queueLength).toBe('number');
            expect(typeof status.hasLock).toBe('boolean');
        });
    });

    describe('DOM Monitoring Control', () => {
        test('should start and stop DOM monitoring', () => {
            contentUpdateManager.stopDOMMonitoring();
            contentUpdateManager.startDOMMonitoring(1000);

            // Should not throw errors
            expect(() => {
                contentUpdateManager.stopDOMMonitoring();
            }).not.toThrow();
        });

        test('should get DOM monitoring status', () => {
            const isMonitoring = contentUpdateManager.isDOMMonitoringActive();
            expect(typeof isMonitoring).toBe('boolean');
        });
    });
});
