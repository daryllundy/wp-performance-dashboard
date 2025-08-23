/**
 * Tests for update throttling and coordination functionality
 */

// Mock DOM environment
const { JSDOM } = require('jsdom');
const dom = new JSDOM(`
<!DOCTYPE html>
<html>
<head>
    <title>Test</title>
</head>
<body>
    <div id="slowQueries"></div>
    <div id="pluginPerformance"></div>
    <div id="real-time-metrics">
        <span id="qps-value">0</span>
        <span id="response-value">0ms</span>
        <span id="memory-value">0MB</span>
    </div>
</body>
</html>
`);

global.window = dom.window;
global.document = dom.window.document;
global.console = console;

// Mock NodeFilter for JSDOM compatibility
global.NodeFilter = {
    SHOW_ALL: 0xFFFFFFFF,
    SHOW_ELEMENT: 0x1,
    SHOW_TEXT: 0x4
};

// Mock createTreeWalker for JSDOM compatibility
const originalCreateTreeWalker = dom.window.document.createTreeWalker;
dom.window.document.createTreeWalker = function(root, whatToShow, filter, entityReferenceExpansion) {
    // Simple mock that just counts elements
    let nodeCount = 0;
    const walker = {
        currentNode: root,
        nextNode: function() {
            nodeCount++;
            return nodeCount <= 10 ? { nodeType: 1 } : null; // Mock some nodes
        }
    };
    return walker;
};

// Mock Chart.js
global.Chart = {
    getChart: jest.fn(() => null),
    defaults: {
        font: { family: '', size: 12 },
        color: '#8b949e'
    }
};

// Load the content management module
require('../public/js/content-management.js');

describe('Update Throttling and Coordination', () => {
    let contentUpdateManager;
    let updateThrottler;

    beforeEach(() => {
        // Reset DOM
        document.getElementById('slowQueries').innerHTML = '';
        document.getElementById('pluginPerformance').innerHTML = '';
        
        // Create fresh instances
        updateThrottler = new window.UpdateThrottler();
        contentUpdateManager = new window.ContentUpdateManager();
        
        // Clear any existing timers
        jest.clearAllTimers();
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.useRealTimers();
        jest.clearAllMocks();
    });

    describe('UpdateThrottler', () => {
        test('should throttle rapid successive updates', async () => {
            const mockUpdate = jest.fn().mockResolvedValue('success');
            const throttleDelay = 1000;

            // Start first update
            const promise1 = updateThrottler.throttleUpdate('test-container', mockUpdate, throttleDelay);
            
            // Start second update immediately
            const promise2 = updateThrottler.throttleUpdate('test-container', mockUpdate, throttleDelay);

            // First update should execute immediately
            expect(mockUpdate).toHaveBeenCalledTimes(1);

            // Advance time to trigger second update
            jest.advanceTimersByTime(throttleDelay);

            await Promise.all([promise1, promise2]);

            // Second update should have replaced the first pending update
            expect(mockUpdate).toHaveBeenCalledTimes(2);
        });

        test('should handle throttle cancellation', () => {
            const mockUpdate = jest.fn().mockResolvedValue('success');
            
            updateThrottler.throttleUpdate('test-container', mockUpdate, 1000);
            updateThrottler.cancelUpdate('test-container');

            // Advance time
            jest.advanceTimersByTime(1000);

            // Update should not have been called after cancellation
            expect(mockUpdate).not.toHaveBeenCalled();
        });

        test('should provide accurate throttle status', () => {
            const mockUpdate = jest.fn().mockResolvedValue('success');
            
            // Initially no throttling
            let status = updateThrottler.getThrottleStatus('test-container');
            expect(status.canUpdateImmediately).toBe(true);
            expect(status.hasPendingUpdate).toBe(false);

            // After scheduling an update
            updateThrottler.throttleUpdate('test-container', mockUpdate, 1000);
            
            status = updateThrottler.getThrottleStatus('test-container');
            expect(status.hasPendingUpdate).toBe(true);
            expect(status.hasTimer).toBe(true);
        });

        test('should flush all pending updates', async () => {
            const mockUpdate1 = jest.fn().mockResolvedValue('success1');
            const mockUpdate2 = jest.fn().mockResolvedValue('success2');

            updateThrottler.throttleUpdate('container1', mockUpdate1, 1000);
            updateThrottler.throttleUpdate('container2', mockUpdate2, 1000);

            // Flush all updates
            await updateThrottler.flushAllUpdates();

            expect(mockUpdate1).toHaveBeenCalledTimes(1);
            expect(mockUpdate2).toHaveBeenCalledTimes(1);
        });
    });

    describe('ContentUpdateManager Throttling', () => {
        test('should apply throttling to container updates', async () => {
            const mockUpdateFunction = jest.fn().mockImplementation((data) => {
                document.getElementById('slowQueries').innerHTML = `<div>${data}</div>`;
            });

            // Set a throttle delay
            contentUpdateManager.setContainerThrottleDelay('slowQueries', 500);

            // Start first update with bypass throttle to avoid DOM monitoring issues
            const promise1 = contentUpdateManager.updateContainer('slowQueries', mockUpdateFunction, 'data1', {
                bypassThrottle: true,
                cleanupRequired: false
            });
            
            // Start second update immediately (this should be throttled)
            const promise2 = contentUpdateManager.updateContainer('slowQueries', mockUpdateFunction, 'data2', {
                cleanupRequired: false
            });

            // Wait for first update to complete
            await promise1;
            expect(mockUpdateFunction).toHaveBeenCalledTimes(1);
            expect(mockUpdateFunction).toHaveBeenCalledWith('data1');

            // Advance time to trigger throttled update
            jest.advanceTimersByTime(500);

            await promise2;

            // Second update should have been throttled and executed after delay
            expect(mockUpdateFunction).toHaveBeenCalledTimes(2);
            expect(mockUpdateFunction).toHaveBeenLastCalledWith('data2');
        });

        test('should bypass throttling for critical priority updates', async () => {
            const mockUpdateFunction = jest.fn().mockImplementation((data) => {
                document.getElementById('slowQueries').innerHTML = `<div>${data}</div>`;
            });

            contentUpdateManager.setContainerThrottleDelay('slowQueries', 1000);

            // Start normal priority update
            const promise1 = contentUpdateManager.updateContainer('slowQueries', mockUpdateFunction, 'normal', {
                priority: 'normal',
                cleanupRequired: false
            });

            // Start critical priority update immediately
            const promise2 = contentUpdateManager.updateContainer('slowQueries', mockUpdateFunction, 'critical', {
                priority: 'critical',
                cleanupRequired: false
            });

            await Promise.all([promise1, promise2]);

            // Both updates should execute (critical bypasses throttling)
            expect(mockUpdateFunction).toHaveBeenCalledTimes(2);
        });

        test('should handle update locks correctly', async () => {
            const mockUpdateFunction = jest.fn().mockImplementation((data) => {
                document.getElementById('slowQueries').innerHTML = `<div>${data}</div>`;
            });

            // Start first update (will acquire lock)
            const promise1 = contentUpdateManager.updateContainer('slowQueries', mockUpdateFunction, 'data1', {
                bypassThrottle: true,
                cleanupRequired: false
            });

            // Start second update immediately (should be queued due to lock)
            const promise2 = contentUpdateManager.updateContainer('slowQueries', mockUpdateFunction, 'data2', {
                bypassThrottle: true,
                cleanupRequired: false
            });

            await Promise.all([promise1, promise2]);

            // Both updates should complete, but second should be queued
            expect(mockUpdateFunction).toHaveBeenCalledTimes(2);
        });

        test('should handle priority-based lock override', async () => {
            const mockUpdateFunction = jest.fn().mockImplementation((data) => {
                document.getElementById('slowQueries').innerHTML = `<div>${data}</div>`;
            });

            // Start normal priority update
            const promise1 = contentUpdateManager.updateContainer('slowQueries', mockUpdateFunction, 'normal', {
                priority: 'normal',
                bypassThrottle: true,
                cleanupRequired: false
            });

            // Start critical priority update (should override lock)
            const promise2 = contentUpdateManager.updateContainer('slowQueries', mockUpdateFunction, 'critical', {
                priority: 'critical',
                bypassThrottle: true,
                cleanupRequired: false
            });

            await Promise.all([promise1, promise2]);

            expect(mockUpdateFunction).toHaveBeenCalledTimes(2);
        });
    });

    describe('Update Coordination', () => {
        test('should coordinate sequential updates', async () => {
            const mockUpdate1 = jest.fn().mockImplementation((data) => {
                document.getElementById('slowQueries').innerHTML = `<div>${data}</div>`;
            });
            const mockUpdate2 = jest.fn().mockImplementation((data) => {
                document.getElementById('pluginPerformance').innerHTML = `<div>${data}</div>`;
            });

            const containerUpdates = [
                {
                    containerId: 'slowQueries',
                    updateFunction: mockUpdate1,
                    data: 'queries-data',
                    options: { cleanupRequired: false }
                },
                {
                    containerId: 'pluginPerformance',
                    updateFunction: mockUpdate2,
                    data: 'plugins-data',
                    options: { cleanupRequired: false }
                }
            ];

            await contentUpdateManager.coordinateUpdates(containerUpdates, {
                sequential: true,
                priority: 'normal'
            });

            expect(mockUpdate1).toHaveBeenCalledWith('queries-data');
            expect(mockUpdate2).toHaveBeenCalledWith('plugins-data');
        });

        test('should coordinate parallel updates with concurrency limit', async () => {
            const mockUpdate1 = jest.fn().mockImplementation((data) => {
                document.getElementById('slowQueries').innerHTML = `<div>${data}</div>`;
            });
            const mockUpdate2 = jest.fn().mockImplementation((data) => {
                document.getElementById('pluginPerformance').innerHTML = `<div>${data}</div>`;
            });

            const containerUpdates = [
                {
                    containerId: 'slowQueries',
                    updateFunction: mockUpdate1,
                    data: 'queries-data',
                    options: { cleanupRequired: false }
                },
                {
                    containerId: 'pluginPerformance',
                    updateFunction: mockUpdate2,
                    data: 'plugins-data',
                    options: { cleanupRequired: false }
                }
            ];

            await contentUpdateManager.coordinateUpdates(containerUpdates, {
                sequential: false,
                maxConcurrent: 2,
                priority: 'normal'
            });

            expect(mockUpdate1).toHaveBeenCalledWith('queries-data');
            expect(mockUpdate2).toHaveBeenCalledWith('plugins-data');
        });

        test('should handle coordination timeout', async () => {
            const slowUpdate = jest.fn().mockImplementation(() => {
                return new Promise(resolve => setTimeout(resolve, 2000));
            });

            const containerUpdates = [
                {
                    containerId: 'slowQueries',
                    updateFunction: slowUpdate,
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

    describe('Global Update Lock', () => {
        test('should prevent updates when global lock is active', async () => {
            const mockUpdateFunction = jest.fn();

            // Set global lock
            contentUpdateManager.setGlobalUpdateLock(true, 'Test lock');

            // Try to update (should be rejected)
            await expect(
                contentUpdateManager.updateContainer('slowQueries', mockUpdateFunction, 'data', {
                    priority: 'normal'
                })
            ).rejects.toThrow('Global update lock active');

            expect(mockUpdateFunction).not.toHaveBeenCalled();
        });

        test('should allow critical updates even with global lock', async () => {
            const mockUpdateFunction = jest.fn().mockImplementation((data) => {
                document.getElementById('slowQueries').innerHTML = `<div>${data}</div>`;
            });

            // Set global lock
            contentUpdateManager.setGlobalUpdateLock(true, 'Test lock');

            // Critical update should still work
            await contentUpdateManager.updateContainer('slowQueries', mockUpdateFunction, 'critical-data', {
                priority: 'critical',
                cleanupRequired: false
            });

            expect(mockUpdateFunction).toHaveBeenCalledWith('critical-data');
        });
    });

    describe('Emergency Operations', () => {
        test('should stop all operations on emergency stop', () => {
            const mockUpdateFunction = jest.fn();

            // Start some updates
            contentUpdateManager.updateContainer('slowQueries', mockUpdateFunction, 'data1');
            contentUpdateManager.updateContainer('pluginPerformance', mockUpdateFunction, 'data2');

            // Emergency stop
            contentUpdateManager.emergencyStop();

            // Check that global lock is active
            const status = contentUpdateManager.getAllUpdateStatus();
            expect(status.globalLockActive).toBe(true);
        });

        test('should resume operations after emergency stop', () => {
            // Emergency stop
            contentUpdateManager.emergencyStop();
            
            // Resume
            contentUpdateManager.resumeOperations();

            // Check that global lock is released
            const status = contentUpdateManager.getAllUpdateStatus();
            expect(status.globalLockActive).toBe(false);
        });
    });

    describe('Status Reporting', () => {
        test('should provide comprehensive update status', () => {
            const status = contentUpdateManager.getAllUpdateStatus();

            expect(status).toHaveProperty('globalLockActive');
            expect(status).toHaveProperty('totalActiveUpdates');
            expect(status).toHaveProperty('totalQueuedUpdates');
            expect(status).toHaveProperty('totalLocks');
            expect(status).toHaveProperty('containers');
        });

        test('should provide throttling statistics', () => {
            contentUpdateManager.setContainerThrottleDelay('slowQueries', 1000);
            contentUpdateManager.setContainerThrottleDelay('pluginPerformance', 1500);

            const stats = contentUpdateManager.getThrottlingStats();

            expect(stats).toHaveProperty('defaultDelay');
            expect(stats).toHaveProperty('containerDelays');
            expect(stats.containerDelays).toHaveProperty('slowQueries', 1000);
            expect(stats.containerDelays).toHaveProperty('pluginPerformance', 1500);
        });
    });
});
