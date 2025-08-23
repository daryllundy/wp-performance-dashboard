/**
 * Integration tests for DOM Size Monitoring and Cleanup
 * Tests the complete workflow of monitoring, warning, and cleanup
 */

const { JSDOM } = require('jsdom');

describe('DOM Size Monitoring Integration', () => {
    let dom, window, document;

    beforeEach(() => {
        // Create a realistic DOM environment
        dom = new JSDOM(`
            <!DOCTYPE html>
            <html>
            <body>
                <div id="slowQueries" style="height: 300px; overflow-y: auto;"></div>
                <div id="pluginPerformance" style="height: 300px; overflow-y: auto;"></div>
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
        global.NodeFilter = window.NodeFilter;
        global.Node = window.Node;

        // Mock Chart.js
        global.Chart = {
            getChart: jest.fn(() => null)
        };

        // Load the content management utilities
        const fs = require('fs');
        const path = require('path');
        const utilsCode = fs.readFileSync(
            path.join(__dirname, '../public/js/content-management.js'), 
            'utf8'
        );
        
        const script = new window.Function(utilsCode);
        script.call(window);
    });

    afterEach(() => {
        // Clean up any running monitors
        if (window.contentUpdateManager) {
            window.contentUpdateManager.emergencyStop();
        }
        dom.window.close();
    });

    test('should detect DOM size growth and trigger warnings', () => {
        const monitor = new window.DOMSizeMonitor();
        const container = document.getElementById('slowQueries');
        
        // Set a low limit for testing
        monitor.setContainerLimit('slowQueries', 10);
        
        // Simulate content accumulation (the bug we're fixing)
        for (let i = 0; i < 15; i++) {
            const queryItem = document.createElement('div');
            queryItem.className = 'query-item';
            queryItem.innerHTML = `
                <div class="query-header">
                    <strong>Query ${i}:</strong>
                    <span class="query-time">${100 + i}ms</span>
                </div>
                <div class="query-text">SELECT * FROM wp_posts WHERE post_status = 'publish' LIMIT ${i}</div>
                <div class="query-meta">
                    <span>📊 ${i * 10} rows</span> |
                    <span>📁 wp-includes/query.php</span>
                </div>
            `;
            container.appendChild(queryItem);
        }
        
        const result = monitor.monitorContainer('slowQueries');
        
        expect(['critical', 'emergency']).toContain(result.status);
        expect(result.nodeCount).toBeGreaterThan(10);
        expect(result.percentage).toBeGreaterThan(100);
    });

    test('should perform emergency cleanup when container grows too large', () => {
        const container = document.getElementById('pluginPerformance');
        
        // Set very low limit to trigger emergency cleanup
        window.contentUpdateManager.setContainerLimit('pluginPerformance', 5);
        
        // Simulate massive content accumulation
        for (let i = 0; i < 50; i++) {
            const pluginItem = document.createElement('div');
            pluginItem.className = 'plugin-item';
            pluginItem.innerHTML = `
                <div class="plugin-main">
                    <strong>Plugin ${i}</strong>
                    <span class="plugin-impact" style="color: #f85149">${70 + i}/100</span>
                </div>
                <div class="plugin-stats">
                    <span>💾 ${i * 2}MB</span>
                    <span>🔍 ${i * 5} queries</span>
                    <span>⚡ ${i * 10}ms</span>
                </div>
            `;
            container.appendChild(pluginItem);
        }
        
        const initialNodeCount = container.querySelectorAll('*').length;
        expect(initialNodeCount).toBeGreaterThan(5);
        
        // Trigger monitoring which should detect emergency state
        const results = window.contentUpdateManager.checkAllContainers();
        const pluginResult = results.find(r => r.containerId === 'pluginPerformance');
        
        expect(pluginResult.status).toBe('emergency');
    });

    test('should integrate with ContentUpdateManager for safe updates', async () => {
        const container = document.getElementById('slowQueries');
        
        // Set reasonable limit
        window.contentUpdateManager.setContainerLimit('slowQueries', 100);
        
        // Simulate a normal update that should work fine
        const updateFunction = (queries) => {
            container.innerHTML = queries.map(query => `
                <div class="query-item">
                    <div class="query-header">
                        <strong>Query:</strong>
                        <span class="query-time">${query.time}ms</span>
                    </div>
                    <div class="query-text">${query.sql}</div>
                </div>
            `).join('');
        };
        
        const testQueries = [
            { time: 150, sql: 'SELECT * FROM wp_posts WHERE post_status = "publish"' },
            { time: 200, sql: 'SELECT * FROM wp_options WHERE option_name = "active_plugins"' },
            { time: 300, sql: 'SELECT * FROM wp_users WHERE user_login = "admin"' }
        ];
        
        await window.contentUpdateManager.updateContainer('slowQueries', updateFunction, testQueries);
        
        expect(container.innerHTML).toContain('Query:');
        expect(container.querySelectorAll('.query-item')).toHaveLength(3);
    });

    test('should prevent updates when container is in critical state', async () => {
        const container = document.getElementById('pluginPerformance');
        
        // Set very low limit
        window.contentUpdateManager.setContainerLimit('pluginPerformance', 3);
        
        // Pre-populate with content that exceeds limit
        for (let i = 0; i < 20; i++) {
            const div = document.createElement('div');
            div.textContent = `Item ${i}`;
            container.appendChild(div);
        }
        
        const updateFunction = jest.fn((plugins) => {
            container.innerHTML = plugins.map(p => `<div>${p.name}</div>`).join('');
        });
        
        const testPlugins = [{ name: 'Test Plugin' }];
        
        // This should trigger cleanup instead of normal update
        await window.contentUpdateManager.updateContainer('pluginPerformance', updateFunction, testPlugins);
        
        // The update function might not be called if emergency cleanup was triggered
        // Instead, check that the container was cleaned up
        expect(container.innerHTML).toContain('Emergency Cleanup Performed');
    });

    test('should provide comprehensive monitoring statistics', () => {
        // Add content to both containers
        const slowQueries = document.getElementById('slowQueries');
        const pluginPerformance = document.getElementById('pluginPerformance');
        
        slowQueries.innerHTML = '<div>Query 1</div><div>Query 2</div>';
        pluginPerformance.innerHTML = '<div>Plugin 1</div>';
        
        const stats = window.contentUpdateManager.getDOMStats();
        
        expect(stats).toHaveProperty('totalContainers');
        expect(stats).toHaveProperty('normal');
        expect(stats).toHaveProperty('warning');
        expect(stats).toHaveProperty('critical');
        expect(stats).toHaveProperty('emergency');
        expect(stats).toHaveProperty('totalNodes');
        expect(stats).toHaveProperty('containers');
        
        expect(stats.totalContainers).toBe(2);
        expect(Array.isArray(stats.containers)).toBe(true);
        expect(stats.totalNodes).toBeGreaterThan(0);
    });

    test('should handle thorough cleanup of accumulated content', () => {
        const container = document.getElementById('slowQueries');
        
        // Simulate the exact bug: accumulated query items
        for (let i = 0; i < 100; i++) {
            const queryItem = document.createElement('div');
            queryItem.className = 'query-item';
            queryItem.innerHTML = `<div>Accumulated Query ${i}</div>`;
            container.appendChild(queryItem);
        }
        
        const initialCount = container.querySelectorAll('.query-item').length;
        expect(initialCount).toBe(100);
        
        // Perform thorough cleanup
        window.DOMCleanup.thoroughCleanup(container, 50);
        
        const finalCount = container.querySelectorAll('.query-item').length;
        expect(finalCount).toBeLessThan(initialCount);
        expect(finalCount).toBeLessThanOrEqual(5); // Should keep only first few items
    });
});
