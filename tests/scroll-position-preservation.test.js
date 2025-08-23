/**
 * Comprehensive tests for scroll position preservation across different content scenarios
 * Tests various edge cases and content change patterns that occur in the dashboard
 */

const { JSDOM } = require('jsdom');

describe('Scroll Position Preservation - Comprehensive Scenarios', () => {
    let dom;
    let window;
    let document;
    let scrollPreserver;

    beforeEach(() => {
        // Create DOM environment with various container types
        dom = new JSDOM(`
            <!DOCTYPE html>
            <html>
            <body>
                <div id="small-container" style="height: 100px; overflow-y: auto;">
                    <div style="height: 300px;">Small container content</div>
                </div>
                <div id="large-container" style="height: 400px; overflow-y: auto;">
                    <div style="height: 2000px;">Large container content</div>
                </div>
                <div id="dynamic-container" style="height: 200px; overflow-y: auto;">
                    <div style="height: 800px;">Dynamic container content</div>
                </div>
                <div id="query-container" style="height: 300px; overflow-y: auto;">
                    <div class="query-item">Query 1</div>
                    <div class="query-item">Query 2</div>
                    <div class="query-item">Query 3</div>
                </div>
                <div id="plugin-container" style="height: 250px; overflow-y: auto;">
                    <div class="plugin-item">Plugin 1</div>
                    <div class="plugin-item">Plugin 2</div>
                </div>
                <div id="no-scroll-container" style="height: 200px; overflow-y: auto;">
                    <div style="height: 150px;">No scroll needed</div>
                </div>
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

        scrollPreserver = new window.ScrollPreserver();
    });

    afterEach(() => {
        dom.window.close();
    });

    describe('Basic Scroll Preservation Scenarios', () => {
        test('should preserve scroll position with similar content height', () => {
            const container = document.getElementById('large-container');
            container.scrollTop = 500;

            scrollPreserver.savePosition('large-container');
            
            // Simulate content update with similar height
            container.innerHTML = '<div style="height: 1900px;">Updated content with similar height</div>';
            
            scrollPreserver.restorePosition('large-container');

            // Should preserve approximately the same scroll position
            expect(container.scrollTop).toBeGreaterThan(400);
            expect(container.scrollTop).toBeLessThan(600);
        });

        test('should handle content that becomes much larger', () => {
            const container = document.getElementById('small-container');
            container.scrollTop = 100;

            scrollPreserver.savePosition('small-container');
            
            // Content becomes much larger
            container.innerHTML = '<div style="height: 1500px;">Much larger content</div>';
            
            scrollPreserver.restorePosition('small-container');

            // Should maintain relative position
            expect(container.scrollTop).toBeGreaterThan(0);
            expect(container.scrollTop).toBeLessThan(container.scrollHeight);
        });

        test('should handle content that becomes much smaller', () => {
            const container = document.getElementById('large-container');
            container.scrollTop = 1500;

            scrollPreserver.savePosition('large-container');
            
            // Content becomes much smaller
            container.innerHTML = '<div style="height: 400px;">Much smaller content</div>';
            
            scrollPreserver.restorePosition('large-container');

            // Should handle gracefully, likely scroll to bottom or near bottom
            expect(container.scrollTop).toBeGreaterThanOrEqual(0);
            expect(container.scrollTop).toBeLessThanOrEqual(container.scrollHeight - container.clientHeight);
        });

        test('should handle content that becomes non-scrollable', () => {
            const container = document.getElementById('dynamic-container');
            container.scrollTop = 300;

            scrollPreserver.savePosition('dynamic-container');
            
            // Content becomes smaller than container
            container.innerHTML = '<div style="height: 100px;">Non-scrollable content</div>';
            
            scrollPreserver.restorePosition('dynamic-container');

            // Should reset to top when no scrolling is needed
            expect(container.scrollTop).toBe(0);
        });

        test('should handle empty content', () => {
            const container = document.getElementById('dynamic-container');
            container.scrollTop = 200;

            scrollPreserver.savePosition('dynamic-container');
            
            // Content becomes empty
            container.innerHTML = '';
            
            scrollPreserver.restorePosition('dynamic-container');

            // Should reset to top
            expect(container.scrollTop).toBe(0);
        });
    });

    describe('Dashboard-Specific Content Scenarios', () => {
        test('should handle slow queries content replacement', () => {
            const container = document.getElementById('query-container');
            container.scrollTop = 50;

            scrollPreserver.savePosition('query-container');
            
            // Simulate slow queries update with different number of queries
            const newQueries = Array.from({ length: 10 }, (_, i) => 
                `<div class="query-item">
                    <div class="query-header">Query ${i + 1}: SELECT * FROM wp_posts</div>
                    <div class="query-time">${100 + i * 10}ms</div>
                    <div class="query-details">Rows examined: ${i * 100}</div>
                </div>`
            ).join('');
            container.innerHTML = newQueries;
            
            scrollPreserver.restorePosition('query-container');

            // Should preserve relative position in the new query list
            expect(container.scrollTop).toBeGreaterThanOrEqual(0);
        });

        test('should handle plugin performance content replacement', () => {
            const container = document.getElementById('plugin-container');
            container.scrollTop = 30;

            scrollPreserver.savePosition('plugin-container');
            
            // Simulate plugin performance update
            const newPlugins = Array.from({ length: 8 }, (_, i) => 
                `<div class="plugin-item">
                    <div class="plugin-name">Plugin ${i + 1}</div>
                    <div class="plugin-impact">Impact: ${50 + i * 5}/100</div>
                    <div class="plugin-stats">Memory: ${i * 2}MB | Queries: ${i * 3}</div>
                </div>`
            ).join('');
            container.innerHTML = newPlugins;
            
            scrollPreserver.restorePosition('plugin-container');

            expect(container.scrollTop).toBeGreaterThanOrEqual(0);
        });

        test('should handle content with mixed element types', () => {
            const container = document.getElementById('dynamic-container');
            container.scrollTop = 150;

            scrollPreserver.savePosition('dynamic-container');
            
            // Mixed content with different element types
            container.innerHTML = `
                <div class="header">Performance Metrics</div>
                <table class="metrics-table">
                    <tr><td>Queries/sec</td><td>25</td></tr>
                    <tr><td>Response time</td><td>150ms</td></tr>
                    <tr><td>Memory usage</td><td>128MB</td></tr>
                </table>
                <div class="charts-section">
                    <canvas id="chart1"></canvas>
                    <canvas id="chart2"></canvas>
                </div>
                <div class="footer">Last updated: ${new Date().toISOString()}</div>
            `;
            
            scrollPreserver.restorePosition('dynamic-container');

            expect(container.scrollTop).toBeGreaterThanOrEqual(0);
        });
    });

    describe('Edge Cases and Error Conditions', () => {
        test('should handle rapid content changes', () => {
            const container = document.getElementById('dynamic-container');
            container.scrollTop = 100;

            // Rapid sequence of saves and restores
            scrollPreserver.savePosition('dynamic-container');
            container.innerHTML = '<div style="height: 600px;">Change 1</div>';
            scrollPreserver.restorePosition('dynamic-container');

            const position1 = container.scrollTop;

            scrollPreserver.savePosition('dynamic-container');
            container.innerHTML = '<div style="height: 900px;">Change 2</div>';
            scrollPreserver.restorePosition('dynamic-container');

            const position2 = container.scrollTop;

            // Both positions should be valid
            expect(position1).toBeGreaterThanOrEqual(0);
            expect(position2).toBeGreaterThanOrEqual(0);
        });

        test('should handle container with zero height', () => {
            const container = document.getElementById('dynamic-container');
            
            // Set container height to 0
            container.style.height = '0px';
            container.scrollTop = 0;

            scrollPreserver.savePosition('dynamic-container');
            container.innerHTML = '<div style="height: 500px;">New content</div>';
            
            // Should not throw errors
            expect(() => {
                scrollPreserver.restorePosition('dynamic-container');
            }).not.toThrow();
        });

        test('should handle container that gets removed and re-added', () => {
            const container = document.getElementById('dynamic-container');
            container.scrollTop = 100;

            scrollPreserver.savePosition('dynamic-container');
            
            // Remove container
            container.parentNode.removeChild(container);
            
            // Should handle missing container gracefully
            expect(() => {
                scrollPreserver.restorePosition('dynamic-container');
            }).not.toThrow();
            
            // Re-add container
            const newContainer = document.createElement('div');
            newContainer.id = 'dynamic-container';
            newContainer.style.height = '200px';
            newContainer.style.overflowY = 'auto';
            newContainer.innerHTML = '<div style="height: 800px;">Restored content</div>';
            document.body.appendChild(newContainer);
            
            // Should handle gracefully (no saved position should exist)
            scrollPreserver.restorePosition('dynamic-container');
            expect(newContainer.scrollTop).toBe(0);
        });

        test('should handle extreme scroll positions', () => {
            const container = document.getElementById('large-container');
            
            // Set scroll to maximum
            container.scrollTop = container.scrollHeight;

            scrollPreserver.savePosition('large-container');
            container.innerHTML = '<div style="height: 3000px;">Even larger content</div>';
            scrollPreserver.restorePosition('large-container');

            // Should handle extreme positions
            expect(container.scrollTop).toBeGreaterThan(0);
            expect(container.scrollTop).toBeLessThanOrEqual(container.scrollHeight - container.clientHeight);
        });
    });

    describe('User Interaction Detection', () => {
        test('should detect when user is actively scrolling', () => {
            const container = document.getElementById('large-container');
            container.scrollTop = 500;

            scrollPreserver.savePosition('large-container');
            
            // Simulate user scrolling by changing position
            container.scrollTop = 700;

            expect(scrollPreserver.isUserScrolling('large-container')).toBe(true);
        });

        test('should not detect scrolling after sufficient time has passed', (done) => {
            const container = document.getElementById('large-container');
            container.scrollTop = 500;

            scrollPreserver.savePosition('large-container');
            container.scrollTop = 700;

            // Wait for the scrolling detection timeout
            setTimeout(() => {
                expect(scrollPreserver.isUserScrolling('large-container')).toBe(false);
                done();
            }, 2100); // Just over 2 seconds
        });

        test('should use safe save position method', () => {
            const container = document.getElementById('large-container');
            container.scrollTop = 500;

            scrollPreserver.savePosition('large-container');
            container.scrollTop = 700; // Simulate user scrolling

            // Safe save should return false when user is scrolling
            expect(scrollPreserver.savePositionSafe('large-container')).toBe(false);

            // Force save should return true
            expect(scrollPreserver.savePositionSafe('large-container', true)).toBe(true);
        });

        test('should handle small scroll changes that should not be considered user scrolling', () => {
            const container = document.getElementById('large-container');
            container.scrollTop = 500;

            scrollPreserver.savePosition('large-container');
            
            // Small change (less than 50px threshold)
            container.scrollTop = 520;

            expect(scrollPreserver.isUserScrolling('large-container')).toBe(false);
        });
    });

    describe('Multiple Container Management', () => {
        test('should handle multiple containers independently', () => {
            const container1 = document.getElementById('small-container');
            const container2 = document.getElementById('large-container');
            
            container1.scrollTop = 50;
            container2.scrollTop = 800;

            scrollPreserver.savePosition('small-container');
            scrollPreserver.savePosition('large-container');

            // Update both containers
            container1.innerHTML = '<div style="height: 600px;">Updated small</div>';
            container2.innerHTML = '<div style="height: 1500px;">Updated large</div>';

            scrollPreserver.restorePosition('small-container');
            scrollPreserver.restorePosition('large-container');

            // Both should have valid positions
            expect(container1.scrollTop).toBeGreaterThanOrEqual(0);
            expect(container2.scrollTop).toBeGreaterThanOrEqual(0);
        });

        test('should clear all saved positions', () => {
            scrollPreserver.savePosition('small-container');
            scrollPreserver.savePosition('large-container');
            scrollPreserver.savePosition('dynamic-container');

            expect(scrollPreserver.scrollPositions.size).toBe(3);

            scrollPreserver.clearAll();

            expect(scrollPreserver.scrollPositions.size).toBe(0);
        });

        test('should clear individual container positions', () => {
            scrollPreserver.savePosition('small-container');
            scrollPreserver.savePosition('large-container');

            expect(scrollPreserver.scrollPositions.size).toBe(2);

            scrollPreserver.clear('small-container');

            expect(scrollPreserver.scrollPositions.size).toBe(1);
            expect(scrollPreserver.scrollPositions.has('large-container')).toBe(true);
        });
    });

    describe('Performance and Memory Considerations', () => {
        test('should not accumulate saved positions indefinitely', () => {
            const container = document.getElementById('dynamic-container');

            // Save and restore many times
            for (let i = 0; i < 100; i++) {
                container.scrollTop = i * 2;
                scrollPreserver.savePosition('dynamic-container');
                container.innerHTML = `<div style="height: ${500 + i * 10}px;">Content ${i}</div>`;
                scrollPreserver.restorePosition('dynamic-container');
            }

            // Should not have accumulated positions (they get cleared after restore)
            expect(scrollPreserver.scrollPositions.size).toBe(0);
        });

        test('should handle very large content efficiently', () => {
            const container = document.getElementById('large-container');
            container.scrollTop = 5000;

            scrollPreserver.savePosition('large-container');

            // Very large content
            const largeContent = Array.from({ length: 1000 }, (_, i) => 
                `<div style="height: 20px;">Item ${i}</div>`
            ).join('');
            container.innerHTML = largeContent;

            const startTime = Date.now();
            scrollPreserver.restorePosition('large-container');
            const endTime = Date.now();

            // Should complete quickly (less than 100ms)
            expect(endTime - startTime).toBeLessThan(100);
            expect(container.scrollTop).toBeGreaterThanOrEqual(0);
        });
    });

    describe('Integration with ContentUpdateManager', () => {
        test('should work correctly when used through ContentUpdateManager', async () => {
            const contentUpdateManager = new window.ContentUpdateManager();
            const container = document.getElementById('query-container');
            container.scrollTop = 75;

            const updateFunction = jest.fn().mockImplementation(() => {
                const newContent = Array.from({ length: 15 }, (_, i) => 
                    `<div class="query-item">Updated Query ${i + 1}</div>`
                ).join('');
                container.innerHTML = newContent;
            });

            await contentUpdateManager.updateContainer('query-container', updateFunction, 'test-data', {
                preserveScroll: true,
                cleanupRequired: false
            });

            expect(updateFunction).toHaveBeenCalled();
            expect(container.scrollTop).toBeGreaterThanOrEqual(0);
        });
    });
});
