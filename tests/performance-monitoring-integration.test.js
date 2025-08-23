/**
 * Performance Monitoring Integration Tests
 * 
 * Simplified tests to verify the performance monitoring integration
 * with the content management system.
 */

const { JSDOM } = require('jsdom');

describe('Performance Monitoring Integration', () => {
    let dom, window, document;

    beforeEach(() => {
        // Set up DOM environment
        dom = new JSDOM(`
            <!DOCTYPE html>
            <html>
            <head><title>Test</title></head>
            <body>
                <div id="slowQueries">
                    <div class="query-item">Query 1</div>
                    <div class="query-item">Query 2</div>
                </div>
                <div id="pluginPerformance">
                    <div class="plugin-item">Plugin 1</div>
                </div>
            </body>
            </html>
        `, {
            url: 'http://localhost:3000',
            pretendToBeVisual: true,
            resources: 'usable'
        });

        window = dom.window;
        document = window.document;
        global.window = window;
        global.document = document;

        // Mock performance API
        window.performance = {
            now: () => Date.now(),
            memory: {
                jsHeapSizeLimit: 100 * 1024 * 1024,
                totalJSHeapSize: 50 * 1024 * 1024,
                usedJSHeapSize: 30 * 1024 * 1024
            }
        };

        // Mock navigator
        window.navigator = {
            deviceMemory: 8
        };

        // Load performance monitoring code
        const performanceMonitorCode = require('fs').readFileSync(
            require('path').join(__dirname, '../public/js/performance-monitor.js'), 
            'utf8'
        );
        
        const script = new window.Function(performanceMonitorCode);
        script.call(window);

        // Load content management code
        const contentManagementCode = require('fs').readFileSync(
            require('path').join(__dirname, '../public/js/content-management.js'), 
            'utf8'
        );
        
        const contentScript = new window.Function(contentManagementCode);
        contentScript.call(window);
    });

    afterEach(() => {
        dom.window.close();
    });

    test('should load performance monitoring classes', () => {
        expect(window.PerformanceTimer).toBeDefined();
        expect(window.MemoryMonitor).toBeDefined();
        expect(window.UpdateFrequencyBenchmark).toBeDefined();
        expect(window.PerformanceMonitor).toBeDefined();
        expect(window.performanceMonitor).toBeDefined();
    });

    test('should load content management classes', () => {
        expect(window.ContentUpdateManager).toBeDefined();
        expect(window.ScrollPreserver).toBeDefined();
        expect(window.DOMSizeMonitor).toBeDefined();
        expect(window.DOMCleanup).toBeDefined();
        expect(window.contentUpdateManager).toBeDefined();
    });

    test('should create performance timer and measure operations', () => {
        const timer = new window.PerformanceTimer();
        
        timer.start('test_operation');
        expect(timer.timers.has('test_operation')).toBe(true);
        
        const result = timer.end('test_operation');
        expect(result).toBeDefined();
        expect(result.operationId).toBe('test_operation');
        expect(result.duration).toBeGreaterThan(0);
        expect(timer.timers.has('test_operation')).toBe(false);
    });

    test('should create memory monitor and take measurements', () => {
        const monitor = new window.MemoryMonitor();
        
        const measurement = monitor.measure('test_context');
        
        expect(measurement).toBeDefined();
        expect(measurement.context).toBe('test_context');
        expect(measurement.memory).toBeDefined();
        expect(measurement.memory.domNodeCount).toBeGreaterThan(0);
    });

    test('should create frequency benchmark and record updates', () => {
        const benchmark = new window.UpdateFrequencyBenchmark();
        
        benchmark.recordUpdate('test_container', { duration: 100 });
        
        expect(benchmark.updateEvents.has('test_container')).toBe(true);
        expect(benchmark.updateEvents.get('test_container')).toHaveLength(1);
    });

    test('should integrate performance monitoring with content updates', async () => {
        const updateManager = window.contentUpdateManager;
        const performanceMonitor = window.performanceMonitor;
        
        expect(updateManager).toBeDefined();
        expect(performanceMonitor).toBeDefined();
        
        // Mock update function
        const mockUpdate = jest.fn().mockResolvedValue('updated');
        
        // Perform update with performance monitoring
        await updateManager.updateContainer('slowQueries', mockUpdate, { test: 'data' });
        
        expect(mockUpdate).toHaveBeenCalledWith({ test: 'data' });
    });

    test('should monitor DOM size during updates', () => {
        const domMonitor = new window.DOMSizeMonitor();
        
        const result = domMonitor.monitorContainer('slowQueries');
        
        expect(result).toBeDefined();
        expect(result.containerId).toBe('slowQueries');
        expect(result.nodeCount).toBeGreaterThan(0);
        expect(result.status).toBeDefined();
    });

    test('should provide global utility functions', () => {
        expect(typeof window.startPerformanceMonitoring).toBe('function');
        expect(typeof window.stopPerformanceMonitoring).toBe('function');
        expect(typeof window.getPerformanceReport).toBe('function');
        expect(typeof window.getOptimizationRecommendations).toBe('function');
        expect(typeof window.exportPerformanceData).toBe('function');
        expect(typeof window.clearPerformanceData).toBe('function');
    });

    test('should generate performance reports', () => {
        const performanceMonitor = window.performanceMonitor;
        
        // Add some test data
        performanceMonitor.timer.start('test_report');
        performanceMonitor.timer.end('test_report');
        performanceMonitor.memoryMonitor.measure('test_report');
        
        const report = performanceMonitor.getPerformanceReport();
        
        expect(report).toBeDefined();
        expect(report.timing).toBeDefined();
        expect(report.memory).toBeDefined();
        expect(report.frequency).toBeDefined();
        expect(report.isMonitoring).toBeDefined();
    });

    test('should generate optimization recommendations', () => {
        const performanceMonitor = window.performanceMonitor;
        
        const recommendations = performanceMonitor.generateOptimizationRecommendations();
        
        expect(recommendations).toBeDefined();
        expect(Array.isArray(recommendations)).toBe(true);
    });

    test('should handle content update manager performance integration', async () => {
        const updateManager = window.contentUpdateManager;
        
        // Test that performance monitoring is enabled by default
        const mockUpdate = jest.fn().mockResolvedValue('success');
        
        await updateManager.executeContainerUpdate('slowQueries', mockUpdate, { test: 'data' }, {
            enablePerformanceMonitoring: true
        });
        
        expect(mockUpdate).toHaveBeenCalled();
    });

    test('should provide DOM size monitoring utilities', () => {
        expect(typeof window.checkDOMSizes).toBe('function');
        expect(typeof window.emergencyCleanupAll).toBe('function');
        expect(typeof window.checkUpdateStatus).toBe('function');
        expect(typeof window.checkThrottlingStats).toBe('function');
    });

    test('should start and stop performance monitoring', () => {
        const performanceMonitor = window.performanceMonitor;
        
        expect(performanceMonitor.isMonitoring).toBe(false);
        
        performanceMonitor.startMonitoring({
            memoryFrequency: 5000,
            enableMemoryAlerts: true
        });
        
        expect(performanceMonitor.isMonitoring).toBe(true);
        
        performanceMonitor.stopMonitoring();
        
        expect(performanceMonitor.isMonitoring).toBe(false);
    });

    test('should export performance data', () => {
        const performanceMonitor = window.performanceMonitor;
        
        // Add some test data
        performanceMonitor.timer.start('export_test');
        performanceMonitor.timer.end('export_test');
        
        const exportedData = performanceMonitor.exportData();
        
        expect(exportedData).toBeDefined();
        expect(exportedData.report).toBeDefined();
        expect(exportedData.recommendations).toBeDefined();
        expect(exportedData.rawData).toBeDefined();
        expect(exportedData.exportTimestamp).toBeDefined();
    });

    test('should handle performance monitoring with content management coordination', async () => {
        const updateManager = window.contentUpdateManager;
        const performanceMonitor = window.performanceMonitor;
        
        // Start performance monitoring
        performanceMonitor.startMonitoring();
        
        // Perform multiple coordinated updates
        const updates = [
            {
                containerId: 'slowQueries',
                updateFunction: jest.fn().mockResolvedValue('query_updated'),
                data: { queries: ['SELECT * FROM posts'] },
                options: { preserveScroll: true }
            },
            {
                containerId: 'pluginPerformance',
                updateFunction: jest.fn().mockResolvedValue('plugin_updated'),
                data: { plugins: ['akismet'] },
                options: { cleanupRequired: true }
            }
        ];
        
        await updateManager.coordinateUpdates(updates, {
            sequential: true,
            priority: 'normal'
        });
        
        // Verify all updates were called
        updates.forEach(update => {
            expect(update.updateFunction).toHaveBeenCalled();
        });
        
        // Stop monitoring
        performanceMonitor.stopMonitoring();
    });
});
