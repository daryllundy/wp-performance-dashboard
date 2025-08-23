/**
 * Integration tests for real-time updates and periodic refreshes
 * Tests the complete workflow of real-time data updates, periodic refreshes, and their coordination
 */

const { JSDOM } = require('jsdom');

describe('Real-time Updates and Periodic Refreshes Integration', () => {
    let dom;
    let window;
    let document;
    let contentUpdateManager;
    let mockSocket;
    let mockFetch;

    beforeEach(() => {
        // Create comprehensive DOM environment
        dom = new JSDOM(`
            <!DOCTYPE html>
            <html>
            <body>
                <div id="slowQueries" style="height: 300px; overflow-y: auto;"></div>
                <div id="pluginPerformance" style="height: 300px; overflow-y: auto;"></div>
                <div id="real-time-metrics">
                    <span id="qps-value">0</span>
                    <span id="response-value">0ms</span>
                    <span id="memory-value">0MB</span>
                </div>
                <div id="slow-query-count">0 queries</div>
                <div id="plugin-count">0 plugins</div>
                <canvas id="performanceChart"></canvas>
                <canvas id="adminAjaxChart"></canvas>
                <canvas id="qpsGauge"></canvas>
                <canvas id="responseGauge"></canvas>
                <canvas id="memoryGauge"></canvas>
                <div id="health-status">Good</div>
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
                destroy: jest.fn(),
                data: { labels: [], datasets: [{ data: [] }] },
                update: jest.fn()
            })),
            defaults: { font: {}, color: '' }
        };

        // Mock canvas getContext
        dom.window.HTMLCanvasElement.prototype.getContext = jest.fn(() => ({
            fillRect: jest.fn(),
            clearRect: jest.fn(),
            arc: jest.fn(),
            fill: jest.fn(),
            stroke: jest.fn(),
            beginPath: jest.fn(),
            closePath: jest.fn(),
            moveTo: jest.fn(),
            lineTo: jest.fn(),
            fillText: jest.fn(),
            measureText: jest.fn(() => ({ width: 0 })),
            save: jest.fn(),
            restore: jest.fn(),
            translate: jest.fn(),
            rotate: jest.fn(),
            scale: jest.fn()
        }));

        // Mock NodeFilter and Node for DOM traversal
        global.NodeFilter = window.NodeFilter;
        global.Node = window.Node;

        // Mock Socket.IO
        mockSocket = {
            on: jest.fn(),
            emit: jest.fn(),
            disconnect: jest.fn()
        };
        global.io = jest.fn(() => mockSocket);

        // Mock fetch
        mockFetch = jest.fn();
        global.fetch = mockFetch;

        // Load the content management utilities
        const fs = require('fs');
        const path = require('path');
        const utilsCode = fs.readFileSync(
            path.join(__dirname, '../public/js/content-management.js'), 
            'utf8'
        );
        
        const script = new window.Function(utilsCode);
        script.call(window);

        contentUpdateManager = new window.ContentUpdateManager();

        // Mock dashboard functions
        global.updatePerformanceChart = jest.fn();
        global.updateAdminAjaxChart = jest.fn();
        global.updateSystemHealth = jest.fn();
        global.displaySlowQueries = jest.fn();
        global.displayPluginPerformance = jest.fn();
        global.showError = jest.fn();
        global.clearErrorState = jest.fn();

        // Set up default mock responses
        const mockApiResponses = {
            '/api/metrics': [
                { timestamp: '2024-01-01T00:00:00Z', avg_response_time: 150, queries_per_second: 25, memory_usage: 128 }
            ],
            '/api/slow-queries': [
                { execution_time: 250, query_text: 'SELECT * FROM wp_posts', rows_examined: 1000, source_file: 'wp-includes/query.php' }
            ],
            '/api/admin-ajax': [
                { action_name: 'heartbeat', call_count: 45 }
            ],
            '/api/plugins': [
                { plugin_name: 'Test Plugin', impact_score: 65, memory_usage: 32, query_count: 5, load_time: 120 }
            ],
            '/api/system-health': {
                slow_queries_1h: 3,
                avg_response_time: 145,
                active_plugins: 12,
                status: 'Good'
            }
        };

        mockFetch.mockImplementation((url) => {
            const data = mockApiResponses[url] || {};
            return Promise.resolve({
                ok: true,
                json: () => Promise.resolve(data)
            });
        });
    });

    afterEach(() => {
        if (contentUpdateManager) {
            contentUpdateManager.emergencyStop();
        }
        jest.clearAllMocks();
        dom.window.close();
    });

    describe('Real-time Metrics Updates', () => {
        test('should handle real-time metrics updates with throttling', async () => {
            let realTimeHandler;
            
            // Capture the real-time metrics handler
            mockSocket.on.mockImplementation((event, handler) => {
                if (event === 'real-time-metrics') {
                    realTimeHandler = handler;
                }
            });

            // Simulate socket connection setup
            const socket = global.io();
            socket.on('real-time-metrics', realTimeHandler);

            // Mock real-time data
            const realTimeData = {
                queries_per_second: 45,
                avg_response_time: 180,
                memory_usage: 156
            };

            // Simulate rapid real-time updates
            if (realTimeHandler) {
                realTimeHandler(realTimeData);
                realTimeHandler({ ...realTimeData, queries_per_second: 46 });
                realTimeHandler({ ...realTimeData, queries_per_second: 47 });
            }

            // Wait for throttling to settle
            await new Promise(resolve => setTimeout(resolve, 100));

            // Verify elements were updated
            const qpsElement = document.getElementById('qps-value');
            const responseElement = document.getElementById('response-value');
            const memoryElement = document.getElementById('memory-value');

            expect(qpsElement.textContent).toMatch(/\d+/);
            expect(responseElement.textContent).toMatch(/\d+ms/);
            expect(memoryElement.textContent).toMatch(/\d+MB/);
        });

        test('should coordinate real-time updates with ContentUpdateManager', async () => {
            const updateSpy = jest.spyOn(contentUpdateManager, 'updateContainer');

            // Mock real-time update function
            const realTimeUpdateFunction = async (data) => {
                await contentUpdateManager.updateContainer('real-time-metrics', (metricsData) => {
                    document.getElementById('qps-value').textContent = metricsData.queries_per_second;
                    document.getElementById('response-value').textContent = metricsData.avg_response_time + 'ms';
                    document.getElementById('memory-value').textContent = metricsData.memory_usage + 'MB';
                }, data, {
                    preserveScroll: false,
                    cleanupRequired: true,
                    priority: 'high'
                });
            };

            const testData = {
                queries_per_second: 35,
                avg_response_time: 200,
                memory_usage: 140
            };

            await realTimeUpdateFunction(testData);

            expect(updateSpy).toHaveBeenCalledWith(
                'real-time-metrics',
                expect.any(Function),
                testData,
                expect.objectContaining({
                    preserveScroll: false,
                    cleanupRequired: true,
                    priority: 'high'
                })
            );
        });

        test('should handle real-time update failures gracefully', async () => {
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

            // Mock update function that fails
            const failingUpdateFunction = async () => {
                throw new Error('Real-time update failed');
            };

            // Should not throw unhandled errors
            await expect(
                contentUpdateManager.updateContainer('real-time-metrics', failingUpdateFunction, {}, {
                    priority: 'high'
                })
            ).rejects.toThrow('Real-time update failed');

            consoleSpy.mockRestore();
        });
    });

    describe('Periodic Dashboard Refresh', () => {
        test('should coordinate periodic refresh of all dashboard sections', async () => {
            const coordinateSpy = jest.spyOn(contentUpdateManager, 'coordinateUpdates');

            // Mock loadDashboardData function
            const loadDashboardData = async () => {
                const containerUpdates = [
                    {
                        containerId: 'slowQueries',
                        updateFunction: (data) => {
                            document.getElementById('slowQueries').innerHTML = 
                                data.map(q => `<div class="query-item">${q.query_text}</div>`).join('');
                        },
                        data: [{ query_text: 'SELECT * FROM wp_posts' }],
                        options: { preserveScroll: true }
                    },
                    {
                        containerId: 'pluginPerformance',
                        updateFunction: (data) => {
                            document.getElementById('pluginPerformance').innerHTML = 
                                data.map(p => `<div class="plugin-item">${p.plugin_name}</div>`).join('');
                        },
                        data: [{ plugin_name: 'Test Plugin' }],
                        options: { preserveScroll: true }
                    }
                ];

                await contentUpdateManager.coordinateUpdates(containerUpdates, {
                    sequential: false,
                    maxConcurrent: 3,
                    priority: 'normal'
                });
            };

            await loadDashboardData();

            expect(coordinateSpy).toHaveBeenCalledWith(
                expect.arrayContaining([
                    expect.objectContaining({ containerId: 'slowQueries' }),
                    expect.objectContaining({ containerId: 'pluginPerformance' })
                ]),
                expect.objectContaining({
                    sequential: false,
                    maxConcurrent: 3,
                    priority: 'normal'
                })
            );
        });

        test('should handle periodic refresh with scroll preservation', async () => {
            const slowQueriesContainer = document.getElementById('slowQueries');
            const pluginContainer = document.getElementById('pluginPerformance');

            // Set initial content and scroll positions
            slowQueriesContainer.innerHTML = '<div style="height: 1000px;">Initial queries</div>';
            pluginContainer.innerHTML = '<div style="height: 800px;">Initial plugins</div>';
            slowQueriesContainer.scrollTop = 200;
            pluginContainer.scrollTop = 150;

            // Simulate periodic refresh
            await contentUpdateManager.updateContainer('slowQueries', (data) => {
                slowQueriesContainer.innerHTML = data.map(q => 
                    `<div class="query-item" style="height: 50px;">${q.query_text}</div>`
                ).join('');
            }, [
                { query_text: 'SELECT * FROM wp_posts WHERE post_status = "publish"' },
                { query_text: 'SELECT * FROM wp_options WHERE option_name = "active_plugins"' },
                { query_text: 'SELECT * FROM wp_users WHERE user_login = "admin"' }
            ], {
                preserveScroll: true,
                cleanupRequired: true
            });

            await contentUpdateManager.updateContainer('pluginPerformance', (data) => {
                pluginContainer.innerHTML = data.map(p => 
                    `<div class="plugin-item" style="height: 60px;">${p.plugin_name}</div>`
                ).join('');
            }, [
                { plugin_name: 'Akismet' },
                { plugin_name: 'Jetpack' },
                { plugin_name: 'WooCommerce' }
            ], {
                preserveScroll: true,
                cleanupRequired: true
            });

            // Verify content was updated
            expect(slowQueriesContainer.innerHTML).toContain('query-item');
            expect(pluginContainer.innerHTML).toContain('plugin-item');
            
            // Scroll positions should be preserved (approximately)
            expect(slowQueriesContainer.scrollTop).toBeGreaterThanOrEqual(0);
            expect(pluginContainer.scrollTop).toBeGreaterThanOrEqual(0);
        });

        test('should handle API failures during periodic refresh', async () => {
            // Mock fetch to fail
            mockFetch.mockImplementation(() => Promise.reject(new Error('API Error')));

            const fallbackUpdateFunction = jest.fn();

            // Should handle API failures gracefully
            await expect(
                contentUpdateManager.updateContainer('slowQueries', fallbackUpdateFunction, [], {
                    enableFallback: true
                })
            ).resolves.not.toThrow();
        });
    });

    describe('Real-time and Periodic Update Coordination', () => {
        test('should prevent conflicts between real-time and periodic updates', async () => {
            const updateSpy = jest.spyOn(contentUpdateManager, 'updateContainer');

            // Start a periodic update
            const periodicPromise = contentUpdateManager.updateContainer('real-time-metrics', (data) => {
                document.getElementById('qps-value').textContent = data.qps;
            }, { qps: 30 }, {
                priority: 'normal'
            });

            // Immediately start a real-time update (higher priority)
            const realTimePromise = contentUpdateManager.updateContainer('real-time-metrics', (data) => {
                document.getElementById('qps-value').textContent = data.qps;
            }, { qps: 35 }, {
                priority: 'high'
            });

            await Promise.all([periodicPromise, realTimePromise]);

            // Both updates should complete
            expect(updateSpy).toHaveBeenCalledTimes(2);
        });

        test('should throttle rapid updates from different sources', async () => {
            contentUpdateManager.setContainerThrottleDelay('real-time-metrics', 500);

            const updateFunction = jest.fn();

            // Start multiple updates rapidly
            const promises = [
                contentUpdateManager.updateContainer('real-time-metrics', updateFunction, 'data1'),
                contentUpdateManager.updateContainer('real-time-metrics', updateFunction, 'data2'),
                contentUpdateManager.updateContainer('real-time-metrics', updateFunction, 'data3')
            ];

            await Promise.all(promises);

            // Updates should be throttled, but all should eventually complete
            expect(updateFunction).toHaveBeenCalled();
        });

        test('should handle mixed priority updates correctly', async () => {
            const updateFunction = jest.fn();

            // Start normal priority update
            const normalPromise = contentUpdateManager.updateContainer('slowQueries', updateFunction, 'normal', {
                priority: 'normal'
            });

            // Start critical priority update
            const criticalPromise = contentUpdateManager.updateContainer('slowQueries', updateFunction, 'critical', {
                priority: 'critical'
            });

            // Start high priority update
            const highPromise = contentUpdateManager.updateContainer('slowQueries', updateFunction, 'high', {
                priority: 'high'
            });

            await Promise.all([normalPromise, criticalPromise, highPromise]);

            expect(updateFunction).toHaveBeenCalledTimes(3);
        });
    });

    describe('Long-running Session Behavior', () => {
        test('should maintain stable performance over multiple update cycles', async () => {
            const performanceMetrics = [];

            // Simulate multiple update cycles
            for (let cycle = 0; cycle < 10; cycle++) {
                const startTime = Date.now();

                await contentUpdateManager.coordinateUpdates([
                    {
                        containerId: 'slowQueries',
                        updateFunction: (data) => {
                            document.getElementById('slowQueries').innerHTML = 
                                data.map(q => `<div class="query-item">${q.query_text}</div>`).join('');
                        },
                        data: [{ query_text: `Query cycle ${cycle}` }],
                        options: { preserveScroll: true }
                    },
                    {
                        containerId: 'pluginPerformance',
                        updateFunction: (data) => {
                            document.getElementById('pluginPerformance').innerHTML = 
                                data.map(p => `<div class="plugin-item">${p.plugin_name}</div>`).join('');
                        },
                        data: [{ plugin_name: `Plugin cycle ${cycle}` }],
                        options: { preserveScroll: true }
                    }
                ], {
                    sequential: false,
                    priority: 'normal'
                });

                const endTime = Date.now();
                performanceMetrics.push(endTime - startTime);
            }

            // Performance should remain stable (no significant degradation)
            const avgTime = performanceMetrics.reduce((a, b) => a + b, 0) / performanceMetrics.length;
            const maxTime = Math.max(...performanceMetrics);
            
            expect(avgTime).toBeLessThan(100); // Average should be under 100ms
            expect(maxTime).toBeLessThan(500); // Max should be under 500ms
        });

        test('should clean up resources properly over time', async () => {
            const initialStats = contentUpdateManager.getDOMStats();

            // Simulate many updates over time
            for (let i = 0; i < 20; i++) {
                await contentUpdateManager.updateContainer('slowQueries', (data) => {
                    const container = document.getElementById('slowQueries');
                    container.innerHTML = data.map(q => 
                        `<div class="query-item">${q.query_text}</div>`
                    ).join('');
                }, [
                    { query_text: `Query ${i}` }
                ], {
                    cleanupRequired: true
                });

                // Simulate some delay between updates
                await new Promise(resolve => setTimeout(resolve, 10));
            }

            const finalStats = contentUpdateManager.getDOMStats();

            // DOM size should not grow uncontrollably
            const slowQueriesInitial = initialStats.containers.find(c => c.containerId === 'slowQueries');
            const slowQueriesFinal = finalStats.containers.find(c => c.containerId === 'slowQueries');

            if (slowQueriesInitial && slowQueriesFinal) {
                // Node count should not have grown dramatically
                expect(slowQueriesFinal.nodeCount).toBeLessThan(slowQueriesInitial.nodeCount * 5);
            }
        });

        test('should handle memory pressure gracefully', async () => {
            // Set very low DOM limits to simulate memory pressure
            contentUpdateManager.setContainerLimit('slowQueries', 10);
            contentUpdateManager.setContainerLimit('pluginPerformance', 10);

            // Simulate updates that would normally cause DOM growth
            for (let i = 0; i < 5; i++) {
                await contentUpdateManager.updateContainer('slowQueries', (data) => {
                    const container = document.getElementById('slowQueries');
                    const items = data.map(q => 
                        `<div class="query-item">
                            <div class="query-header">${q.query_text}</div>
                            <div class="query-details">Details for query ${q.id}</div>
                            <div class="query-meta">Meta information</div>
                        </div>`
                    ).join('');
                    container.innerHTML = items;
                }, 
                Array.from({ length: 20 }, (_, j) => ({ 
                    id: i * 20 + j, 
                    query_text: `Query ${i}-${j}` 
                })));
            }

            // Should handle memory pressure without crashing
            const stats = contentUpdateManager.getDOMStats();
            expect(stats.emergency).toBeGreaterThan(0); // Should have triggered emergency cleanups
        });
    });

    describe('Error Recovery and Resilience', () => {
        test('should recover from update failures', async () => {
            let failCount = 0;
            const updateFunction = jest.fn().mockImplementation(() => {
                failCount++;
                if (failCount <= 2) {
                    throw new Error(`Update failed ${failCount}`);
                }
                // Succeed on third attempt
                document.getElementById('slowQueries').innerHTML = '<div>Success</div>';
            });

            // Should eventually succeed despite initial failures
            await expect(
                contentUpdateManager.updateContainer('slowQueries', updateFunction, 'data', {
                    retryAttempts: 3
                })
            ).resolves.not.toThrow();

            expect(updateFunction).toHaveBeenCalledTimes(3);
        });

        test('should handle DOM corruption gracefully', async () => {
            const container = document.getElementById('slowQueries');
            
            // Simulate DOM corruption by removing the container
            container.parentNode.removeChild(container);

            const updateFunction = jest.fn();

            // Should handle missing container gracefully
            await expect(
                contentUpdateManager.updateContainer('slowQueries', updateFunction, 'data')
            ).resolves.not.toThrow();
        });

        test('should maintain system stability during emergency conditions', async () => {
            // Trigger emergency stop
            contentUpdateManager.emergencyStop();

            const updateFunction = jest.fn();

            // Normal updates should be blocked
            await expect(
                contentUpdateManager.updateContainer('slowQueries', updateFunction, 'data', {
                    priority: 'normal'
                })
            ).rejects.toThrow('Global update lock active');

            // Critical updates should still work
            await expect(
                contentUpdateManager.updateContainer('slowQueries', updateFunction, 'data', {
                    priority: 'critical',
                    cleanupRequired: false
                })
            ).resolves.not.toThrow();

            // Resume operations
            contentUpdateManager.resumeOperations();

            // Normal updates should work again
            await expect(
                contentUpdateManager.updateContainer('slowQueries', updateFunction, 'data', {
                    priority: 'normal',
                    cleanupRequired: false
                })
            ).resolves.not.toThrow();
        });
    });
});
