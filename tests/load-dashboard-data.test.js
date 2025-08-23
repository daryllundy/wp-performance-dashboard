/**
 * Tests for enhanced loadDashboardData function with coordination, error handling, and rollback
 */

// Mock DOM environment
const { JSDOM } = require('jsdom');
const dom = new JSDOM(`
<!DOCTYPE html>
<html>
<head><title>Test</title></head>
<body>
    <div id="slowQueries"></div>
    <div id="pluginPerformance"></div>
    <div id="slow-query-count"></div>
    <div id="plugin-count"></div>
    <canvas id="performanceChart"></canvas>
    <canvas id="adminAjaxChart"></canvas>
    <canvas id="qpsGauge"></canvas>
    <canvas id="responseGauge"></canvas>
    <canvas id="memoryGauge"></canvas>
    <div id="health-slow-queries"></div>
    <div id="health-avg-response"></div>
    <div id="health-active-plugins"></div>
    <div id="health-status"></div>
    <div id="qps-value"></div>
    <div id="response-value"></div>
    <div id="memory-value"></div>
</body>
</html>
`, { url: 'http://localhost' });

global.window = dom.window;
global.document = dom.window.document;
global.HTMLElement = dom.window.HTMLElement;
global.Node = dom.window.Node;
global.NodeFilter = dom.window.NodeFilter;
global.requestAnimationFrame = (callback) => setTimeout(callback, 16);

// Mock Chart.js constructor and methods
function MockChart() {
    return {
        data: { labels: [], datasets: [{ data: [] }] },
        update: jest.fn(),
        destroy: jest.fn()
    };
}
MockChart.defaults = {
    font: { family: '', size: 12 },
    color: '#8b949e'
};
MockChart.getChart = jest.fn(() => ({ destroy: jest.fn() }));

global.Chart = MockChart;

// Mock canvas getContext
dom.window.HTMLCanvasElement.prototype.getContext = jest.fn(() => ({
    fillRect: jest.fn(),
    clearRect: jest.fn(),
    getImageData: jest.fn(),
    putImageData: jest.fn(),
    createImageData: jest.fn(),
    setTransform: jest.fn(),
    drawImage: jest.fn(),
    save: jest.fn(),
    fillText: jest.fn(),
    restore: jest.fn(),
    beginPath: jest.fn(),
    moveTo: jest.fn(),
    lineTo: jest.fn(),
    closePath: jest.fn(),
    stroke: jest.fn(),
    translate: jest.fn(),
    scale: jest.fn(),
    rotate: jest.fn(),
    arc: jest.fn(),
    fill: jest.fn(),
    measureText: jest.fn(() => ({ width: 0 })),
    transform: jest.fn(),
    rect: jest.fn(),
    clip: jest.fn(),
}));

// Mock Socket.IO
global.io = jest.fn(() => ({
    on: jest.fn(),
    emit: jest.fn(),
    disconnect: jest.fn()
}));

// Mock fetch
global.fetch = jest.fn();

// Mock console methods to reduce noise
global.console.debug = jest.fn();
global.console.log = jest.fn();
global.console.warn = jest.fn();

// Mock setTimeout to prevent hanging
const originalSetTimeout = global.setTimeout;
global.setTimeout = jest.fn((callback, delay) => {
    if (delay === 5000) {
        // Don't execute the DOM monitoring startup timeout in tests
        return 'mocked-timeout';
    }
    return originalSetTimeout(callback, delay);
});

// Load the content management utilities first
require('../public/js/content-management.js');

// Mock the chart initialization functions to prevent errors
global.initCharts = jest.fn();
global.initPerformanceChart = jest.fn();
global.initAdminAjaxChart = jest.fn();
global.initGauges = jest.fn();

// Prevent DOMContentLoaded from firing during require
const originalAddEventListener = dom.window.document.addEventListener;
dom.window.document.addEventListener = jest.fn();

// Load dashboard.js
require('../public/js/dashboard.js');

// Restore addEventListener
dom.window.document.addEventListener = originalAddEventListener;

describe('Enhanced loadDashboardData Function', () => {
    let mockContentUpdateManager;

    beforeEach(() => {
        // Reset DOM elements
        const slowQueries = document.getElementById('slowQueries');
        const pluginPerformance = document.getElementById('pluginPerformance');
        const slowQueryCount = document.getElementById('slow-query-count');
        const pluginCount = document.getElementById('plugin-count');
        
        if (slowQueries) slowQueries.innerHTML = '';
        if (pluginPerformance) pluginPerformance.innerHTML = '';
        if (slowQueryCount) slowQueryCount.textContent = '';
        if (pluginCount) pluginCount.textContent = '';

        // Reset fetch mock
        global.fetch.mockClear();
        
        // Mock successful API responses
        const mockResponses = {
            '/api/metrics': [
                { timestamp: '2024-01-01T00:00:00Z', avg_response_time: 150, queries_per_second: 25, memory_usage: 128 }
            ],
            '/api/slow-queries': [
                { execution_time: 250, query_text: 'SELECT * FROM wp_posts WHERE post_status = "publish"', rows_examined: 1000, source_file: 'wp-includes/query.php' }
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

        global.fetch.mockImplementation((url) => {
            const data = mockResponses[url] || {};
            return Promise.resolve({
                ok: true,
                json: () => Promise.resolve(data)
            });
        });

        // Ensure ContentUpdateManager is available
        mockContentUpdateManager = global.window.contentUpdateManager;
        
        // Mock chart functions to prevent errors
        global.updatePerformanceChart = jest.fn();
        global.updateAdminAjaxChart = jest.fn();
        global.updateSystemHealth = jest.fn();
        
        // Mock other dashboard functions
        global.displaySlowQueries = jest.fn();
        global.displayPluginPerformance = jest.fn();
        global.showError = jest.fn();
        global.clearErrorState = jest.fn();
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    test('should successfully load dashboard data with ContentUpdateManager', async () => {
        // Mock ContentUpdateManager methods
        if (mockContentUpdateManager) {
            mockContentUpdateManager.coordinateUpdates = jest.fn().mockResolvedValue();
        }
        
        // Call loadDashboardData
        await global.loadDashboardData();

        // Verify API calls were made
        expect(global.fetch).toHaveBeenCalledWith('/api/metrics', expect.any(Object));
        expect(global.fetch).toHaveBeenCalledWith('/api/slow-queries', expect.any(Object));
        expect(global.fetch).toHaveBeenCalledWith('/api/admin-ajax', expect.any(Object));
        expect(global.fetch).toHaveBeenCalledWith('/api/plugins', expect.any(Object));
        expect(global.fetch).toHaveBeenCalledWith('/api/system-health', expect.any(Object));

        // Verify ContentUpdateManager was used for coordination if available
        if (mockContentUpdateManager && mockContentUpdateManager.coordinateUpdates) {
            expect(mockContentUpdateManager.coordinateUpdates).toHaveBeenCalled();
        }

        // Verify chart update functions were called
        expect(global.updatePerformanceChart).toHaveBeenCalled();
        expect(global.updateAdminAjaxChart).toHaveBeenCalled();
        expect(global.updateSystemHealth).toHaveBeenCalled();
    });

    test('should handle API fetch failures with retry logic', async () => {
        // Mock fetch to fail initially then succeed
        let callCount = 0;
        global.fetch.mockImplementation((url) => {
            callCount++;
            if (callCount <= 2) {
                return Promise.reject(new Error('Network error'));
            }
            return Promise.resolve({
                ok: true,
                json: () => Promise.resolve([])
            });
        });

        // Should handle errors gracefully without throwing
        await expect(global.loadDashboardData()).resolves.not.toThrow();
        
        // Should have attempted multiple calls
        expect(global.fetch).toHaveBeenCalledTimes(15); // 5 endpoints × 3 attempts each
    });

    test('should perform fallback updates when ContentUpdateManager is not available', async () => {
        // Temporarily remove ContentUpdateManager
        const originalManager = global.window.contentUpdateManager;
        global.window.contentUpdateManager = null;

        await global.loadDashboardData();

        // Verify fallback functions were called
        expect(global.displaySlowQueries).toHaveBeenCalledWith(expect.any(Array));
        expect(global.displayPluginPerformance).toHaveBeenCalledWith(expect.any(Array));

        // Restore ContentUpdateManager
        global.window.contentUpdateManager = originalManager;
    });

    test('should handle coordination failures gracefully', async () => {
        // Mock coordinateUpdates to fail
        if (mockContentUpdateManager) {
            mockContentUpdateManager.coordinateUpdates = jest.fn().mockRejectedValue(new Error('Coordination failed'));
            mockContentUpdateManager.updateContainer = jest.fn().mockResolvedValue();
        }

        await global.loadDashboardData();

        // Should handle errors gracefully
        expect(global.showError).not.toHaveBeenCalled();
    });

    test('should handle malformed API responses', async () => {
        // Mock fetch to return invalid JSON
        global.fetch.mockImplementation(() => 
            Promise.resolve({
                ok: true,
                json: () => Promise.reject(new Error('Invalid JSON'))
            })
        );

        // Should handle the error gracefully
        await expect(global.loadDashboardData()).resolves.not.toThrow();
    });

    test('should handle HTTP error responses', async () => {
        // Mock fetch to return HTTP error
        global.fetch.mockImplementation(() => 
            Promise.resolve({
                ok: false,
                status: 500,
                statusText: 'Internal Server Error'
            })
        );

        // Should handle the error gracefully
        await expect(global.loadDashboardData()).resolves.not.toThrow();
    });

    test('should call chart update functions when data is available', async () => {
        await global.loadDashboardData();

        // Verify chart update functions were called with data
        expect(global.updatePerformanceChart).toHaveBeenCalledWith(expect.any(Array));
        expect(global.updateAdminAjaxChart).toHaveBeenCalledWith(expect.any(Array));
        expect(global.updateSystemHealth).toHaveBeenCalledWith(expect.any(Object));
    });

    test('should handle fetch timeout gracefully', async () => {
        // Mock fetch to timeout
        global.fetch.mockImplementation(() => 
            new Promise((resolve, reject) => {
                setTimeout(() => reject(new Error('Timeout')), 100);
            })
        );

        // Should handle timeout gracefully
        await expect(global.loadDashboardData()).resolves.not.toThrow();
    });

    test('should validate API response structure', async () => {
        // Mock fetch to return unexpected data structure
        global.fetch.mockImplementation((url) => {
            let data;
            if (url.includes('metrics')) {
                data = 'invalid-metrics-data'; // Should be array
            } else if (url.includes('system-health')) {
                data = []; // Should be object
            } else {
                data = null; // Should be array
            }
            
            return Promise.resolve({
                ok: true,
                json: () => Promise.resolve(data)
            });
        });

        // Should handle invalid data structures gracefully
        await expect(global.loadDashboardData()).resolves.not.toThrow();
    });
});
