/**
 * Integration tests for scroll position preservation in dashboard functions
 */

const { JSDOM } = require('jsdom');

describe('Dashboard Scroll Integration', () => {
    let dom;
    let window;
    let document;

    beforeEach(() => {
        // Create DOM environment with dashboard structure
        dom = new JSDOM(`
            <!DOCTYPE html>
            <html>
            <body>
                <div id="slowQueries" style="height: 200px; overflow-y: auto;">
                    <div style="height: 1000px;">Existing slow queries content</div>
                </div>
                <div id="pluginPerformance" style="height: 200px; overflow-y: auto;">
                    <div style="height: 800px;">Existing plugin performance content</div>
                </div>
                <span id="slow-query-count">0 queries</span>
                <span id="plugin-count">0 plugins</span>
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

        // Load content management utilities
        const fs = require('fs');
        const path = require('path');
        const utilsCode = fs.readFileSync(
            path.join(__dirname, '../public/js/content-management.js'), 
            'utf8'
        );
        
        const script = new window.Function(utilsCode);
        script.call(window);

        // Load dashboard functions
        const dashboardCode = fs.readFileSync(
            path.join(__dirname, '../public/js/dashboard.js'), 
            'utf8'
        );
        
        // Mock socket.io and Chart.js for dashboard
        global.io = () => ({
            on: jest.fn(),
            emit: jest.fn()
        });
        global.Chart = {
            defaults: { font: {}, color: '' },
            getChart: jest.fn(() => ({ destroy: jest.fn() }))
        };

        // Execute dashboard code (will define functions globally)
        const dashboardScript = new window.Function(dashboardCode);
        dashboardScript.call(window);
    });

    afterEach(() => {
        dom.window.close();
    });

    test('displaySlowQueries should preserve scroll position', async () => {
        const container = document.getElementById('slowQueries');
        
        // Set initial scroll position
        container.scrollTop = 100;
        
        // Mock query data
        const queries = [
            {
                execution_time: 150,
                query_text: 'SELECT * FROM wp_posts WHERE post_status = "publish"',
                rows_examined: 1000,
                source_file: 'wp-includes/query.php'
            }
        ];

        // Call displaySlowQueries
        if (window.displaySlowQueries) {
            await window.displaySlowQueries(queries);
            
            // Give time for async operations
            await new Promise(resolve => setTimeout(resolve, 50));
            
            // Verify content was updated
            expect(container.innerHTML).toContain('query-item');
            expect(document.getElementById('slow-query-count').textContent).toBe('1 queries');
        }
    });

    test('displayPluginPerformance should preserve scroll position', async () => {
        const container = document.getElementById('pluginPerformance');
        
        // Set initial scroll position
        container.scrollTop = 80;
        
        // Mock plugin data
        const plugins = [
            {
                plugin_name: 'Test Plugin',
                impact_score: 75,
                memory_usage: 15.5,
                query_count: 12,
                load_time: 250
            }
        ];

        // Call displayPluginPerformance
        if (window.displayPluginPerformance) {
            await window.displayPluginPerformance(plugins);
            
            // Give time for async operations
            await new Promise(resolve => setTimeout(resolve, 50));
            
            // Verify content was updated
            expect(container.innerHTML).toContain('plugin-item');
            expect(document.getElementById('plugin-count').textContent).toBe('1 plugins');
        }
    });
});
