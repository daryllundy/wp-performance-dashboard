/**
 * Tests for Error Recovery and Fallback Mechanisms
 * 
 * This test suite validates the rollback functionality, container recreation,
 * and comprehensive error logging for debugging accumulation issues.
 */

const fs = require('fs');
const path = require('path');

// Mock DOM environment
const { JSDOM } = require('jsdom');
const dom = new JSDOM(`
<!DOCTYPE html>
<html>
<head>
    <title>Test</title>
</head>
<body>
    <div id="slowQueries" class="scrollable-container">
        <div class="query-item">Original Query 1</div>
        <div class="query-item">Original Query 2</div>
    </div>
    <div id="pluginPerformance" class="scrollable-container">
        <div class="plugin-item">Original Plugin 1</div>
        <div class="plugin-item">Original Plugin 2</div>
    </div>
    <div id="real-time-metrics">
        <div class="metric-item">Original Metric</div>
    </div>
</body>
</html>
`, {
    url: 'http://localhost:3000',
    pretendToBeVisual: true,
    resources: 'usable'
});

global.window = dom.window;
global.document = dom.window.document;
global.navigator = dom.window.navigator;
global.performance = {
    now: () => Date.now(),
    memory: {
        usedJSHeapSize: 1000000,
        totalJSHeapSize: 2000000,
        jsHeapSizeLimit: 4000000
    }
};
global.sessionStorage = {
    data: {},
    getItem: function(key) { return this.data[key] || null; },
    setItem: function(key, value) { this.data[key] = value; },
    removeItem: function(key) { delete this.data[key]; }
};
global.requestAnimationFrame = (callback) => setTimeout(callback, 16);

// Mock NodeFilter for DOM tree walking
global.NodeFilter = {
    SHOW_ALL: 0xFFFFFFFF,
    SHOW_ELEMENT: 0x1,
    SHOW_TEXT: 0x4
};

// Mock Node constants
global.Node = {
    ELEMENT_NODE: 1,
    TEXT_NODE: 3,
    COMMENT_NODE: 8,
    DOCUMENT_NODE: 9,
    DOCUMENT_FRAGMENT_NODE: 11
};

// Mock createTreeWalker
global.document.createTreeWalker = function(root, whatToShow, filter, entityReferenceExpansion) {
    const nodes = [];
    
    function collectNodes(node) {
        nodes.push(node);
        for (let child of node.childNodes) {
            collectNodes(child);
        }
    }
    
    collectNodes(root);
    
    let currentIndex = -1;
    
    return {
        currentNode: null,
        nextNode: function() {
            currentIndex++;
            if (currentIndex < nodes.length) {
                this.currentNode = nodes[currentIndex];
                return this.currentNode;
            }
            return null;
        }
    };
};

// Mock loadDashboardData function
global.loadDashboardData = jest.fn();

// Load the content management module
const contentManagementPath = path.join(__dirname, '../public/js/content-management.js');
const contentManagementCode = fs.readFileSync(contentManagementPath, 'utf8');

// Remove Chart.js dependencies for testing
const modifiedCode = contentManagementCode.replace(/Chart\.getChart\([^)]+\)/g, 'null');
eval(modifiedCode);

describe('Error Recovery and Fallback Mechanisms', () => {
    let contentUpdateManager;

    beforeEach(() => {
        // Reset DOM
        document.getElementById('slowQueries').innerHTML = `
            <div class="query-item">Original Query 1</div>
            <div class="query-item">Original Query 2</div>
        `;
        document.getElementById('pluginPerformance').innerHTML = `
            <div class="plugin-item">Original Plugin 1</div>
            <div class="plugin-item">Original Plugin 2</div>
        `;
        
        // Create fresh instance
        contentUpdateManager = new window.ContentUpdateManager();
        
        // Disable DOM monitoring to prevent timeouts in tests
        contentUpdateManager.stopDOMMonitoring();
        
        // Clear any existing state
        contentUpdateManager.clearErrorLog();
        contentUpdateManager.clearAllSnapshots();
        contentUpdateManager.clearUpdateHistory();
    });

    afterEach(() => {
        // Clean up any timeouts
        if (contentUpdateManager) {
            contentUpdateManager.stopDOMMonitoring();
            contentUpdateManager.emergencyStop();
        }
    });

    describe('Container Snapshot Creation', () => {
        test('should create valid snapshots for containers', () => {
            const snapshot = contentUpdateManager.createContainerSnapshot('slowQueries');
            
            expect(snapshot).toBeTruthy();
            expect(snapshot.containerId).toBe('slowQueries');
            expect(snapshot.innerHTML).toContain('Original Query 1');
            expect(snapshot.nodeCount).toBeGreaterThan(0);
            expect(snapshot.timestamp).toBeGreaterThan(0);
            expect(snapshot.snapshotId).toBeTruthy();
        });

        test('should handle missing containers gracefully', () => {
            const snapshot = contentUpdateManager.createContainerSnapshot('nonexistent');
            
            expect(snapshot).toBeNull();
            
            const errorLog = contentUpdateManager.getErrorLog('SNAPSHOT_FAILED');
            expect(errorLog).toHaveLength(1);
            expect(errorLog[0].context.containerId).toBe('nonexistent');
        });

        test('should store snapshots in memory', () => {
            contentUpdateManager.createContainerSnapshot('slowQueries');
            contentUpdateManager.createContainerSnapshot('pluginPerformance');
            
            const status = contentUpdateManager.getErrorRecoveryStatus();
            expect(status.snapshotCount).toBe(2);
        });
    });

    describe('Container Rollback Functionality', () => {
        test('should successfully rollback container to snapshot', async () => {
            // Create snapshot
            const snapshot = contentUpdateManager.createContainerSnapshot('slowQueries');
            expect(snapshot).toBeTruthy();
            
            // Modify container
            const container = document.getElementById('slowQueries');
            container.innerHTML = '<div class="query-item">Modified Content</div>';
            
            // Verify modification
            expect(container.innerHTML).toContain('Modified Content');
            expect(container.innerHTML).not.toContain('Original Query 1');
            
            // Perform rollback
            const rollbackSuccess = await contentUpdateManager.rollbackContainer('slowQueries', 'Test rollback');
            
            expect(rollbackSuccess).toBe(true);
            expect(container.innerHTML).toContain('Original Query 1');
            expect(container.innerHTML).not.toContain('Modified Content');
        });

        test('should handle rollback when no snapshot exists', async () => {
            const rollbackSuccess = await contentUpdateManager.rollbackContainer('slowQueries', 'No snapshot test');
            
            expect(rollbackSuccess).toBe(false);
            
            const errorLog = contentUpdateManager.getErrorLog('ROLLBACK_NO_SNAPSHOT');
            expect(errorLog).toHaveLength(1);
        });

        test('should enforce maximum rollback attempts', async () => {
            contentUpdateManager.setMaxRollbackAttempts(2);
            
            // Create snapshot
            contentUpdateManager.createContainerSnapshot('slowQueries');
            
            // Manually set rollback attempts to simulate previous attempts
            contentUpdateManager.rollbackAttempts.set('slowQueries', 2);
            
            // This attempt should trigger recreation due to max attempts
            const rollbackSuccess = await contentUpdateManager.rollbackContainer('slowQueries', 'Max attempts test');
            
            // Should return true because recreation was attempted
            expect(rollbackSuccess).toBe(true);
            
            const errorLog = contentUpdateManager.getErrorLog('ROLLBACK_MAX_ATTEMPTS');
            expect(errorLog).toHaveLength(1);
        });

        test('should handle rollback with disabled rollback functionality', async () => {
            contentUpdateManager.setRollbackEnabled(false);
            contentUpdateManager.createContainerSnapshot('slowQueries');
            
            const rollbackSuccess = await contentUpdateManager.rollbackContainer('slowQueries', 'Disabled test');
            
            expect(rollbackSuccess).toBe(false);
            
            const errorLog = contentUpdateManager.getErrorLog('ROLLBACK_DISABLED');
            expect(errorLog).toHaveLength(1);
        });
    });

    describe('Container Recreation Fallback', () => {
        test('should successfully recreate container', async () => {
            const container = document.getElementById('slowQueries');
            const originalContent = container.innerHTML;
            
            // Corrupt the container
            container.innerHTML = '<div>Corrupted content</div>';
            
            const recreationSuccess = await contentUpdateManager.recreateContainer('slowQueries', 'Test corruption');
            
            expect(recreationSuccess).toBe(true);
            expect(container.innerHTML).toContain('Container Recreated');
            expect(container.innerHTML).toContain('Test corruption');
            expect(container.innerHTML).not.toContain('Corrupted content');
        });

        test('should handle recreation of missing container', async () => {
            const recreationSuccess = await contentUpdateManager.recreateContainer('nonexistent', 'Missing container');
            
            expect(recreationSuccess).toBe(false);
            
            const errorLog = contentUpdateManager.getErrorLog('RECREATION_CONTAINER_MISSING');
            expect(errorLog).toHaveLength(1);
        });

        test('should clear container state after recreation', async () => {
            // Create snapshot and set rollback attempts
            contentUpdateManager.createContainerSnapshot('slowQueries');
            contentUpdateManager.rollbackAttempts.set('slowQueries', 2);
            
            await contentUpdateManager.recreateContainer('slowQueries', 'State cleanup test');
            
            // Verify state is cleared
            expect(contentUpdateManager.containerSnapshots.has('slowQueries')).toBe(false);
            expect(contentUpdateManager.rollbackAttempts.has('slowQueries')).toBe(false);
        });
    });

    describe('Corruption Detection', () => {
        test('should detect excessive DOM size', () => {
            const container = document.getElementById('slowQueries');
            
            // Add many elements to simulate excessive size
            for (let i = 0; i < 2500; i++) {
                const div = document.createElement('div');
                div.className = 'query-item';
                div.textContent = `Query ${i}`;
                container.appendChild(div);
            }
            
            const corruption = contentUpdateManager.detectContainerCorruption('slowQueries');
            
            expect(corruption.corrupted).toBe(true);
            expect(corruption.reasons).toContain('excessiveSize');
            // Severity is critical when there are more than 2 corruption reasons
            expect(corruption.severity).toBe(corruption.reasons.length > 2 ? 'critical' : 'moderate');
        });

        test('should detect duplicate content', () => {
            const container = document.getElementById('slowQueries');
            
            // Add many duplicate elements
            for (let i = 0; i < 50; i++) {
                const div = document.createElement('div');
                div.className = 'query-item';
                div.textContent = 'Duplicate Query Content';
                container.appendChild(div);
            }
            
            const corruption = contentUpdateManager.detectContainerCorruption('slowQueries');
            
            expect(corruption.corrupted).toBe(true);
            expect(corruption.reasons).toContain('duplicateContent');
        });

        test('should detect malformed HTML structure', () => {
            const container = document.getElementById('slowQueries');
            
            // Add malformed HTML
            container.innerHTML = '<div><span>Unclosed div<span>More unclosed</div>';
            
            const corruption = contentUpdateManager.detectContainerCorruption('slowQueries');
            
            expect(corruption.corrupted).toBe(true);
            expect(corruption.reasons).toContain('malformedStructure');
        });

        test('should detect scroll anomalies', () => {
            const container = document.getElementById('slowQueries');
            
            // Mock scroll properties to simulate anomalies
            Object.defineProperty(container, 'scrollTop', { value: 1000, writable: true });
            Object.defineProperty(container, 'scrollHeight', { value: 500, writable: true });
            Object.defineProperty(container, 'clientHeight', { value: 300, writable: true });
            
            const corruption = contentUpdateManager.detectContainerCorruption('slowQueries');
            
            expect(corruption.corrupted).toBe(true);
            expect(corruption.reasons).toContain('scrollAnomalies');
        });

        test('should handle corruption detection when disabled', () => {
            contentUpdateManager.setCorruptionDetectionEnabled(false);
            
            const corruption = contentUpdateManager.detectContainerCorruption('slowQueries');
            
            expect(corruption.corrupted).toBe(false);
            expect(corruption.reason).toBe('Detection disabled');
        });
    });

    describe('Comprehensive Error Logging', () => {
        test('should log errors with comprehensive context', () => {
            contentUpdateManager.logError('TEST_ERROR', 'Test error message', {
                containerId: 'slowQueries',
                testData: 'test value'
            });
            
            const errorLog = contentUpdateManager.getErrorLog();
            expect(errorLog).toHaveLength(1);
            
            const error = errorLog[0];
            expect(error.type).toBe('TEST_ERROR');
            expect(error.message).toBe('Test error message');
            expect(error.context.containerId).toBe('slowQueries');
            expect(error.context.testData).toBe('test value');
            expect(error.timestamp).toBeGreaterThan(0);
            expect(error.errorId).toBeTruthy();
            expect(error.userAgent).toBeTruthy();
            expect(error.url).toBeTruthy();
        });

        test('should maintain error log size limits', () => {
            contentUpdateManager.maxErrorLogSize = 5;
            
            // Add more errors than the limit
            for (let i = 0; i < 10; i++) {
                contentUpdateManager.logError('TEST_ERROR', `Error ${i}`, { index: i });
            }
            
            const errorLog = contentUpdateManager.getErrorLog();
            expect(errorLog).toHaveLength(5);
            
            // Should keep the most recent errors
            expect(errorLog[0].context.index).toBe(5);
            expect(errorLog[4].context.index).toBe(9);
        });

        test('should filter error log by type', () => {
            contentUpdateManager.logError('TYPE_A', 'Error A1', {});
            contentUpdateManager.logError('TYPE_B', 'Error B1', {});
            contentUpdateManager.logError('TYPE_A', 'Error A2', {});
            
            const typeAErrors = contentUpdateManager.getErrorLog('TYPE_A');
            expect(typeAErrors).toHaveLength(2);
            expect(typeAErrors[0].message).toBe('Error A1');
            expect(typeAErrors[1].message).toBe('Error A2');
        });

        test('should store errors in session storage', () => {
            contentUpdateManager.logError('STORAGE_TEST', 'Storage test error', { test: true });
            
            const storedErrors = JSON.parse(sessionStorage.getItem('contentUpdateManagerErrors') || '[]');
            expect(storedErrors).toHaveLength(1);
            expect(storedErrors[0].type).toBe('STORAGE_TEST');
        });

        test('should clear error log', () => {
            contentUpdateManager.logError('TEST_ERROR', 'Test error', {});
            expect(contentUpdateManager.getErrorLog()).toHaveLength(1);
            
            contentUpdateManager.clearErrorLog();
            expect(contentUpdateManager.getErrorLog()).toHaveLength(0);
            
            const storedErrors = sessionStorage.getItem('contentUpdateManagerErrors');
            expect(storedErrors).toBeNull();
        });
    });

    describe('Update with Error Recovery', () => {
        test('should create snapshot before update and rollback on failure', async () => {
            // Disable DOM monitoring for this test
            contentUpdateManager.setCorruptionDetectionEnabled(false);
            
            const failingUpdateFunction = jest.fn().mockRejectedValue(new Error('Update failed'));
            
            const result = await contentUpdateManager.updateContainer('slowQueries', failingUpdateFunction, {}, {
                enableRollback: true,
                bypassThrottle: true
            });
            
            // Should return null indicating rollback occurred
            expect(result).toBeNull();
            
            // Should have created snapshot
            expect(contentUpdateManager.containerSnapshots.has('slowQueries')).toBe(true);
            
            // Should have logged the failure
            const errorLog = contentUpdateManager.getErrorLog('UPDATE_FAILED');
            expect(errorLog).toHaveLength(1);
        });

        test('should detect corruption after update and trigger rollback', async () => {
            // Create a snapshot first
            contentUpdateManager.createContainerSnapshot('slowQueries');
            
            const corruptingUpdateFunction = jest.fn().mockImplementation(() => {
                const container = document.getElementById('slowQueries');
                // Create corruption by adding excessive content
                for (let i = 0; i < 2500; i++) {
                    const div = document.createElement('div');
                    div.className = 'query-item';
                    container.appendChild(div);
                }
                return Promise.resolve();
            });
            
            const result = await contentUpdateManager.updateContainer('slowQueries', corruptingUpdateFunction, {}, {
                enableRollback: true,
                bypassThrottle: true
            });
            
            // Should have detected corruption and rolled back
            expect(result).toBeNull(); // Indicates rollback occurred
            
            const errorLog = contentUpdateManager.getErrorLog('UPDATE_FAILED');
            expect(errorLog.length).toBeGreaterThan(0);
        });

        test('should attempt recreation when rollback fails', async () => {
            // Disable rollback to force recreation
            contentUpdateManager.setRollbackEnabled(false);
            contentUpdateManager.setCorruptionDetectionEnabled(false);
            
            const failingUpdateFunction = jest.fn().mockRejectedValue(new Error('Update failed'));
            
            const result = await contentUpdateManager.updateContainer('slowQueries', failingUpdateFunction, {}, {
                enableRollback: true,
                bypassThrottle: true
            });
            
            // Should have attempted recreation
            expect(result).toBeNull();
            
            const container = document.getElementById('slowQueries');
            expect(container.innerHTML).toContain('Container Recreated');
        });

        test('should track successful updates in history', async () => {
            // Disable corruption detection for clean test
            contentUpdateManager.setCorruptionDetectionEnabled(false);
            
            const successfulUpdateFunction = jest.fn().mockResolvedValue('success');
            
            await contentUpdateManager.updateContainer('slowQueries', successfulUpdateFunction, { test: 'data' }, {
                bypassThrottle: true
            });
            
            const history = contentUpdateManager.getUpdateHistory('slowQueries');
            expect(history).toBeTruthy();
            expect(history.success).toBe(true);
            expect(history.nodeCount).toBeGreaterThan(0);
            expect(history.duration).toBeGreaterThan(0);
        });
    });

    describe('Health Check System', () => {
        test('should perform comprehensive health check', () => {
            // Disable corruption detection to avoid DOM monitoring issues
            contentUpdateManager.setCorruptionDetectionEnabled(false);
            
            // Create some issues to detect
            contentUpdateManager.logError('TEST_ERROR', 'Test error', { containerId: 'slowQueries' });
            contentUpdateManager.rollbackAttempts.set('pluginPerformance', 2);
            
            const healthCheck = contentUpdateManager.performHealthCheck();
            
            expect(healthCheck.timestamp).toBeGreaterThan(0);
            expect(healthCheck.overallHealth).toBeTruthy();
            expect(healthCheck.containers).toHaveProperty('slowQueries');
            expect(healthCheck.containers).toHaveProperty('pluginPerformance');
            expect(healthCheck.recommendations).toBeInstanceOf(Array);
        });

        test('should detect critical health issues', () => {
            // Simulate critical issues by setting rollback attempts to max
            contentUpdateManager.rollbackAttempts.set('slowQueries', contentUpdateManager.maxRollbackAttempts);
            
            // Disable corruption detection to avoid DOM monitoring issues
            contentUpdateManager.setCorruptionDetectionEnabled(false);
            
            const healthCheck = contentUpdateManager.performHealthCheck();
            
            expect(healthCheck.overallHealth).toBe('critical');
            expect(healthCheck.containers.slowQueries.status).toBe('critical');
            expect(healthCheck.containers.slowQueries.issues.length).toBeGreaterThan(0);
        });
    });

    describe('Configuration and Management', () => {
        test('should configure rollback settings', () => {
            contentUpdateManager.setRollbackEnabled(false);
            contentUpdateManager.setMaxRollbackAttempts(5);
            
            const status = contentUpdateManager.getErrorRecoveryStatus();
            expect(status.rollbackEnabled).toBe(false);
            expect(status.maxRollbackAttempts).toBe(5);
        });

        test('should configure corruption detection', () => {
            contentUpdateManager.setCorruptionDetectionEnabled(false);
            
            const status = contentUpdateManager.getErrorRecoveryStatus();
            expect(status.corruptionDetectionEnabled).toBe(false);
        });

        test('should provide comprehensive status information', () => {
            contentUpdateManager.logError('TEST_ERROR', 'Test', {});
            contentUpdateManager.createContainerSnapshot('slowQueries');
            
            const status = contentUpdateManager.getErrorRecoveryStatus();
            
            expect(status).toHaveProperty('rollbackEnabled');
            expect(status).toHaveProperty('corruptionDetectionEnabled');
            expect(status).toHaveProperty('maxRollbackAttempts');
            expect(status).toHaveProperty('errorLogSize');
            expect(status).toHaveProperty('snapshotCount');
            expect(status).toHaveProperty('recentErrors');
            expect(status.errorLogSize).toBe(1);
            expect(status.snapshotCount).toBe(1);
        });
    });
});
