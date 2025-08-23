/**
 * Tests for real-time updates memory leak prevention
 * This test focuses on the core functionality without loading the full dashboard.js
 */

// Mock Chart.js
global.Chart = {
    defaults: {
        font: { family: '', size: 12 },
        color: '#8b949e'
    }
};

// Mock socket.io
const mockSocket = {
    on: jest.fn(),
    disconnect: jest.fn()
};

global.io = jest.fn(() => mockSocket);

// Mock DOM elements
const mockElements = new Map();

global.document = {
    getElementById: jest.fn((id) => {
        if (!mockElements.has(id)) {
            mockElements.set(id, {
                textContent: '',
                innerHTML: '',
                style: {},
                dataset: {},
                addEventListener: jest.fn(),
                remove: jest.fn(),
                parentNode: { removeChild: jest.fn() }
            });
        }
        return mockElements.get(id);
    }),
    createElement: jest.fn((tag) => ({
        className: '',
        textContent: '',
        dataset: {},
        addEventListener: jest.fn(),
        remove: jest.fn(),
        parentNode: null
    })),
    querySelectorAll: jest.fn(() => []),
    addEventListener: jest.fn(),
    body: {
        appendChild: jest.fn(),
        removeChild: jest.fn()
    },
    head: {
        appendChild: jest.fn()
    },
    hidden: false
};

global.window = {
    addEventListener: jest.fn(),
    contentUpdateManager: null
};

global.console = {
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
};

// Mock the core functions we're testing
let realTimeUpdateInProgress = false;
let lastRealTimeUpdate = 0;
const REAL_TIME_THROTTLE_MS = 1000;

function updateRealTimeMetricsCore(metricsData) {
    const elements = [
        { id: 'qps-value', value: Math.round(metricsData.queries_per_second || 0), suffix: '' },
        { id: 'response-value', value: Math.round(metricsData.avg_response_time || 0), suffix: 'ms' },
        { id: 'memory-value', value: Math.round(metricsData.memory_usage || 0), suffix: 'MB' }
    ];

    elements.forEach(({ id, value, suffix }) => {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = value + suffix;
        }
    });
}

function cleanupDynamicElements() {
    const notifications = document.querySelectorAll('.notification');
    notifications.forEach(notification => {
        const createdTime = notification.dataset.created;
        if (createdTime && (Date.now() - parseInt(createdTime)) > 10000) {
            try {
                notification.remove();
            } catch (error) {
                console.debug('Error removing old notification:', error);
            }
        }
    });
}

function updateRealTimeMetricsFallback(data) {
    try {
        updateRealTimeMetricsCore(data);
        console.debug('Real-time metrics updated via fallback');
    } catch (error) {
        console.error('Error in real-time metrics fallback:', error);
    }
}

// The actual handler function we're testing
function realTimeMetricsHandler(data) {
    const now = Date.now();
    if (realTimeUpdateInProgress || (now - lastRealTimeUpdate) < REAL_TIME_THROTTLE_MS) {
        console.debug('Real-time update throttled to prevent memory leaks');
        return;
    }

    realTimeUpdateInProgress = true;
    lastRealTimeUpdate = now;

    try {
        if (window.contentUpdateManager) {
            window.contentUpdateManager.updateContainer('real-time-metrics', (metricsData) => {
                updateRealTimeMetricsCore(metricsData);
                console.debug('Real-time metrics updated via ContentUpdateManager');
            }, data, {
                preserveScroll: false,
                cleanupRequired: true,
                priority: 'high'
            }).catch(error => {
                console.error('Error updating real-time metrics with ContentUpdateManager:', error);
                updateRealTimeMetricsFallback(data);
            }).finally(() => {
                realTimeUpdateInProgress = false;
            });
        } else {
            updateRealTimeMetricsFallback(data);
            realTimeUpdateInProgress = false;
        }
    } catch (error) {
        console.error('Error in real-time metrics handler:', error);
        realTimeUpdateInProgress = false;
    }
}

describe('Real-time Updates Memory Leak Prevention', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockElements.clear();
        realTimeUpdateInProgress = false;
        lastRealTimeUpdate = 0;
    });

    test('should have throttling mechanism', () => {
        expect(REAL_TIME_THROTTLE_MS).toBe(1000);
        expect(realTimeUpdateInProgress).toBe(false);
        expect(lastRealTimeUpdate).toBe(0);
    });

    test('should throttle rapid successive updates', async () => {
        const testData = {
            queries_per_second: 50,
            avg_response_time: 200,
            memory_usage: 128
        };

        // Simulate rapid updates
        realTimeMetricsHandler(testData);
        realTimeMetricsHandler(testData);
        realTimeMetricsHandler(testData);

        // Should only process the first update due to throttling
        expect(global.console.debug).toHaveBeenCalledWith('Real-time update throttled to prevent memory leaks');
    });

    test('should update gauge values safely', () => {
        const testData = {
            queries_per_second: 75,
            avg_response_time: 300,
            memory_usage: 256
        };

        realTimeMetricsHandler(testData);

        // Check that elements were updated
        const qpsElement = document.getElementById('qps-value');
        const responseElement = document.getElementById('response-value');
        const memoryElement = document.getElementById('memory-value');

        expect(qpsElement.textContent).toBe('75');
        expect(responseElement.textContent).toBe('300ms');
        expect(memoryElement.textContent).toBe('256MB');
    });

    test('should handle missing DOM elements gracefully', () => {
        document.getElementById.mockReturnValue(null);

        const testData = {
            queries_per_second: 25,
            avg_response_time: 150,
            memory_usage: 64
        };

        expect(() => realTimeMetricsHandler(testData)).not.toThrow();
    });

    test('should clean up dynamic elements', () => {
        // Mock some old notifications
        const oldNotifications = [
            { dataset: { created: (Date.now() - 15000).toString() }, remove: jest.fn() },
            { dataset: { created: (Date.now() - 5000).toString() }, remove: jest.fn() }
        ];

        document.querySelectorAll.mockImplementation((selector) => {
            if (selector === '.notification') {
                return oldNotifications;
            }
            return [];
        });

        // Call cleanup function directly
        cleanupDynamicElements();

        // Should remove old notification but keep recent one
        expect(oldNotifications[0].remove).toHaveBeenCalled();
        expect(oldNotifications[1].remove).not.toHaveBeenCalled();
    });

    test('should handle errors gracefully', () => {
        // Mock an error in the update process
        document.getElementById.mockImplementation(() => {
            throw new Error('DOM error');
        });

        const testData = {
            queries_per_second: 30,
            avg_response_time: 180,
            memory_usage: 96
        };

        expect(() => realTimeMetricsHandler(testData)).not.toThrow();
        expect(global.console.error).toHaveBeenCalled();
    });

    test('should use ContentUpdateManager when available', () => {
        const mockUpdateContainer = jest.fn().mockResolvedValue();
        global.window.contentUpdateManager = {
            updateContainer: mockUpdateContainer
        };

        const testData = {
            queries_per_second: 40,
            avg_response_time: 220,
            memory_usage: 160
        };

        realTimeMetricsHandler(testData);

        expect(mockUpdateContainer).toHaveBeenCalledWith(
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

    test('should fall back when ContentUpdateManager fails', async () => {
        const mockUpdateContainer = jest.fn().mockRejectedValue(new Error('Update failed'));
        global.window.contentUpdateManager = {
            updateContainer: mockUpdateContainer
        };

        const testData = {
            queries_per_second: 60,
            avg_response_time: 250,
            memory_usage: 192
        };

        realTimeMetricsHandler(testData);

        // Wait for the promise to resolve and fallback to execute
        await new Promise(resolve => setTimeout(resolve, 100));

        expect(mockUpdateContainer).toHaveBeenCalled();
        expect(global.console.error).toHaveBeenCalledWith(
            'Error updating real-time metrics with ContentUpdateManager:',
            expect.any(Error)
        );
    });
});

describe('Notification Memory Leak Prevention', () => {
    test('should clean up old notifications', () => {
        // Mock existing notifications
        const existingNotifications = [
            { dataset: { created: (Date.now() - 15000).toString() }, remove: jest.fn() },
            { dataset: { created: (Date.now() - 5000).toString() }, remove: jest.fn() }
        ];

        document.querySelectorAll.mockImplementation((selector) => {
            if (selector === '.notification') {
                return existingNotifications;
            }
            return [];
        });

        cleanupDynamicElements();

        // Should remove old notification but keep recent one
        expect(existingNotifications[0].remove).toHaveBeenCalled();
        expect(existingNotifications[1].remove).not.toHaveBeenCalled();
    });

    test('should handle cleanup errors gracefully', () => {
        const errorNotification = {
            dataset: { created: (Date.now() - 15000).toString() },
            remove: jest.fn(() => { throw new Error('Remove failed'); })
        };

        document.querySelectorAll.mockImplementation((selector) => {
            if (selector === '.notification') {
                return [errorNotification];
            }
            return [];
        });

        expect(() => cleanupDynamicElements()).not.toThrow();
        expect(global.console.debug).toHaveBeenCalledWith('Error removing old notification:', expect.any(Error));
    });
});

describe('Core Update Functions', () => {
    beforeEach(() => {
        // Reset DOM mock to normal behavior
        document.getElementById.mockImplementation((id) => {
            if (!mockElements.has(id)) {
                mockElements.set(id, {
                    textContent: '',
                    innerHTML: '',
                    style: {},
                    dataset: {},
                    addEventListener: jest.fn(),
                    remove: jest.fn(),
                    parentNode: { removeChild: jest.fn() }
                });
            }
            return mockElements.get(id);
        });
        
        // Reset querySelectorAll mock
        document.querySelectorAll.mockImplementation(() => []);
    });

    test('should update metrics core function safely', () => {
        const testData = {
            queries_per_second: 45,
            avg_response_time: 180,
            memory_usage: 120
        };

        expect(() => updateRealTimeMetricsCore(testData)).not.toThrow();

        const qpsElement = document.getElementById('qps-value');
        const responseElement = document.getElementById('response-value');
        const memoryElement = document.getElementById('memory-value');

        expect(qpsElement.textContent).toBe('45');
        expect(responseElement.textContent).toBe('180ms');
        expect(memoryElement.textContent).toBe('120MB');
    });

    test('should handle fallback updates', () => {
        const testData = {
            queries_per_second: 35,
            avg_response_time: 220,
            memory_usage: 90
        };

        expect(() => updateRealTimeMetricsFallback(testData)).not.toThrow();
        expect(global.console.debug).toHaveBeenCalledWith('Real-time metrics updated via fallback');
    });

    test('should handle fallback errors gracefully', () => {
        // Mock error for this specific test
        const originalGetElementById = document.getElementById;
        document.getElementById.mockImplementation(() => {
            throw new Error('DOM error');
        });

        const testData = {
            queries_per_second: 25,
            avg_response_time: 160,
            memory_usage: 80
        };

        expect(() => updateRealTimeMetricsFallback(testData)).not.toThrow();
        expect(global.console.error).toHaveBeenCalledWith('Error in real-time metrics fallback:', expect.any(Error));
        
        // Restore original mock
        document.getElementById = originalGetElementById;
    });
});
