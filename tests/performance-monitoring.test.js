/**
 * Performance Monitoring Tests
 * 
 * Tests for the performance monitoring and optimization features
 * including timing measurements, memory monitoring, and frequency benchmarking.
 */

const { JSDOM } = require('jsdom');

describe('Performance Monitoring', () => {
    let dom, window, document;
    let PerformanceTimer, MemoryMonitor, UpdateFrequencyBenchmark, PerformanceMonitor;

    beforeEach(() => {
        // Set up DOM environment
        dom = new JSDOM(`
            <!DOCTYPE html>
            <html>
            <head><title>Test</title></head>
            <body>
                <div id="slowQueries"></div>
                <div id="pluginPerformance"></div>
                <div id="testContainer">
                    <div class="test-item">Item 1</div>
                    <div class="test-item">Item 2</div>
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
        let performanceNowValue = 0;
        window.performance = {
            now: jest.fn(() => performanceNowValue),
            memory: {
                jsHeapSizeLimit: 100 * 1024 * 1024, // 100MB
                totalJSHeapSize: 50 * 1024 * 1024,  // 50MB
                usedJSHeapSize: 30 * 1024 * 1024    // 30MB
            }
        };
        
        // Helper to set performance.now return value
        window.setPerformanceNow = (value) => {
            performanceNowValue = value;
        };

        // Mock navigator
        window.navigator = {
            deviceMemory: 8 // 8GB
        };

        // Load performance monitoring classes
        const performanceMonitorCode = require('fs').readFileSync(
            require('path').join(__dirname, '../public/js/performance-monitor.js'), 
            'utf8'
        );
        
        // Execute the code in the window context
        const script = new window.Function(performanceMonitorCode);
        script.call(window);

        // Get references to the classes
        PerformanceTimer = window.PerformanceTimer;
        MemoryMonitor = window.MemoryMonitor;
        UpdateFrequencyBenchmark = window.UpdateFrequencyBenchmark;
        PerformanceMonitor = window.PerformanceMonitor;
    });

    afterEach(() => {
        dom.window.close();
    });

    describe('PerformanceTimer', () => {
        let timer;

        beforeEach(() => {
            timer = new PerformanceTimer();
        });

        test('should start and end timing operations', () => {
            const operationId = 'test_operation';
            
            window.setPerformanceNow(100);
            timer.start(operationId, { type: 'update' });
            expect(timer.timers.has(operationId)).toBe(true);
            
            // Simulate some time passing
            window.setPerformanceNow(150);
            const result = timer.end(operationId);
            
            expect(result).toBeDefined();
            expect(result.operationId).toBe(operationId);
            expect(result.duration).toBe(50);
            expect(timer.timers.has(operationId)).toBe(false);
        });

        test('should calculate performance statistics', () => {
            const operationId = 'stats_test';
            
            // Add multiple measurements
            for (let i = 0; i < 10; i++) {
                window.setPerformanceNow(i * 10);
                timer.start(operationId);
                window.setPerformanceNow(i * 10 + 5 + i); // Increasing duration
                timer.end(operationId);
            }
            
            const stats = timer.getStats(operationId);
            
            expect(stats.operationId).toBe(operationId);
            expect(stats.count).toBe(10);
            expect(stats.min).toBeGreaterThan(0);
            expect(stats.max).toBeGreaterThan(stats.min);
            expect(stats.average).toBeGreaterThan(0);
            expect(stats.recentTrend).toBeDefined();
        });

        test('should detect performance trends', () => {
            const operationId = 'trend_test';
            
            // Add measurements with increasing duration (degrading performance)
            for (let i = 0; i < 10; i++) {
                window.setPerformanceNow(i * 10);
                timer.start(operationId);
                window.setPerformanceNow(i * 10 + 10 + i * 2); // Increasing duration
                timer.end(operationId);
            }
            
            const stats = timer.getStats(operationId);
            
            expect(stats.recentTrend.trend).toBe('degrading');
            expect(parseFloat(stats.recentTrend.slope)).toBeGreaterThan(1);
        });

        test('should clear measurements', () => {
            const operationId = 'clear_test';
            
            timer.start(operationId);
            timer.end(operationId);
            
            expect(timer.measurements.has(operationId)).toBe(true);
            
            timer.clearMeasurements(operationId);
            expect(timer.measurements.has(operationId)).toBe(false);
        });
    });

    describe('MemoryMonitor', () => {
        let monitor;

        beforeEach(() => {
            monitor = new MemoryMonitor();
        });

        test('should measure memory usage', () => {
            const measurement = monitor.measure('test_context');
            
            expect(measurement).toBeDefined();
            expect(measurement.context).toBe('test_context');
            expect(measurement.memory).toBeDefined();
            expect(measurement.memory.usedJSHeapSize).toBe(30 * 1024 * 1024);
            expect(measurement.memory.heapUsagePercent).toBeCloseTo(30);
        });

        test('should detect memory alerts', () => {
            const alertSpy = jest.fn();
            window.addEventListener('memoryAlert', alertSpy);
            
            // Set high memory usage
            window.performance.memory.usedJSHeapSize = 60 * 1024 * 1024; // 60MB
            monitor.setAlertThresholds({
                warning: 50 * 1024 * 1024, // 50MB
                critical: 80 * 1024 * 1024 // 80MB
            });
            
            monitor.measure('alert_test');
            
            expect(alertSpy).toHaveBeenCalledWith(
                expect.objectContaining({
                    detail: expect.objectContaining({
                        level: 'warning'
                    })
                })
            );
        });

        test('should calculate memory statistics', () => {
            // Add multiple measurements with varying memory usage
            for (let i = 0; i < 5; i++) {
                window.performance.memory.usedJSHeapSize = (30 + i * 2) * 1024 * 1024;
                monitor.measure(`measurement_${i}`);
            }
            
            const stats = monitor.getStats();
            
            expect(stats.measurementCount).toBe(5);
            expect(stats.jsHeap).toBeDefined();
            expect(stats.jsHeap.min).toBeLessThan(stats.jsHeap.max);
            expect(stats.jsHeap.trend).toBeDefined();
        });

        test('should start and stop continuous monitoring', () => {
            jest.useFakeTimers();
            
            monitor.startMonitoring(1000); // 1 second interval
            expect(monitor.monitoringInterval).toBeDefined();
            
            // Fast-forward time
            jest.advanceTimersByTime(2500);
            expect(monitor.measurements.length).toBeGreaterThan(1);
            
            monitor.stopMonitoring();
            expect(monitor.monitoringInterval).toBeNull();
            
            jest.useRealTimers();
        });
    });

    describe('UpdateFrequencyBenchmark', () => {
        let benchmark;

        beforeEach(() => {
            benchmark = new UpdateFrequencyBenchmark();
        });

        test('should record update events', () => {
            const containerId = 'test_container';
            
            benchmark.recordUpdate(containerId, { duration: 100 });
            
            expect(benchmark.updateEvents.has(containerId)).toBe(true);
            expect(benchmark.updateEvents.get(containerId)).toHaveLength(1);
        });

        test('should calculate frequency statistics', () => {
            const containerId = 'freq_test';
            
            // Record multiple updates with known intervals
            const baseTime = Date.now();
            for (let i = 0; i < 10; i++) {
                jest.spyOn(Date, 'now').mockReturnValue(baseTime + i * 1000); // 1 second intervals
                benchmark.recordUpdate(containerId, { duration: 50 });
            }
            
            const stats = benchmark.getFrequencyStats(containerId);
            
            expect(stats.totalUpdates).toBe(10);
            expect(stats.intervals).toBeDefined();
            expect(stats.frequency).toBeDefined();
            expect(parseFloat(stats.frequency.updatesPerMinute)).toBeCloseTo(60, 0); // ~60 updates per minute
        });

        test('should analyze update patterns', () => {
            const containerId = 'pattern_test';
            
            // Record updates with regular intervals
            const baseTime = Date.now();
            for (let i = 0; i < 20; i++) {
                jest.spyOn(Date, 'now').mockReturnValue(baseTime + i * 2000); // 2 second intervals
                benchmark.recordUpdate(containerId, { duration: 50 });
            }
            
            const stats = benchmark.getFrequencyStats(containerId);
            
            expect(stats.recentActivity.pattern).toMatch(/regular/);
            expect(stats.recentActivity.averageInterval).toBe('2000');
        });

        test('should generate optimization recommendations', () => {
            const containerId = 'recommendation_test';
            
            // Simulate high frequency updates
            const baseTime = Date.now();
            for (let i = 0; i < 50; i++) {
                jest.spyOn(Date, 'now').mockReturnValue(baseTime + i * 500); // 0.5 second intervals
                benchmark.recordUpdate(containerId, { duration: 150 }); // Slow updates
            }
            
            const benchmarkResult = benchmark.benchmarkFrequency(containerId, {
                averageUpdateTime: 150
            });
            
            expect(benchmarkResult.recommendations).toBeDefined();
            expect(benchmarkResult.recommendations.length).toBeGreaterThan(0);
            
            const hasFrequencyRecommendation = benchmarkResult.recommendations.some(
                rec => rec.type === 'frequency_reduction'
            );
            expect(hasFrequencyRecommendation).toBe(true);
        });

        test('should estimate performance impact', () => {
            const containerId = 'impact_test';
            
            // Record updates
            for (let i = 0; i < 30; i++) {
                benchmark.recordUpdate(containerId, { duration: 100 });
            }
            
            const benchmarkResult = benchmark.benchmarkFrequency(containerId, {
                averageUpdateTime: 100,
                memoryPerUpdate: 2048
            });
            
            expect(benchmarkResult.performanceImpact).toBeDefined();
            expect(benchmarkResult.performanceImpact.cpuImpactPercent).toBeGreaterThan(0);
            expect(benchmarkResult.performanceImpact.memoryImpact).toBeDefined();
        });
    });

    describe('PerformanceMonitor Integration', () => {
        let monitor;

        beforeEach(() => {
            monitor = new PerformanceMonitor();
        });

        test('should start and stop comprehensive monitoring', () => {
            jest.useFakeTimers();
            
            monitor.startMonitoring({
                memoryFrequency: 1000,
                enableMemoryAlerts: true
            });
            
            expect(monitor.isMonitoring).toBe(true);
            expect(monitor.memoryMonitor.monitoringInterval).toBeDefined();
            
            monitor.stopMonitoring();
            expect(monitor.isMonitoring).toBe(false);
            
            jest.useRealTimers();
        });

        test('should instrument update operations', async () => {
            const containerId = 'instrumented_test';
            const mockUpdateFunction = jest.fn().mockResolvedValue('success');
            const testData = { test: 'data' };
            
            window.setPerformanceNow(100);
            const result = await monitor.instrumentUpdate(
                containerId,
                mockUpdateFunction,
                testData
            );
            
            expect(result).toBe('success');
            expect(mockUpdateFunction).toHaveBeenCalledWith(testData);
            
            // Check that timing was recorded
            expect(Object.keys(monitor.timer.measurements)).toHaveLength(1);
            
            // Check that frequency benchmark recorded the update
            expect(monitor.frequencyBenchmark.updateEvents.has(containerId)).toBe(true);
        });

        test('should generate comprehensive performance report', () => {
            // Add some test data
            monitor.timer.start('test_op');
            monitor.timer.end('test_op');
            monitor.memoryMonitor.measure('test');
            monitor.frequencyBenchmark.recordUpdate('test_container', { duration: 100 });
            
            const report = monitor.getPerformanceReport();
            
            expect(report).toBeDefined();
            expect(report.timing).toBeDefined();
            expect(report.memory).toBeDefined();
            expect(report.frequency).toBeDefined();
            expect(report.isMonitoring).toBe(false);
        });

        test('should generate optimization recommendations', () => {
            // Add performance data that should trigger recommendations
            for (let i = 0; i < 10; i++) {
                window.setPerformanceNow(i * 10);
                monitor.timer.start('slow_operation');
                window.setPerformanceNow(i * 10 + 250); // Slow operations (250ms)
                monitor.timer.end('slow_operation');
            }
            
            const recommendations = monitor.generateOptimizationRecommendations();
            
            expect(recommendations).toBeDefined();
            expect(Array.isArray(recommendations)).toBe(true);
            
            const hasTimingRecommendation = recommendations.some(
                rec => rec.type === 'timing_optimization'
            );
            expect(hasTimingRecommendation).toBe(true);
        });

        test('should handle memory alerts', () => {
            const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
            
            // Simulate critical memory alert
            const alertEvent = new window.CustomEvent('memoryAlert', {
                detail: {
                    level: 'critical',
                    measurement: {
                        memory: {
                            usedJSHeapSize: 90 * 1024 * 1024
                        }
                    }
                }
            });
            
            monitor.handleMemoryAlert(alertEvent);
            
            expect(consoleSpy).toHaveBeenCalledWith(
                expect.stringContaining('Memory alert (critical)'),
                expect.any(Object)
            );
            
            consoleSpy.mockRestore();
        });

        test('should export performance data', () => {
            // Add some test data
            monitor.timer.start('export_test');
            monitor.timer.end('export_test');
            monitor.memoryMonitor.measure('export');
            
            const exportedData = monitor.exportData();
            
            expect(exportedData).toBeDefined();
            expect(exportedData.report).toBeDefined();
            expect(exportedData.recommendations).toBeDefined();
            expect(exportedData.rawData).toBeDefined();
            expect(exportedData.exportTimestamp).toBeDefined();
        });
    });

    describe('Performance Monitoring Integration with Content Updates', () => {
        test('should work with ContentUpdateManager if available', async () => {
            // Mock ContentUpdateManager
            const mockContentUpdateManager = {
                updateContainer: jest.fn().mockResolvedValue('updated')
            };
            window.contentUpdateManager = mockContentUpdateManager;
            
            const monitor = new PerformanceMonitor();
            const containerId = 'integration_test';
            const updateFunction = jest.fn().mockResolvedValue('result');
            
            window.setPerformanceNow(200);
            await monitor.instrumentUpdate(containerId, updateFunction, { test: 'data' });
            
            expect(updateFunction).toHaveBeenCalled();
            
            // Check that performance data was recorded
            const measurements = monitor.timer.measurements;
            expect(Object.keys(measurements)).toHaveLength(1);
        });

        test('should handle update failures gracefully', async () => {
            const monitor = new PerformanceMonitor();
            const containerId = 'failure_test';
            const failingFunction = jest.fn().mockRejectedValue(new Error('Update failed'));
            
            window.setPerformanceNow(300);
            await expect(
                monitor.instrumentUpdate(containerId, failingFunction, {})
            ).rejects.toThrow('Update failed');
            
            // Check that failure was recorded
            const measurements = monitor.timer.measurements;
            expect(Object.keys(measurements)).toHaveLength(1);
            
            const operationKey = Object.keys(measurements)[0];
            const lastMeasurement = measurements[operationKey][0];
            
            expect(lastMeasurement.success).toBe(false);
            expect(lastMeasurement.error).toBe('Update failed');
        });
    });
});
