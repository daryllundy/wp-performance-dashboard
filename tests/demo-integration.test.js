const request = require('supertest');
const express = require('express');
const mysql = require('mysql2/promise');

// Mock the server setup for testing
jest.mock('mysql2/promise');
jest.mock('child_process');

describe('Demo Environment Integration', () => {
    let app;
    let mockPool;

    beforeEach(() => {
        // Reset modules and mocks
        jest.resetModules();
        jest.clearAllMocks();

        // Mock mysql pool
        mockPool = {
            execute: jest.fn()
        };
        mysql.createPool = jest.fn().mockReturnValue(mockPool);

        // Mock child_process
        const mockSpawn = require('child_process').spawn;
        mockSpawn.mockReturnValue({
            stdout: { on: jest.fn() },
            on: jest.fn((event, callback) => {
                if (event === 'close') {
                    setTimeout(() => callback(0), 100);
                }
            }),
            kill: jest.fn()
        });

        // Set up test environment
        process.env.DEMO_MODE = 'true';
        
        // Create express app for testing
        app = express();
        app.use(express.json());
        
        // Import and set up routes (simplified version)
        setupTestRoutes(app);
    });

    afterEach(() => {
        delete process.env.DEMO_MODE;
    });

    describe('Demo Status Endpoint', () => {
        test('should return demo status when demo mode is enabled', async () => {
            // Mock successful database connection
            mockPool.execute
                .mockResolvedValueOnce([[{ test: 1 }]]) // Connection test
                .mockResolvedValueOnce([[{ count: 50 }]]); // Demo data count

            const response = await request(app)
                .get('/api/demo-status')
                .expect(200);

            expect(response.body).toMatchObject({
                available: true,
                mode: 'active',
                services: expect.objectContaining({
                    mysql: true
                }),
                demoDataCount: 50
            });
        });

        test('should handle database connection errors gracefully', async () => {
            // Mock database connection failure
            mockPool.execute.mockRejectedValue(new Error('Connection failed'));

            const response = await request(app)
                .get('/api/demo-status')
                .expect(200);

            expect(response.body).toMatchObject({
                available: false,
                mode: 'active',
                connection: expect.stringContaining('mysql_error')
            });
        });
    });

    describe('Demo Data Refresh Endpoint', () => {
        test('should trigger demo data refresh successfully', async () => {
            const response = await request(app)
                .post('/api/demo-refresh')
                .expect(200);

            expect(response.body).toMatchObject({
                success: true,
                message: 'Demo data refreshed successfully'
            });
        });

        test('should handle refresh timeout', async () => {
            // Mock spawn to simulate timeout
            const mockSpawn = require('child_process').spawn;
            const mockProcess = {
                stdout: { on: jest.fn() },
                on: jest.fn(), // Don't call callback to simulate hanging process
                kill: jest.fn()
            };
            mockSpawn.mockReturnValue(mockProcess);

            // Make request but expect timeout
            const response = await request(app)
                .post('/api/demo-refresh')
                .timeout(1000);

            // Should get timeout response
            expect([408, 500]).toContain(response.status);
        }, 10000);
    });

    describe('API Endpoints with Demo Mode', () => {
        test('should use demo database when demo parameter is provided', async () => {
            // Mock demo database query
            mockPool.execute.mockResolvedValue([[
                { 
                    queries_per_second: 15,
                    avg_response_time: 250,
                    memory_usage: 128,
                    timestamp: new Date()
                }
            ]]);

            const response = await request(app)
                .get('/api/metrics?demo=true')
                .expect(200);

            expect(response.body).toHaveLength(1);
            expect(response.body[0]).toMatchObject({
                queries_per_second: 15,
                avg_response_time: 250,
                memory_usage: 128
            });
        });

        test('should include demo_mode flag in system health response', async () => {
            // Mock system health queries
            mockPool.execute
                .mockResolvedValueOnce([[{ total: 5 }]]) // slow queries
                .mockResolvedValueOnce([[{ total: 8 }]]) // active plugins
                .mockResolvedValueOnce([[{ avg: 180 }]]); // avg response time

            const response = await request(app)
                .get('/api/system-health?demo=true')
                .expect(200);

            expect(response.body).toMatchObject({
                slow_queries_1h: 5,
                active_plugins: 8,
                avg_response_time: 180,
                status: 'healthy',
                demo_mode: true
            });
        });
    });

    describe('Health Check with Demo Info', () => {
        test('should include demo information in health check', async () => {
            const response = await request(app)
                .get('/health')
                .expect(200);

            expect(response.body).toMatchObject({
                status: 'healthy',
                demoMode: true,
                demoAvailable: true
            });
        });
    });
});

// Simplified route setup for testing
function setupTestRoutes(app) {
    // Helper function to get appropriate database pool
    function getDbPool(req) {
        const useDemo = req.query.demo === 'true' || process.env.DEMO_MODE === 'true';
        return useDemo ? mockPool : mockPool; // In tests, both point to same mock
    }

    // Demo status endpoint
    app.get('/api/demo-status', async (req, res) => {
        try {
            const status = {
                available: false,
                services: { mysql: false, wordpress: false, nginx: false },
                mode: process.env.DEMO_MODE === 'true' ? 'active' : 'detection',
                connection: null,
                lastCheck: new Date().toISOString()
            };

            try {
                const [rows] = await mockPool.execute('SELECT 1 as test');
                status.services.mysql = true;
                status.connection = 'mysql_connected';
                
                const [demoData] = await mockPool.execute('SELECT COUNT(*) as count FROM wp_posts WHERE post_status = "publish"');
                status.demoDataCount = demoData[0].count;
                status.available = true;
            } catch (dbError) {
                status.connection = `mysql_error: ${dbError.message}`;
            }

            res.json(status);
        } catch (error) {
            res.status(500).json({ 
                error: 'Failed to check demo status',
                available: false,
                mode: process.env.DEMO_MODE === 'true' ? 'active' : 'detection'
            });
        }
    });

    // Demo refresh endpoint
    app.post('/api/demo-refresh', async (req, res) => {
        try {
            const { spawn } = require('child_process');
            const refreshProcess = spawn('node', ['/app/demo/scripts/generate-demo-data.js']);

            let output = '';
            let responsesSent = false;

            refreshProcess.stdout.on('data', (data) => {
                output += data.toString();
            });

            refreshProcess.on('close', (code) => {
                if (!responsesSent) {
                    responsesSent = true;
                    if (code === 0) {
                        res.json({ 
                            success: true, 
                            message: 'Demo data refreshed successfully',
                            output: output.slice(-500)
                        });
                    } else {
                        res.status(500).json({ 
                            error: 'Demo data refresh failed', 
                            code: code,
                            output: output.slice(-500)
                        });
                    }
                }
            });

            setTimeout(() => {
                if (!responsesSent) {
                    responsesSent = true;
                    refreshProcess.kill();
                    res.status(408).json({ error: 'Demo refresh timeout' });
                }
            }, 500); // Shorter timeout for tests
        } catch (error) {
            res.status(500).json({ error: 'Failed to refresh demo data' });
        }
    });

    // Metrics endpoint
    app.get('/api/metrics', async (req, res) => {
        try {
            const dbPool = getDbPool(req);
            const [rows] = await dbPool.execute('SELECT * FROM performance_metrics ORDER BY timestamp DESC LIMIT 50');
            res.json(rows);
        } catch (error) {
            res.status(500).json({ error: 'Failed to fetch metrics' });
        }
    });

    // System health endpoint
    app.get('/api/system-health', async (req, res) => {
        try {
            const useDemo = req.query.demo === 'true' || process.env.DEMO_MODE === 'true';
            const dbPool = getDbPool(req);
            
            const [queryCount] = await dbPool.execute('SELECT COUNT(*) as total FROM slow_queries WHERE timestamp > DATE_SUB(NOW(), INTERVAL 1 HOUR)');
            const [pluginCount] = await dbPool.execute('SELECT COUNT(*) as total FROM plugin_performance WHERE status = "active"');
            const [avgResponse] = await dbPool.execute('SELECT AVG(avg_response_time) as avg FROM performance_metrics WHERE timestamp > DATE_SUB(NOW(), INTERVAL 1 HOUR)');

            res.json({
                slow_queries_1h: queryCount[0].total,
                active_plugins: pluginCount[0].total,
                avg_response_time: avgResponse[0].avg || 0,
                status: 'healthy',
                demo_mode: useDemo
            });
        } catch (error) {
            res.status(500).json({ error: 'Failed to fetch system health' });
        }
    });

    // Health check endpoint
    app.get('/health', (req, res) => {
        res.status(200).json({ 
            status: 'healthy', 
            timestamp: new Date().toISOString(),
            demoMode: process.env.DEMO_MODE === 'true',
            demoAvailable: true
        });
    });
}
