/**
 * Tests for Content Management Utilities
 */

// Mock DOM environment for testing
const { JSDOM } = require('jsdom');

describe('Content Management Utilities', () => {
    let dom;
    let window;
    let document;

    beforeEach(() => {
        // Create a new DOM environment for each test
        dom = new JSDOM(`
            <!DOCTYPE html>
            <html>
            <body>
                <div id="test-container" style="height: 200px; overflow-y: auto;">
                    <div style="height: 1000px;">Long content for scrolling</div>
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
            }))
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
    });

    afterEach(() => {
        dom.window.close();
    });

    describe('ScrollPreserver', () => {
        test('should save and restore scroll position', () => {
            const scrollPreserver = new window.ScrollPreserver();
            const container = document.getElementById('test-container');
            
            // Set initial scroll position
            container.scrollTop = 100;
            
            // Save position
            scrollPreserver.savePosition('test-container');
            
            // Verify position was saved
            expect(scrollPreserver.scrollPositions.has('test-container')).toBe(true);
            
            // Get the saved position data
            const savedPosition = scrollPreserver.scrollPositions.get('test-container');
            expect(savedPosition).toBeDefined();
            expect(savedPosition.scrollTop).toBe(100);
            
            // Change scroll position
            container.scrollTop = 0;
            
            // Restore position (this should clear the saved position)
            scrollPreserver.restorePosition('test-container');
            
            // Position should be cleared after restoration
            expect(scrollPreserver.scrollPositions.has('test-container')).toBe(false);
        });

        test('should handle non-existent containers gracefully', () => {
            const scrollPreserver = new window.ScrollPreserver();
            
            // Should not throw errors
            expect(() => {
                scrollPreserver.savePosition('non-existent');
                scrollPreserver.restorePosition('non-existent');
            }).not.toThrow();
        });

        test('should clear saved positions', () => {
            const scrollPreserver = new window.ScrollPreserver();
            
            scrollPreserver.savePosition('test-container');
            expect(scrollPreserver.scrollPositions.size).toBe(1);
            
            scrollPreserver.clearAll();
            expect(scrollPreserver.scrollPositions.size).toBe(0);
        });

        test('should handle significant content height changes', () => {
            const scrollPreserver = new window.ScrollPreserver();
            const container = document.getElementById('test-container');
            
            // Mock container with initial dimensions
            Object.defineProperty(container, 'scrollTop', { value: 100, writable: true });
            Object.defineProperty(container, 'scrollHeight', { value: 1000, writable: true });
            Object.defineProperty(container, 'clientHeight', { value: 200, writable: true });
            
            // Save position
            scrollPreserver.savePosition('test-container');
            
            // Simulate dramatic content height change (content becomes much smaller)
            Object.defineProperty(container, 'scrollHeight', { value: 300, writable: true });
            
            // Restore position - should handle the dramatic change conservatively
            scrollPreserver.restorePosition('test-container');
            
            // Should not throw errors and should set a reasonable scroll position
            expect(container.scrollTop).toBeGreaterThanOrEqual(0);
            expect(container.scrollTop).toBeLessThanOrEqual(100); // Should be conservative
        });

        test('should detect user scrolling activity', () => {
            const scrollPreserver = new window.ScrollPreserver();
            const container = document.getElementById('test-container');
            
            // Set initial scroll position and save
            container.scrollTop = 100;
            scrollPreserver.savePosition('test-container');
            
            // Simulate user scrolling by changing position
            container.scrollTop = 200;
            
            // Should detect user is scrolling
            expect(scrollPreserver.isUserScrolling('test-container')).toBe(true);
        });

        test('should use safe save position method', () => {
            const scrollPreserver = new window.ScrollPreserver();
            const container = document.getElementById('test-container');
            
            // Set initial position
            container.scrollTop = 100;
            scrollPreserver.savePosition('test-container');
            
            // Change position to simulate user scrolling
            container.scrollTop = 200;
            
            // Safe save should return false (user is scrolling)
            expect(scrollPreserver.savePositionSafe('test-container')).toBe(false);
            
            // Force save should return true
            expect(scrollPreserver.savePositionSafe('test-container', true)).toBe(true);
        });
    });

    describe('DOMSizeMonitor', () => {
        test('should count DOM nodes accurately', () => {
            const monitor = new window.DOMSizeMonitor();
            const container = document.getElementById('test-container');
            
            const result = monitor.countNodes(container);
            
            expect(result).toHaveProperty('nodeCount');
            expect(result).toHaveProperty('textNodes');
            expect(result).toHaveProperty('elementNodes');
            expect(result).toHaveProperty('containerId');
            expect(result.nodeCount).toBeGreaterThan(0);
            expect(result.containerId).toBe('test-container');
        });

        test('should set and get container limits', () => {
            const monitor = new window.DOMSizeMonitor();
            
            monitor.setContainerLimit('test-container', 500);
            expect(monitor.getContainerLimit('test-container')).toBe(500);
            expect(monitor.getContainerLimit('nonexistent')).toBe(1000); // default
        });

        test('should monitor container and detect status levels', () => {
            const monitor = new window.DOMSizeMonitor();
            const container = document.getElementById('test-container');
            
            // Set a low limit to trigger warnings
            monitor.setContainerLimit('test-container', 2);
            
            const result = monitor.monitorContainer('test-container');
            
            expect(result).toHaveProperty('containerId');
            expect(result).toHaveProperty('nodeCount');
            expect(result).toHaveProperty('status');
            expect(result).toHaveProperty('percentage');
            expect(result).toHaveProperty('limit');
            expect(result.containerId).toBe('test-container');
            expect(['normal', 'warning', 'critical', 'emergency']).toContain(result.status);
        });

        test('should monitor all containers', () => {
            const monitor = new window.DOMSizeMonitor();
            
            const results = monitor.monitorAllContainers();
            
            expect(Array.isArray(results)).toBe(true);
            expect(results.length).toBeGreaterThan(0);
        });

        test('should get monitoring statistics', () => {
            const monitor = new window.DOMSizeMonitor();
            
            const stats = monitor.getMonitoringStats();
            
            expect(stats).toHaveProperty('totalContainers');
            expect(stats).toHaveProperty('normal');
            expect(stats).toHaveProperty('warning');
            expect(stats).toHaveProperty('critical');
            expect(stats).toHaveProperty('emergency');
            expect(stats).toHaveProperty('totalNodes');
            expect(stats).toHaveProperty('containers');
            expect(Array.isArray(stats.containers)).toBe(true);
        });

        test('should start and stop monitoring', (done) => {
            const monitor = new window.DOMSizeMonitor();
            
            monitor.startMonitoring(50); // Short interval for testing
            
            setTimeout(() => {
                monitor.stopMonitoring();
                done();
            }, 100);
        });

        test('should handle missing containers gracefully', () => {
            const monitor = new window.DOMSizeMonitor();
            
            const result = monitor.countNodes('nonexistent');
            expect(result.error).toBe('Container not found');
            
            const monitorResult = monitor.monitorContainer('nonexistent');
            expect(monitorResult.error).toContain('not found');
        });
    });

    describe('DOMCleanup', () => {
        test('should monitor DOM size (legacy method)', () => {
            const container = document.getElementById('test-container');
            const result = window.DOMCleanup.monitorDOMSize(container, 5);
            
            expect(result).toHaveProperty('nodeCount');
            expect(result).toHaveProperty('warning');
            expect(typeof result.nodeCount).toBe('number');
            expect(typeof result.warning).toBe('boolean');
        });

        test('should handle non-existent containers', () => {
            const result = window.DOMCleanup.monitorDOMSize('non-existent');
            expect(result.nodeCount).toBe(0);
            expect(result.warning).toBe(false);
        });

        test('should cleanup charts', () => {
            const container = document.getElementById('test-container');
            
            // Should not throw errors even if no charts exist
            expect(() => {
                window.DOMCleanup.cleanupCharts(container);
            }).not.toThrow();
        });

        test('should perform emergency cleanup', () => {
            const container = document.getElementById('test-container');
            const originalContent = container.innerHTML;
            
            // Mock loadDashboardData
            global.loadDashboardData = jest.fn();
            
            window.DOMCleanup.emergencyCleanup(container);
            
            expect(container.innerHTML).toContain('Emergency Cleanup Performed');
            expect(container.innerHTML).toContain('🚨');
            expect(container.innerHTML).not.toBe(originalContent);
        });

        test('should perform thorough cleanup', () => {
            const container = document.getElementById('test-container');
            
            // Add many query items to simulate accumulation
            const items = Array.from({ length: 20 }, (_, i) => 
                `<div class="query-item">Query ${i}</div>`
            ).join('');
            container.innerHTML = items;
            
            const initialCount = container.querySelectorAll('*').length;
            
            window.DOMCleanup.thoroughCleanup(container, 10);
            
            const finalCount = container.querySelectorAll('*').length;
            expect(finalCount).toBeLessThanOrEqual(initialCount);
        });
    });

    describe('ContentUpdateManager', () => {
        test('should create instance with default settings and DOM monitor', () => {
            const manager = new window.ContentUpdateManager();
            
            expect(manager.scrollPreserver).toBeInstanceOf(window.ScrollPreserver);
            expect(manager.updateInProgress).toBeInstanceOf(Set);
            expect(manager.updateQueue).toBeInstanceOf(Map);
            expect(manager.domSizeLimit).toBe(1000);
            expect(manager.domSizeMonitor).toBeInstanceOf(window.DOMSizeMonitor);
        });

        test('should prevent concurrent updates', async () => {
            const manager = new window.ContentUpdateManager();
            const updateFunction = jest.fn().mockResolvedValue();
            
            // Start first update
            const promise1 = manager.updateContainer('test-container', updateFunction, {});
            
            // Start second update (should be queued)
            const promise2 = manager.updateContainer('test-container', updateFunction, {});
            
            await Promise.all([promise1, promise2]);
            
            // Both updates should complete
            expect(updateFunction).toHaveBeenCalledTimes(2);
        });

        test('should handle update errors gracefully', async () => {
            const manager = new window.ContentUpdateManager();
            const updateFunction = jest.fn().mockRejectedValue(new Error('Test error'));
            
            await expect(
                manager.updateContainer('test-container', updateFunction, {})
            ).rejects.toThrow('Test error');
            
            // Should not be stuck in progress state
            expect(manager.updateInProgress.has('test-container')).toBe(false);
        });

        test('should get update status', () => {
            const manager = new window.ContentUpdateManager();
            
            const status = manager.getUpdateStatus('test-container');
            expect(status).toHaveProperty('inProgress');
            expect(status).toHaveProperty('queueLength');
            expect(status.inProgress).toBe(false);
            expect(status.queueLength).toBe(0);
        });

        test('should clear queue', () => {
            const manager = new window.ContentUpdateManager();
            
            manager.queueUpdate('test-container', jest.fn(), {}, {});
            expect(manager.updateQueue.get('test-container')).toHaveLength(1);
            
            manager.clearQueue();
            expect(manager.updateQueue.size).toBe(0);
        });

        test('should perform emergency stop with DOM monitoring', () => {
            const manager = new window.ContentUpdateManager();
            
            manager.updateInProgress.add('test-container');
            manager.queueUpdate('test-container', jest.fn(), {}, {});
            manager.scrollPreserver.savePosition('test-container');
            
            manager.emergencyStop();
            
            expect(manager.updateInProgress.size).toBe(0);
            expect(manager.updateQueue.size).toBe(0);
            expect(manager.scrollPreserver.scrollPositions.size).toBe(0);
        });

        test('should provide DOM statistics', () => {
            const manager = new window.ContentUpdateManager();
            
            const stats = manager.getDOMStats();
            
            expect(stats).toHaveProperty('totalContainers');
            expect(stats).toHaveProperty('containers');
            expect(Array.isArray(stats.containers)).toBe(true);
        });

        test('should set container limits', () => {
            const manager = new window.ContentUpdateManager();
            
            manager.setContainerLimit('test-container', 500);
            
            expect(manager.domSizeMonitor.getContainerLimit('test-container')).toBe(500);
        });

        test('should check all containers manually', () => {
            const manager = new window.ContentUpdateManager();
            
            const results = manager.checkAllContainers();
            
            expect(Array.isArray(results)).toBe(true);
        });

        test('should control DOM monitoring', () => {
            const manager = new window.ContentUpdateManager();
            
            // Should not throw errors
            expect(() => {
                manager.stopDOMMonitoring();
                manager.startDOMMonitoring(1000);
            }).not.toThrow();
        });

        test('should integrate DOM monitoring in updates', async () => {
            const manager = new window.ContentUpdateManager();
            const container = document.getElementById('test-container');
            
            // Set a reasonable limit
            manager.setContainerLimit('test-container', 100);
            
            const updateFunction = jest.fn().mockImplementation(() => {
                container.innerHTML = '<div>Updated content</div>';
            });
            
            await manager.updateContainer('test-container', updateFunction, {});
            
            expect(updateFunction).toHaveBeenCalled();
            expect(container.innerHTML).toContain('Updated content');
        });
    });

    describe('Global instances and utilities', () => {
        test('should create global contentUpdateManager instance', () => {
            expect(window.contentUpdateManager).toBeInstanceOf(window.ContentUpdateManager);
        });

        test('should expose all utility classes globally', () => {
            expect(window.ScrollPreserver).toBeDefined();
            expect(window.DOMSizeMonitor).toBeDefined();
            expect(window.DOMCleanup).toBeDefined();
            expect(window.ContentUpdateManager).toBeDefined();
        });

        test('should provide global utility functions', () => {
            expect(typeof window.checkDOMSizes).toBe('function');
            expect(typeof window.emergencyCleanupAll).toBe('function');
        });

        test('should execute global DOM size check', () => {
            const stats = window.checkDOMSizes();
            
            expect(stats).toHaveProperty('totalContainers');
            expect(stats).toHaveProperty('containers');
        });

        test('should execute global emergency cleanup', () => {
            // Add containers that would be cleaned up
            const slowQueries = document.createElement('div');
            slowQueries.id = 'slowQueries';
            slowQueries.innerHTML = '<div>Some content</div>';
            document.body.appendChild(slowQueries);
            
            const pluginPerformance = document.createElement('div');
            pluginPerformance.id = 'pluginPerformance';
            pluginPerformance.innerHTML = '<div>Some content</div>';
            document.body.appendChild(pluginPerformance);
            
            // Should not throw errors
            expect(() => {
                window.emergencyCleanupAll();
            }).not.toThrow();
            
            // Cleanup
            document.body.removeChild(slowQueries);
            document.body.removeChild(pluginPerformance);
        });
    });
});
