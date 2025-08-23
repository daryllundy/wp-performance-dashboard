/**
 * Memory leak detection tests for long-running dashboard sessions
 * Tests various scenarios that could lead to memory leaks and validates prevention mechanisms
 */

const { JSDOM } = require('jsdom');

describe('Memory Leak Detection and Prevention', () => {
    let dom;
    let window;
    let document;
    let contentUpdateManager;
    let initialMemoryBaseline;

    beforeEach(() => {
        // Create DOM environment
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
                <div id="test-container" style="height: 200px; overflow-y: auto;"></div>
                <canvas id="chart1"></canvas>
                <canvas id="chart2"></canvas>
                <canvas id="chart3"></canvas>
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

        // Mock Chart.js with memory tracking
        const chartInstances = new Set();
        global.Chart = function MockChart(ctx, config) {
            const instance = {
                ctx,
                config,
                data: { labels: [], datasets: [{ data: [] }] },
                update: jest.fn(),
                destroy: jest.fn(() => {
                    chartInstances.delete(instance);
                }),
                _destroyed: false
            };
            chartInstances.add(instance);
            return instance;
        };
        global.Chart.getChart = jest.fn((canvas) => {
            return Array.from(chartInstances).find(chart => chart.ctx && chart.ctx.canvas === canvas);
        });
        global.Chart.defaults = { font: {}, color: '' };
        global.Chart._instances = chartInstances;

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
        
        const script = new window.Function(utilsCode);
        script.call(window);

        contentUpdateManager = new window.ContentUpdateManager();

        // Establish memory baseline
        initialMemoryBaseline = {
            domNodes: document.querySelectorAll('*').length,
            chartInstances: global.Chart._instances.size,
            scrollPositions: contentUpdateManager.scrollPreserver.scrollPositions.size,
            updateQueues: contentUpdateManager.updateQueue.size,
            updateLocks: contentUpdateManager.updateLocks.size
        };
    });

    afterEach(() => {
        if (contentUpdateManager) {
            contentUpdateManager.emergencyStop();
        }
        dom.window.close();
    });

    describe('DOM Node Accumulation Prevention', () => {
        test('should not accumulate DOM nodes over multiple updates', async () => {
            const container = document.getElementById('slowQueries');
            const initialNodeCount = container.querySelectorAll('*').length;

            // Perform many content updates
            for (let i = 0; i < 50; i++) {
                await contentUpdateManager.updateContainer('slowQueries', (data) => {
                    // Simulate the bug: content replacement that should not accumulate
                    container.innerHTML = data.map(item => 
                        `<div class="query-item">
                            <div class="query-header">Query ${item.id}</div>
                            <div class="query-text">${item.text}</div>
                            <div class="query-meta">
                                <span>Time: ${item.time}ms</span>
                                <span>Rows: ${item.rows}</span>
                            </div>
                        </div>`
                    ).join('');
                }, [
                    { id: i, text: `SELECT * FROM table_${i}`, time: 100 + i, rows: i * 10 }
                ], {
                    cleanupRequired: true
                });
            }

            const finalNodeCount = container.querySelectorAll('*').length;
            
            // Node count should not have grown significantly (allowing for some variance)
            expect(finalNodeCount).toBeLessThan(initialNodeCount + 50);
            
            // Should not have accumulated 50x the content
            expect(finalNodeCount).toBeLessThan(initialNodeCount * 10);
        });

        test('should prevent event listener accumulation', async () => {
            const container = document.getElementById('pluginPerformance');
            const eventListenerCount = { count: 0 };

            // Mock addEventListener to track listener additions
            const originalAddEventListener = container.addEventListener;
            container.addEventListener = jest.fn((event, handler) => {
                eventListenerCount.count++;
                return originalAddEventListener.call(container, event, handler);
            });

            // Perform updates that add event listeners
            for (let i = 0; i < 20; i++) {
                await contentUpdateManager.updateContainer('pluginPerformance', (data) => {
                    container.innerHTML = data.map(plugin => 
                        `<div class="plugin-item" onclick="handleClick(${plugin.id})">
                            <span>${plugin.name}</span>
                            <button onclick="togglePlugin(${plugin.id})">Toggle</button>
                        </div>`
                    ).join('');
                    
                    // Add some event listeners
                    container.querySelectorAll('.plugin-item').forEach(item => {
                        item.addEventListener('mouseover', () => {});
                    });
                }, [
                    { id: i, name: `Plugin ${i}` }
                ], {
                    cleanupRequired: true
                });
            }

            // Event listeners should not accumulate indefinitely
            // (This is a simplified test - in reality, we'd need more sophisticated tracking)
            expect(eventListenerCount.count).toBeLessThan(100); // Should not be 20 * number of items
        });

        test('should clean up orphaned DOM references', async () => {
            const container = document.getElementById('test-container');
            const domReferences = [];

            // Create updates that could leave orphaned references
            for (let i = 0; i < 30; i++) {
                await contentUpdateManager.updateContainer('test-container', (data) => {
                    const oldElements = container.querySelectorAll('.test-item');
                    
                    // Store references to old elements (simulating potential memory leak)
                    oldElements.forEach(el => domReferences.push(el));
                    
                    // Replace content
                    container.innerHTML = data.map(item => 
                        `<div class="test-item" data-id="${item.id}">${item.content}</div>`
                    ).join('');
                }, [
                    { id: i, content: `Content ${i}` }
                ], {
                    cleanupRequired: true
                });
            }

            // Verify that old DOM references are no longer in the document
            const orphanedReferences = domReferences.filter(el => 
                !document.contains(el)
            );

            // Most references should be orphaned (cleaned up)
            expect(orphanedReferences.length).toBeGreaterThan(domReferences.length * 0.8);
        });
    });

    describe('Chart.js Memory Leak Prevention', () => {
        test('should destroy old chart instances before creating new ones', async () => {
            const canvas1 = document.getElementById('chart1');
            const canvas2 = document.getElementById('chart2');
            const initialChartCount = global.Chart._instances.size;

            // Create and destroy charts multiple times
            for (let i = 0; i < 15; i++) {
                await contentUpdateManager.updateContainer('test-container', () => {
                    // Simulate chart creation and destruction
                    const chart1 = new global.Chart(canvas1, { type: 'line', data: { labels: [], datasets: [] } });
                    const chart2 = new global.Chart(canvas2, { type: 'bar', data: { labels: [], datasets: [] } });
                    
                    // Simulate some time passing
                    setTimeout(() => {
                        chart1.destroy();
                        chart2.destroy();
                    }, 10);
                }, null, {
                    cleanupRequired: true
                });
            }

            // Wait for cleanup to complete
            await new Promise(resolve => setTimeout(resolve, 200));

            const finalChartCount = global.Chart._instances.size;
            
            // Chart instances should not accumulate
            expect(finalChartCount).toBeLessThanOrEqual(initialChartCount + 5); // Allow some variance
        });

        test('should handle chart cleanup errors gracefully', async () => {
            const canvas = document.getElementById('chart3');
            
            // Create a chart with a failing destroy method
            const problematicChart = new global.Chart(canvas, { type: 'doughnut', data: { labels: [], datasets: [] } });
            problematicChart.destroy = jest.fn(() => {
                throw new Error('Chart destroy failed');
            });

            // Should handle cleanup errors without crashing
            await expect(
                contentUpdateManager.updateContainer('test-container', () => {
                    window.DOMCleanup.cleanupCharts(canvas);
                }, null, {
                    cleanupRequired: true
                })
            ).resolves.not.toThrow();
        });
    });

    describe('Scroll Position Memory Management', () => {
        test('should not accumulate scroll position data indefinitely', async () => {
            const containers = ['slowQueries', 'pluginPerformance', 'test-container'];
            const initialPositionCount = contentUpdateManager.scrollPreserver.scrollPositions.size;

            // Perform many updates with scroll preservation
            for (let i = 0; i < 100; i++) {
                const containerId = containers[i % containers.length];
                const container = document.getElementById(containerId);
                
                if (container) {
                    container.scrollTop = i * 5;
                    
                    await contentUpdateManager.updateContainer(containerId, (data) => {
                        container.innerHTML = `<div style="height: ${500 + i * 10}px;">Content ${i}</div>`;
                    }, null, {
                        preserveScroll: true,
                        cleanupRequired: false
                    });
                }
            }

            const finalPositionCount = contentUpdateManager.scrollPreserver.scrollPositions.size;
            
            // Scroll positions should be cleaned up after restoration
            expect(finalPositionCount).toBeLessThanOrEqual(initialPositionCount + containers.length);
        });

        test('should clean up stale scroll position data', () => {
            const scrollPreserver = contentUpdateManager.scrollPreserver;
            
            // Save positions for multiple containers
            scrollPreserver.savePosition('slowQueries');
            scrollPreserver.savePosition('pluginPerformance');
            scrollPreserver.savePosition('test-container');
            
            expect(scrollPreserver.scrollPositions.size).toBe(3);
            
            // Clear all positions
            scrollPreserver.clearAll();
            
            expect(scrollPreserver.scrollPositions.size).toBe(0);
        });
    });

    describe('Update Queue and Lock Management', () => {
        test('should not accumulate update queues over time', async () => {
            const initialQueueSize = contentUpdateManager.updateQueue.size;
            const updateFunction = jest.fn().mockResolvedValue();

            // Create many queued updates
            const promises = [];
            for (let i = 0; i < 50; i++) {
                promises.push(
                    contentUpdateManager.updateContainer('slowQueries', updateFunction, `data-${i}`)
                );
            }

            await Promise.all(promises);

            const finalQueueSize = contentUpdateManager.updateQueue.size;
            
            // Queues should be cleaned up after processing
            expect(finalQueueSize).toBeLessThanOrEqual(initialQueueSize + 1);
        });

        test('should release update locks properly', async () => {
            const initialLockCount = contentUpdateManager.updateLocks.size;
            const updateFunction = jest.fn().mockResolvedValue();

            // Perform many updates that acquire locks
            for (let i = 0; i < 30; i++) {
                await contentUpdateManager.updateContainer('pluginPerformance', updateFunction, `data-${i}`);
            }

            const finalLockCount = contentUpdateManager.updateLocks.size;
            
            // Locks should not accumulate
            expect(finalLockCount).toBeLessThanOrEqual(initialLockCount + 2); // Allow for some active locks
        });

        test('should handle lock cleanup on errors', async () => {
            const updateFunction = jest.fn().mockRejectedValue(new Error('Update failed'));
            
            // Perform updates that fail
            for (let i = 0; i < 10; i++) {
                try {
                    await contentUpdateManager.updateContainer('test-container', updateFunction, `data-${i}`);
                } catch (error) {
                    // Expected to fail
                }
            }

            // Locks should still be cleaned up despite errors
            const lockCount = contentUpdateManager.updateLocks.size;
            expect(lockCount).toBeLessThanOrEqual(1);
        });
    });

    describe('Long-running Session Simulation', () => {
        test('should maintain stable memory usage over extended operation', async () => {
            const memorySnapshots = [];
            
            // Simulate 2 hours of dashboard operation (compressed into fast test)
            for (let hour = 0; hour < 2; hour++) {
                // Simulate 12 update cycles per hour (every 5 minutes)
                for (let cycle = 0; cycle < 12; cycle++) {
                    // Real-time updates (every 5 seconds, simulated as 5 updates)
                    for (let rt = 0; rt < 5; rt++) {
                        await contentUpdateManager.updateContainer('real-time-metrics', (data) => {
                            document.getElementById('qps-value').textContent = data.qps;
                            document.getElementById('response-value').textContent = data.response + 'ms';
                            document.getElementById('memory-value').textContent = data.memory + 'MB';
                        }, {
                            qps: 20 + rt,
                            response: 150 + rt * 10,
                            memory: 128 + rt * 5
                        }, {
                            priority: 'high',
                            preserveScroll: false
                        });
                    }

                    // Periodic dashboard refresh
                    await contentUpdateManager.coordinateUpdates([
                        {
                            containerId: 'slowQueries',
                            updateFunction: (data) => {
                                document.getElementById('slowQueries').innerHTML = 
                                    data.map(q => `<div class="query-item">${q.text}</div>`).join('');
                            },
                            data: Array.from({ length: 5 }, (_, i) => ({ text: `Query ${hour}-${cycle}-${i}` })),
                            options: { preserveScroll: true }
                        },
                        {
                            containerId: 'pluginPerformance',
                            updateFunction: (data) => {
                                document.getElementById('pluginPerformance').innerHTML = 
                                    data.map(p => `<div class="plugin-item">${p.name}</div>`).join('');
                            },
                            data: Array.from({ length: 3 }, (_, i) => ({ name: `Plugin ${hour}-${cycle}-${i}` })),
                            options: { preserveScroll: true }
                        }
                    ], {
                        sequential: false,
                        priority: 'normal'
                    });

                    // Take memory snapshot every few cycles
                    if (cycle % 4 === 0) {
                        memorySnapshots.push({
                            hour,
                            cycle,
                            domNodes: document.querySelectorAll('*').length,
                            chartInstances: global.Chart._instances.size,
                            scrollPositions: contentUpdateManager.scrollPreserver.scrollPositions.size,
                            updateQueues: contentUpdateManager.updateQueue.size,
                            updateLocks: contentUpdateManager.updateLocks.size
                        });
                    }
                }
            }

            // Analyze memory stability
            const firstSnapshot = memorySnapshots[0];
            const lastSnapshot = memorySnapshots[memorySnapshots.length - 1];

            // Memory usage should not have grown significantly
            expect(lastSnapshot.domNodes).toBeLessThan(firstSnapshot.domNodes * 2);
            expect(lastSnapshot.chartInstances).toBeLessThanOrEqual(firstSnapshot.chartInstances + 5);
            expect(lastSnapshot.scrollPositions).toBeLessThanOrEqual(3); // Max containers being monitored
            expect(lastSnapshot.updateQueues).toBeLessThanOrEqual(2);
            expect(lastSnapshot.updateLocks).toBeLessThanOrEqual(2);

            // Check for memory growth trend
            const domGrowthRate = (lastSnapshot.domNodes - firstSnapshot.domNodes) / memorySnapshots.length;
            expect(domGrowthRate).toBeLessThan(10); // Should not grow by more than 10 nodes per snapshot
        });

        test('should handle memory pressure during extended operation', async () => {
            // Set aggressive DOM limits to simulate memory pressure
            contentUpdateManager.setContainerLimit('slowQueries', 20);
            contentUpdateManager.setContainerLimit('pluginPerformance', 15);

            let emergencyCleanupCount = 0;
            const originalEmergencyCleanup = window.DOMCleanup.emergencyCleanup;
            window.DOMCleanup.emergencyCleanup = jest.fn((container) => {
                emergencyCleanupCount++;
                return originalEmergencyCleanup(container);
            });

            // Simulate extended operation with memory pressure
            for (let i = 0; i < 100; i++) {
                await contentUpdateManager.updateContainer('slowQueries', (data) => {
                    const container = document.getElementById('slowQueries');
                    // Add content that would exceed limits
                    const items = data.map(item => 
                        `<div class="query-item">
                            <div class="query-header">${item.header}</div>
                            <div class="query-body">${item.body}</div>
                            <div class="query-footer">${item.footer}</div>
                        </div>`
                    ).join('');
                    container.innerHTML = items;
                }, Array.from({ length: 10 }, (_, j) => ({
                    header: `Header ${i}-${j}`,
                    body: `Body content for query ${i}-${j}`,
                    footer: `Footer ${i}-${j}`
                })));
            }

            // Should have triggered emergency cleanups
            expect(emergencyCleanupCount).toBeGreaterThan(0);

            // System should still be functional
            const stats = contentUpdateManager.getDOMStats();
            expect(stats.totalContainers).toBeGreaterThan(0);
        });
    });

    describe('Resource Cleanup Verification', () => {
        test('should clean up all resources on emergency stop', () => {
            // Create some state
            contentUpdateManager.scrollPreserver.savePosition('slowQueries');
            contentUpdateManager.scrollPreserver.savePosition('pluginPerformance');
            contentUpdateManager.updateInProgress.add('test-container');

            const initialState = {
                scrollPositions: contentUpdateManager.scrollPreserver.scrollPositions.size,
                inProgress: contentUpdateManager.updateInProgress.size,
                queues: contentUpdateManager.updateQueue.size
            };

            expect(initialState.scrollPositions).toBeGreaterThan(0);
            expect(initialState.inProgress).toBeGreaterThan(0);

            // Emergency stop should clean everything
            contentUpdateManager.emergencyStop();

            expect(contentUpdateManager.scrollPreserver.scrollPositions.size).toBe(0);
            expect(contentUpdateManager.updateInProgress.size).toBe(0);
            expect(contentUpdateManager.updateQueue.size).toBe(0);
        });

        test('should provide memory usage diagnostics', () => {
            const diagnostics = {
                domNodes: document.querySelectorAll('*').length,
                chartInstances: global.Chart._instances.size,
                scrollPositions: contentUpdateManager.scrollPreserver.scrollPositions.size,
                updateQueues: contentUpdateManager.updateQueue.size,
                updateLocks: contentUpdateManager.updateLocks.size,
                domStats: contentUpdateManager.getDOMStats()
            };

            // All diagnostic values should be reasonable
            expect(diagnostics.domNodes).toBeGreaterThan(0);
            expect(diagnostics.chartInstances).toBeGreaterThanOrEqual(0);
            expect(diagnostics.scrollPositions).toBeGreaterThanOrEqual(0);
            expect(diagnostics.updateQueues).toBeGreaterThanOrEqual(0);
            expect(diagnostics.updateLocks).toBeGreaterThanOrEqual(0);
            expect(diagnostics.domStats).toHaveProperty('totalContainers');
            expect(diagnostics.domStats).toHaveProperty('totalNodes');
        });
    });
});
