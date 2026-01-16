const socket = io();
let performanceChart, adminAjaxChart;
let qpsGauge, responseGauge, memoryGauge;
let currentMetric = 'response_time';

// Demo mode state
let demoMode = false;
let demoStatus = { available: false, services: {} };
let demoCheckInterval = null;

// Chart.js default configuration
Chart.defaults.font.family = 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
Chart.defaults.font.size = 12;
Chart.defaults.color = '#8b949e';

// Initialize all charts and gauges
function initCharts() {
    initPerformanceChart();
    initAdminAjaxChart();
    initGauges();
}

function getSelectedTimeRange() {
    const selector = document.getElementById('timeRange');
    return selector ? selector.value : '1h';
}

function initPerformanceChart() {
    const ctx = document.getElementById('performanceChart').getContext('2d');
    performanceChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: 'Response Time (ms)',
                data: [],
                borderColor: '#58a6ff',
                backgroundColor: 'rgba(88, 166, 255, 0.1)',
                tension: 0.4,
                fill: true,
                pointRadius: 4,
                pointHoverRadius: 6,
                pointBackgroundColor: '#58a6ff',
                pointBorderColor: '#ffffff',
                pointBorderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                intersect: false,
                mode: 'index'
            },
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    backgroundColor: 'rgba(22, 27, 34, 0.95)',
                    titleColor: '#e6edf3',
                    bodyColor: '#8b949e',
                    borderColor: '#30363d',
                    borderWidth: 1,
                    cornerRadius: 8,
                    titleFont: { weight: 'bold' }
                }
            },
            scales: {
                x: {
                    ticks: {
                        color: '#8b949e',
                        maxTicksLimit: 10
                    },
                    grid: {
                        color: '#30363d',
                        borderColor: '#30363d'
                    }
                },
                y: {
                    ticks: {
                        color: '#8b949e',
                        callback: function(value) {
                            return value + (currentMetric === 'response_time' ? 'ms' :
                                          currentMetric === 'memory_usage' ? 'MB' : '');
                        }
                    },
                    grid: {
                        color: '#30363d',
                        borderColor: '#30363d'
                    }
                }
            },
            elements: {
                line: {
                    borderWidth: 3
                }
            }
        }
    });
}

function initAdminAjaxChart() {
    const ctx = document.getElementById('adminAjaxChart').getContext('2d');
    adminAjaxChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: [],
            datasets: [{
                label: 'Calls per minute',
                data: [],
                backgroundColor: '#f85149',
                borderColor: '#f85149',
                borderWidth: 1,
                borderRadius: 4,
                borderSkipped: false
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    backgroundColor: 'rgba(22, 27, 34, 0.95)',
                    titleColor: '#e6edf3',
                    bodyColor: '#8b949e',
                    borderColor: '#30363d',
                    borderWidth: 1,
                    cornerRadius: 8
                }
            },
            scales: {
                x: {
                    ticks: {
                        color: '#8b949e',
                        maxRotation: 45
                    },
                    grid: {
                        color: '#30363d',
                        borderColor: '#30363d'
                    }
                },
                y: {
                    ticks: {
                        color: '#8b949e'
                    },
                    grid: {
                        color: '#30363d',
                        borderColor: '#30363d'
                    }
                }
            }
        }
    });
}

function initGauges() {
    // QPS Gauge
    const qpsCtx = document.getElementById('qpsGauge').getContext('2d');
    qpsGauge = new Chart(qpsCtx, {
        type: 'doughnut',
        data: {
            datasets: [{
                data: [0, 100],
                backgroundColor: ['#58a6ff', '#30363d'],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '70%',
            plugins: {
                legend: { display: false },
                tooltip: { enabled: false }
            }
        }
    });

    // Response Time Gauge
    const responseCtx = document.getElementById('responseGauge').getContext('2d');
    responseGauge = new Chart(responseCtx, {
        type: 'doughnut',
        data: {
            datasets: [{
                data: [0, 100],
                backgroundColor: ['#f85149', '#30363d'],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '70%',
            plugins: {
                legend: { display: false },
                tooltip: { enabled: false }
            }
        }
    });

    // Memory Gauge
    const memoryCtx = document.getElementById('memoryGauge').getContext('2d');
    memoryGauge = new Chart(memoryCtx, {
        type: 'doughnut',
        data: {
            datasets: [{
                data: [0, 100],
                backgroundColor: ['#238636', '#30363d'],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '70%',
            plugins: {
                legend: { display: false },
                tooltip: { enabled: false }
            }
        }
    });
}

// Update gauge with value (0-100) with memory leak prevention
function updateGauge(chart, value, maxValue = 100) {
    if (!chart || !chart.data || !chart.data.datasets || !chart.data.datasets[0]) {
        console.warn('Invalid chart object passed to updateGauge');
        return;
    }

    try {
        const percentage = Math.min(Math.max((value / maxValue) * 100, 0), 100);
        
        // Ensure we don't create new arrays unnecessarily to prevent memory leaks
        const dataset = chart.data.datasets[0];
        if (!dataset.data || dataset.data.length !== 2) {
            dataset.data = [percentage, 100 - percentage];
        } else {
            // Reuse existing array to prevent memory allocation
            dataset.data[0] = percentage;
            dataset.data[1] = 100 - percentage;
        }

        // Use 'none' animation mode to prevent accumulation of animation objects
        chart.update('none');
        
    } catch (error) {
        console.error('Error updating gauge:', error);
        // Don't re-throw to prevent breaking other gauge updates
    }
}

// Load dashboard data with coordinated updates, error handling, and rollback mechanisms
async function loadDashboardData() {
    const loadStartTime = Date.now();
    const operationId = Math.random().toString(36).substr(2, 9);
    let snapshots = new Map();
    let updateAttempts = 0;
    const maxRetries = 2;
    let partialUpdateState = null;

    try {
        console.log(`Loading dashboard data with enhanced coordination (Operation ID: ${operationId})...`);
        
        // Create snapshots for atomic operations and rollback
        if (window.contentUpdateManager) {
            const containerIds = ['slowQueries', 'pluginPerformance'];
            for (const containerId of containerIds) {
                const snapshot = window.contentUpdateManager.createContainerSnapshot(containerId);
                if (snapshot) {
                    snapshots.set(containerId, snapshot);
                }
            }
            console.debug(`Created ${snapshots.size} container snapshots for atomic operations`);
        }

        // Fetch all data in parallel with timeout and retry logic
        const timeRange = getSelectedTimeRange();
        const queryParams = new URLSearchParams();
        if (demoMode) {
            queryParams.set('demo', 'true');
        }
        if (timeRange) {
            queryParams.set('timeRange', timeRange);
        }
        const querySuffix = queryParams.toString() ? `?${queryParams.toString()}` : '';
        const fetchPromises = [
            fetchWithRetry(`/api/metrics${querySuffix}`, 'metrics'),
            fetchWithRetry(`/api/slow-queries${querySuffix}`, 'slow-queries'),
            fetchWithRetry(`/api/admin-ajax${querySuffix}`, 'admin-ajax'),
            fetchWithRetry(`/api/plugins${querySuffix}`, 'plugins'),
            fetchWithRetry(`/api/system-health${querySuffix}`, 'system-health')
        ];

        const [metricsResponse, queriesResponse, ajaxResponse, pluginsResponse, healthResponse] = 
            await Promise.all(fetchPromises);

        // Parse responses with error handling and validation
        const [metrics, queries, ajaxData, plugins, health] = await Promise.all([
            parseResponseSafely(metricsResponse, 'metrics'),
            parseResponseSafely(queriesResponse, 'queries'),
            parseResponseSafely(ajaxResponse, 'ajaxData'),
            parseResponseSafely(pluginsResponse, 'plugins'),
            parseResponseSafely(healthResponse, 'health')
        ]);

        // Validate parsed data before proceeding with updates
        validateDashboardData({ metrics, queries, ajaxData, plugins, health });

        // Use ContentUpdateManager for coordinated atomic updates
        if (window.contentUpdateManager) {
            partialUpdateState = await performAtomicCoordinatedUpdates(
                metrics, queries, ajaxData, plugins, health, operationId
            );
        } else {
            // Enhanced fallback with error handling and partial state tracking
            partialUpdateState = await performFallbackUpdates(
                queries, plugins, metrics, ajaxData, health, operationId
            );
        }

        const loadTime = Date.now() - loadStartTime;
        console.log(`Dashboard data loading completed successfully in ${loadTime}ms (Operation ID: ${operationId})`);

        updateRecommendations(health, queries, plugins);

        // Clear any previous error states and cleanup snapshots
        clearErrorState();
        snapshots.clear();

        // Log successful update metrics
        logUpdateMetrics(operationId, loadTime, partialUpdateState);

    } catch (error) {
        updateAttempts++;
        console.error(`Error loading dashboard data (attempt ${updateAttempts}, Operation ID: ${operationId}):`, error);
        
        // Enhanced rollback with atomic operations
        if (snapshots.size > 0 && window.contentUpdateManager && updateAttempts <= maxRetries) {
            console.warn(`Attempting atomic rollback to previous state (Operation ID: ${operationId})...`);
            try {
                await performAtomicRollback(snapshots, operationId, partialUpdateState);
                console.log(`Atomic rollback completed successfully (Operation ID: ${operationId})`);
            } catch (rollbackError) {
                console.error(`Atomic rollback failed (Operation ID: ${operationId}):`, rollbackError);
                // If rollback fails, attempt emergency container recreation
                await performEmergencyRecovery(snapshots, operationId);
            }
        }

        // Show user-friendly error with retry option
        showEnhancedError(error, updateAttempts, maxRetries, operationId);
        
        // If we haven't exceeded max retries, attempt again after a delay
        if (updateAttempts < maxRetries) {
            const retryDelay = Math.min(1000 * Math.pow(2, updateAttempts), 5000); // Exponential backoff, max 5s
            console.log(`Retrying dashboard data load in ${retryDelay}ms (Operation ID: ${operationId})...`);
            setTimeout(() => loadDashboardData(), retryDelay);
        } else {
            // Log final failure for debugging
            console.error(`Dashboard data loading failed permanently after ${updateAttempts} attempts (Operation ID: ${operationId})`);
            logUpdateFailure(operationId, error, updateAttempts, partialUpdateState);
        }
    }
}

/**
 * Fetch data with retry logic and timeout
 * @param {string} url - API endpoint URL
 * @param {string} dataType - Type of data being fetched (for logging)
 * @returns {Promise<Response>} Fetch response
 */
async function fetchWithRetry(url, dataType, retries = 2, timeout = 10000) {
    for (let attempt = 1; attempt <= retries + 1; attempt++) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), timeout);
            
            const response = await fetch(url, { 
                signal: controller.signal,
                headers: {
                    'Cache-Control': 'no-cache',
                    'Pragma': 'no-cache'
                }
            });
            
            clearTimeout(timeoutId);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            console.debug(`Successfully fetched ${dataType} data (attempt ${attempt})`);
            return response;
            
        } catch (error) {
            console.warn(`Failed to fetch ${dataType} data (attempt ${attempt}/${retries + 1}):`, error.message);
            
            if (attempt === retries + 1) {
                throw new Error(`Failed to fetch ${dataType} after ${retries + 1} attempts: ${error.message}`);
            }
            
            // Wait before retry with exponential backoff
            const delay = Math.min(500 * Math.pow(2, attempt - 1), 3000);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
}

/**
 * Safely parse response JSON with error handling
 * @param {Response} response - Fetch response
 * @param {string} dataType - Type of data being parsed
 * @returns {Promise<any>} Parsed data
 */
async function parseResponseSafely(response, dataType) {
    try {
        const data = await response.json();
        console.debug(`Successfully parsed ${dataType} data:`, { 
            type: Array.isArray(data) ? 'array' : typeof data,
            length: Array.isArray(data) ? data.length : 'N/A'
        });
        return data;
    } catch (error) {
        console.error(`Failed to parse ${dataType} response:`, error);
        throw new Error(`Invalid JSON response for ${dataType}: ${error.message}`);
    }
}

/**
 * Validate dashboard data before processing
 * @param {Object} data - Dashboard data object
 * @throws {Error} If data validation fails
 */
function validateDashboardData(data) {
    const { metrics, queries, ajaxData, plugins, health } = data;
    
    // Validate data types and basic structure
    if (queries !== null && !Array.isArray(queries)) {
        throw new Error('Invalid queries data: expected array or null');
    }
    
    if (plugins !== null && !Array.isArray(plugins)) {
        throw new Error('Invalid plugins data: expected array or null');
    }
    
    if (metrics !== null && !Array.isArray(metrics)) {
        throw new Error('Invalid metrics data: expected array or null');
    }
    
    if (ajaxData !== null && !Array.isArray(ajaxData)) {
        throw new Error('Invalid ajaxData: expected array or null');
    }
    
    if (health !== null && typeof health !== 'object') {
        throw new Error('Invalid health data: expected object or null');
    }
    
    console.debug('Dashboard data validation passed');
}

/**
 * Perform atomic coordinated updates using ContentUpdateManager
 * @param {Array} metrics - Performance metrics data
 * @param {Array} queries - Slow queries data
 * @param {Array} ajaxData - Admin AJAX data
 * @param {Array} plugins - Plugin performance data
 * @param {Object} health - System health data
 * @param {string} operationId - Unique operation identifier
 * @returns {Object} Partial update state for rollback purposes
 */
async function performAtomicCoordinatedUpdates(metrics, queries, ajaxData, plugins, health, operationId) {
    const updateState = {
        operationId,
        startTime: Date.now(),
        completedUpdates: [],
        failedUpdates: [],
        totalUpdates: 0
    };

    try {
        const containerUpdates = [];

        // Add slow queries update with enhanced atomic options
        if (queries && Array.isArray(queries)) {
            containerUpdates.push({
                containerId: 'slowQueries',
                updateFunction: (data) => updateSlowQueriesContent(data),
                data: queries,
                options: { 
                    preserveScroll: true, 
                    cleanupRequired: true, 
                    priority: 'normal',
                    rollbackOnError: true,
                    atomicOperation: true,
                    operationId: operationId,
                    validateAfterUpdate: true
                }
            });
        }

        // Add plugin performance update with enhanced atomic options
        if (plugins && Array.isArray(plugins)) {
            containerUpdates.push({
                containerId: 'pluginPerformance',
                updateFunction: (data) => updatePluginPerformanceContent(data),
                data: plugins,
                options: { 
                    preserveScroll: true, 
                    cleanupRequired: true, 
                    priority: 'normal',
                    rollbackOnError: true,
                    atomicOperation: true,
                    operationId: operationId,
                    validateAfterUpdate: true
                }
            });
        }

        updateState.totalUpdates = containerUpdates.length;

        // Execute coordinated updates for scrollable containers with enhanced atomic options
        if (containerUpdates.length > 0) {
            try {
                const coordinationResult = await window.contentUpdateManager.coordinateUpdates(containerUpdates, {
                    sequential: false, // Parallel execution for better performance
                    priority: 'normal',
                    maxConcurrent: 2, // Limit concurrent updates to prevent resource contention
                    timeout: 25000, // Increased timeout for better reliability
                    retryOnFailure: true,
                    maxRetries: 1,
                    atomicOperation: true,
                    operationId: operationId,
                    rollbackOnPartialFailure: true,
                    validateResults: true
                });
                
                updateState.completedUpdates = coordinationResult.successful || [];
                updateState.failedUpdates = coordinationResult.failed || [];
                
                console.log(`Successfully coordinated ${updateState.completedUpdates.length}/${containerUpdates.length} container updates (Operation ID: ${operationId})`);
                
                // If any updates failed, log details but continue
                if (updateState.failedUpdates.length > 0) {
                    console.warn(`${updateState.failedUpdates.length} container updates failed (Operation ID: ${operationId}):`, updateState.failedUpdates);
                }
                
            } catch (coordinationError) {
                console.error(`Coordination failed (Operation ID: ${operationId}), attempting individual atomic updates:`, coordinationError);
                
                // Fallback to individual atomic updates if coordination fails
                for (const update of containerUpdates) {
                    try {
                        await window.contentUpdateManager.updateContainer(
                            update.containerId,
                            update.updateFunction,
                            update.data,
                            { 
                                ...update.options, 
                                priority: 'high', 
                                bypassThrottle: true,
                                atomicOperation: true,
                                operationId: operationId
                            }
                        );
                        updateState.completedUpdates.push(update.containerId);
                    } catch (individualError) {
                        console.error(`Failed to update ${update.containerId} (Operation ID: ${operationId}):`, individualError);
                        updateState.failedUpdates.push({
                            containerId: update.containerId,
                            error: individualError.message
                        });
                        // Continue with other updates even if one fails
                    }
                }
            }
        }

        // Update charts and non-scrollable content with error handling
        try {
            await updateNonScrollableContent(metrics, ajaxData, health, operationId);
            updateState.nonScrollableUpdated = true;
        } catch (nonScrollableError) {
            console.error(`Non-scrollable content update failed (Operation ID: ${operationId}):`, nonScrollableError);
            updateState.nonScrollableUpdated = false;
            updateState.nonScrollableError = nonScrollableError.message;
        }

        updateState.endTime = Date.now();
        updateState.duration = updateState.endTime - updateState.startTime;
        
        return updateState;
        
    } catch (error) {
        updateState.endTime = Date.now();
        updateState.duration = updateState.endTime - updateState.startTime;
        updateState.criticalError = error.message;
        throw error;
    }
}

/**
 * Perform coordinated updates using ContentUpdateManager with atomic operations
 * @param {Array} metrics - Performance metrics data
 * @param {Array} queries - Slow queries data
 * @param {Array} ajaxData - Admin AJAX data
 * @param {Array} plugins - Plugin performance data
 * @param {Object} health - System health data
 */
async function performCoordinatedUpdates(metrics, queries, ajaxData, plugins, health) {
    const containerUpdates = [];

    // Add slow queries update with enhanced error handling
    if (queries && Array.isArray(queries)) {
        containerUpdates.push({
            containerId: 'slowQueries',
            updateFunction: (data) => updateSlowQueriesContent(data),
            data: queries,
            options: { 
                preserveScroll: true, 
                cleanupRequired: true, 
                priority: 'normal',
                rollbackOnError: true
            }
        });
    }

    // Add plugin performance update with enhanced error handling
    if (plugins && Array.isArray(plugins)) {
        containerUpdates.push({
            containerId: 'pluginPerformance',
            updateFunction: (data) => updatePluginPerformanceContent(data),
            data: plugins,
            options: { 
                preserveScroll: true, 
                cleanupRequired: true, 
                priority: 'normal',
                rollbackOnError: true
            }
        });
    }

    // Execute coordinated updates for scrollable containers with enhanced options
    if (containerUpdates.length > 0) {
        try {
            await window.contentUpdateManager.coordinateUpdates(containerUpdates, {
                sequential: false, // Parallel execution for better performance
                priority: 'normal',
                maxConcurrent: 2, // Limit concurrent updates to prevent resource contention
                timeout: 20000, // Increased timeout for better reliability
                retryOnFailure: true,
                maxRetries: 1
            });
            
            console.log(`Successfully coordinated ${containerUpdates.length} container updates`);
        } catch (coordinationError) {
            console.error('Coordination failed, attempting individual updates:', coordinationError);
            
            // Fallback to individual updates if coordination fails
            for (const update of containerUpdates) {
                try {
                    await window.contentUpdateManager.updateContainer(
                        update.containerId,
                        update.updateFunction,
                        update.data,
                        { ...update.options, priority: 'high', bypassThrottle: true }
                    );
                } catch (individualError) {
                    console.error(`Failed to update ${update.containerId}:`, individualError);
                    // Continue with other updates even if one fails
                }
            }
        }
    }

    // Update charts and non-scrollable content with error handling
    await updateNonScrollableContent(metrics, ajaxData, health);
}

/**
 * Update slow queries content with atomic operations
 * @param {Array} data - Slow queries data
 */
function updateSlowQueriesContent(data) {
    const container = document.getElementById('slowQueries');
    const countElement = document.getElementById('slow-query-count');

    if (!container) {
        throw new Error('slowQueries container not found');
    }

    // Update count element outside of scrollable container
    if (countElement) {
        countElement.textContent = `${data.length} queries`;
    }

    // Perform atomic update with complete replacement
    if (data.length === 0) {
        container.innerHTML = '<div class="no-data">No slow queries detected 🎉</div>';
        return;
    }

    // Generate new content completely replacing old content
    const newContent = data.map(query => `
        <div class="query-item">
            <div class="query-header">
                <strong>Query:</strong>
                <span class="query-time">${query.execution_time}ms</span>
            </div>
            <div class="query-text">${escapeHtml(query.query_text.substring(0, 150))}${query.query_text.length > 150 ? '...' : ''}</div>
            <div class="query-meta">
                <span>📊 ${query.rows_examined} rows</span> |
                <span>📁 ${escapeHtml(query.source_file || 'Unknown')}</span>
            </div>
        </div>
    `).join('');

    // Atomic replacement to prevent accumulation
    container.innerHTML = newContent;
    
    console.debug(`updateSlowQueriesContent: Updated container with ${data.length} queries`);
}

/**
 * Update plugin performance content with atomic operations
 * @param {Array} data - Plugin performance data
 */
function updatePluginPerformanceContent(data) {
    const container = document.getElementById('pluginPerformance');
    const countElement = document.getElementById('plugin-count');

    if (!container) {
        throw new Error('pluginPerformance container not found');
    }

    // Update count element outside of scrollable container
    if (countElement) {
        countElement.textContent = `${data.length} plugins`;
    }

    // Perform atomic update with complete replacement
    if (data.length === 0) {
        container.innerHTML = '<div class="no-data">No plugin data available</div>';
        return;
    }

    // Generate new content completely replacing old content
    const newContent = data.map(plugin => {
        const impactColor = plugin.impact_score > 70 ? '#f85149' :
                           plugin.impact_score > 40 ? '#f9826c' : '#238636';

        return `
            <div class="plugin-item">
                <div class="plugin-main">
                    <strong>${escapeHtml(plugin.plugin_name)}</strong>
                    <span class="plugin-impact" style="color: ${impactColor}">
                        ${plugin.impact_score}/100
                    </span>
                </div>
                <div class="plugin-stats">
                    <span>💾 ${plugin.memory_usage}MB</span>
                    <span>🔍 ${plugin.query_count} queries</span>
                    <span>⚡ ${plugin.load_time}ms</span>
                </div>
            </div>
        `;
    }).join('');

    // Atomic replacement to prevent accumulation
    container.innerHTML = newContent;
    
    console.debug(`updatePluginPerformanceContent: Updated container with ${data.length} plugins`);
}

/**
 * Update non-scrollable content (charts and gauges) with error handling
 * @param {Array} metrics - Performance metrics data
 * @param {Array} ajaxData - Admin AJAX data
 * @param {Object} health - System health data
 * @param {string} operationId - Operation identifier for logging
 */
async function updateNonScrollableContent(metrics, ajaxData, health, operationId = 'unknown') {
    const updatePromises = [];

    // Update performance chart
    if (metrics && Array.isArray(metrics) && metrics.length > 0) {
        updatePromises.push(
            Promise.resolve().then(() => {
                updatePerformanceChart(metrics);
                console.debug(`Performance chart updated successfully (Operation ID: ${operationId})`);
            }).catch(error => {
                console.error(`Error updating performance chart (Operation ID: ${operationId}):`, error);
                // Don't throw - continue with other updates
            })
        );
    }

    // Update admin AJAX chart
    if (ajaxData && Array.isArray(ajaxData)) {
        updatePromises.push(
            Promise.resolve().then(() => {
                updateAdminAjaxChart(ajaxData);
                console.debug(`Admin AJAX chart updated successfully (Operation ID: ${operationId})`);
            }).catch(error => {
                console.error(`Error updating admin AJAX chart (Operation ID: ${operationId}):`, error);
                // Don't throw - continue with other updates
            })
        );
    }

    // Update system health
    if (health && typeof health === 'object') {
        updatePromises.push(
            Promise.resolve().then(() => {
                updateSystemHealth(health);
                console.debug(`System health updated successfully (Operation ID: ${operationId})`);
            }).catch(error => {
                console.error(`Error updating system health (Operation ID: ${operationId}):`, error);
                // Don't throw - continue with other updates
            })
        );
    }

    // Wait for all non-scrollable updates to complete
    await Promise.allSettled(updatePromises);
}

/**
 * Perform fallback updates when ContentUpdateManager is not available
 * @param {Array} queries - Slow queries data
 * @param {Array} plugins - Plugin performance data
 * @param {Array} metrics - Performance metrics data
 * @param {Array} ajaxData - Admin AJAX data
 * @param {Object} health - System health data
 * @param {string} operationId - Operation identifier for logging
 * @returns {Object} Partial update state for rollback purposes
 */
async function performFallbackUpdates(queries, plugins, metrics, ajaxData, health, operationId = 'fallback') {
    console.warn(`ContentUpdateManager not available, using enhanced fallback updates (Operation ID: ${operationId})`);
    
    const updateState = {
        operationId,
        startTime: Date.now(),
        completedUpdates: [],
        failedUpdates: [],
        totalUpdates: 0,
        fallbackMode: true
    };

    const fallbackPromises = [];

    // Update scrollable containers with fallback methods
    if (queries && Array.isArray(queries)) {
        updateState.totalUpdates++;
        fallbackPromises.push(
            Promise.resolve().then(() => {
                displaySlowQueries(queries);
                updateState.completedUpdates.push('slowQueries');
                console.debug(`Fallback slow queries update completed (Operation ID: ${operationId})`);
            }).catch(error => {
                console.error(`Fallback slow queries update failed (Operation ID: ${operationId}):`, error);
                updateState.failedUpdates.push({
                    containerId: 'slowQueries',
                    error: error.message
                });
            })
        );
    }

    if (plugins && Array.isArray(plugins)) {
        updateState.totalUpdates++;
        fallbackPromises.push(
            Promise.resolve().then(() => {
                displayPluginPerformance(plugins);
                updateState.completedUpdates.push('pluginPerformance');
                console.debug(`Fallback plugin performance update completed (Operation ID: ${operationId})`);
            }).catch(error => {
                console.error(`Fallback plugin performance update failed (Operation ID: ${operationId}):`, error);
                updateState.failedUpdates.push({
                    containerId: 'pluginPerformance',
                    error: error.message
                });
            })
        );
    }

    // Update non-scrollable content
    try {
        await updateNonScrollableContent(metrics, ajaxData, health, operationId);
        updateState.nonScrollableUpdated = true;
    } catch (nonScrollableError) {
        console.error(`Fallback non-scrollable content update failed (Operation ID: ${operationId}):`, nonScrollableError);
        updateState.nonScrollableUpdated = false;
        updateState.nonScrollableError = nonScrollableError.message;
    }
    
    // Wait for scrollable container updates
    await Promise.allSettled(fallbackPromises);
    
    updateState.endTime = Date.now();
    updateState.duration = updateState.endTime - updateState.startTime;
    
    console.log(`Fallback updates completed: ${updateState.completedUpdates.length}/${updateState.totalUpdates} successful (Operation ID: ${operationId})`);
    
    return updateState;
}

/**
 * Capture current state for rollback purposes
 * @returns {Object} Current state snapshot
 */
function captureCurrentState() {
    const state = {
        timestamp: Date.now(),
        containers: {}
    };

    const containerIds = ['slowQueries', 'pluginPerformance'];
    
    containerIds.forEach(containerId => {
        const container = document.getElementById(containerId);
        if (container) {
            state.containers[containerId] = {
                innerHTML: container.innerHTML,
                scrollTop: container.scrollTop,
                scrollHeight: container.scrollHeight
            };
        }
    });

    console.debug('Captured current state for rollback:', Object.keys(state.containers));
    return state;
}

/**
 * Perform atomic rollback using ContentUpdateManager snapshots
 * @param {Map} snapshots - Container snapshots for rollback
 * @param {string} operationId - Operation identifier
 * @param {Object} partialUpdateState - State of partial updates
 */
async function performAtomicRollback(snapshots, operationId, partialUpdateState) {
    if (!snapshots || snapshots.size === 0) {
        throw new Error('No snapshots available for atomic rollback');
    }

    console.warn(`Performing atomic rollback to previous state (Operation ID: ${operationId})`);

    const rollbackPromises = [];
    const rollbackResults = {
        successful: [],
        failed: [],
        operationId,
        startTime: Date.now()
    };

    for (const [containerId, snapshot] of snapshots.entries()) {
        rollbackPromises.push(
            window.contentUpdateManager.rollbackContainer(containerId, `Operation ${operationId} failed`)
                .then(() => {
                    rollbackResults.successful.push(containerId);
                    console.debug(`Atomic rollback successful for ${containerId} (Operation ID: ${operationId})`);
                })
                .catch(error => {
                    console.error(`Atomic rollback failed for ${containerId} (Operation ID: ${operationId}):`, error);
                    rollbackResults.failed.push({
                        containerId,
                        error: error.message,
                        snapshot: snapshot.snapshotId
                    });
                })
        );
    }

    await Promise.allSettled(rollbackPromises);
    
    rollbackResults.endTime = Date.now();
    rollbackResults.duration = rollbackResults.endTime - rollbackResults.startTime;
    
    console.log(`Atomic rollback completed: ${rollbackResults.successful.length}/${snapshots.size} successful (Operation ID: ${operationId})`);
    
    if (rollbackResults.failed.length > 0) {
        console.error(`${rollbackResults.failed.length} atomic rollbacks failed (Operation ID: ${operationId}):`, rollbackResults.failed);
    }
    
    return rollbackResults;
}

/**
 * Perform emergency recovery when rollback fails
 * @param {Map} snapshots - Container snapshots
 * @param {string} operationId - Operation identifier
 */
async function performEmergencyRecovery(snapshots, operationId) {
    console.error(`Performing emergency recovery (Operation ID: ${operationId})`);
    
    const recoveryPromises = [];
    
    for (const [containerId] of snapshots.entries()) {
        recoveryPromises.push(
            Promise.resolve().then(() => {
                const container = document.getElementById(containerId);
                if (container) {
                    // Force container recreation with emergency cleanup
                    if (window.DOMCleanup) {
                        window.DOMCleanup.emergencyCleanup(container);
                    } else {
                        // Fallback emergency cleanup
                        container.innerHTML = `
                            <div class="emergency-recovery" style="
                                text-align: center; 
                                padding: 40px 20px; 
                                color: #f85149; 
                                background: rgba(248, 81, 73, 0.1); 
                                border: 1px solid rgba(248, 81, 73, 0.3); 
                                border-radius: 8px; 
                                margin: 20px 0;
                            ">
                                <div style="font-size: 24px; margin-bottom: 10px;">🚨</div>
                                <div style="font-weight: bold; margin-bottom: 8px;">Emergency Recovery</div>
                                <div style="font-size: 14px; color: #8b949e;">
                                    Container was reset due to update failure.<br>
                                    Data will be refreshed automatically.
                                </div>
                            </div>
                        `;
                    }
                    console.warn(`Emergency recovery completed for ${containerId} (Operation ID: ${operationId})`);
                }
            }).catch(error => {
                console.error(`Emergency recovery failed for ${containerId} (Operation ID: ${operationId}):`, error);
            })
        );
    }
    
    await Promise.allSettled(recoveryPromises);
    
    // Trigger a delayed refresh to restore data
    setTimeout(() => {
        console.log(`Triggering data refresh after emergency recovery (Operation ID: ${operationId})`);
        if (typeof loadDashboardData === 'function') {
            loadDashboardData();
        }
    }, 3000);
}

/**
 * Log successful update metrics
 * @param {string} operationId - Operation identifier
 * @param {number} loadTime - Total load time in milliseconds
 * @param {Object} updateState - Update state information
 */
function logUpdateMetrics(operationId, loadTime, updateState) {
    const metrics = {
        operationId,
        loadTime,
        updateState,
        timestamp: Date.now(),
        success: true
    };
    
    console.debug(`Update metrics (Operation ID: ${operationId}):`, metrics);
    
    // Store metrics for performance analysis (optional)
    if (window.performanceMetrics) {
        window.performanceMetrics.push(metrics);
        
        // Keep only last 50 metrics to prevent memory growth
        if (window.performanceMetrics.length > 50) {
            window.performanceMetrics = window.performanceMetrics.slice(-50);
        }
    }
}

/**
 * Log update failure for debugging
 * @param {string} operationId - Operation identifier
 * @param {Error} error - The error that occurred
 * @param {number} attempts - Number of attempts made
 * @param {Object} partialUpdateState - State of partial updates
 */
function logUpdateFailure(operationId, error, attempts, partialUpdateState) {
    const failureLog = {
        operationId,
        error: {
            message: error.message,
            stack: error.stack,
            name: error.name
        },
        attempts,
        partialUpdateState,
        timestamp: Date.now(),
        success: false
    };
    
    console.error(`Update failure log (Operation ID: ${operationId}):`, failureLog);
    
    // Store failure logs for debugging (optional)
    if (!window.updateFailureLogs) {
        window.updateFailureLogs = [];
    }
    
    window.updateFailureLogs.push(failureLog);
    
    // Keep only last 20 failure logs to prevent memory growth
    if (window.updateFailureLogs.length > 20) {
        window.updateFailureLogs = window.updateFailureLogs.slice(-20);
    }
}

/**
 * Perform rollback to previous state
 * @param {Object} rollbackData - Previously captured state
 */
async function performRollback(rollbackData) {
    if (!rollbackData || !rollbackData.containers) {
        throw new Error('Invalid rollback data');
    }

    console.warn('Performing rollback to state from', new Date(rollbackData.timestamp));

    const rollbackPromises = [];

    for (const [containerId, containerState] of Object.entries(rollbackData.containers)) {
        rollbackPromises.push(
            window.contentUpdateManager.updateContainer(
                containerId,
                () => {
                    const container = document.getElementById(containerId);
                    if (container && containerState.innerHTML) {
                        container.innerHTML = containerState.innerHTML;
                        // Restore scroll position if available
                        if (containerState.scrollTop !== undefined) {
                            container.scrollTop = containerState.scrollTop;
                        }
                    }
                },
                null,
                { 
                    preserveScroll: false, // We're manually restoring scroll
                    cleanupRequired: false, // Don't clean up during rollback
                    priority: 'critical',
                    bypassThrottle: true
                }
            ).catch(error => {
                console.error(`Rollback failed for ${containerId}:`, error);
                // Continue with other rollbacks even if one fails
            })
        );
    }

    await Promise.allSettled(rollbackPromises);
}

/**
 * Show enhanced error message with retry options
 * @param {Error} error - The error that occurred
 * @param {number} attempts - Number of attempts made
 * @param {number} maxRetries - Maximum number of retries
 * @param {string} operationId - Operation identifier
 */
function showEnhancedError(error, attempts, maxRetries, operationId = 'unknown') {
    const errorMessage = attempts > maxRetries 
        ? `Failed to load dashboard data after ${attempts} attempts (Operation ID: ${operationId}). Please refresh the page or check your connection.`
        : `Loading dashboard data failed (attempt ${attempts}/${maxRetries}, Operation ID: ${operationId}). Retrying...`;
    
    showError(errorMessage, error);
}

/**
 * Clear any error states from the UI
 */
function clearErrorState() {
    // Remove any error notifications that might be displayed
    const errorElements = document.querySelectorAll('.error-notification, .loading-error');
    errorElements.forEach(element => {
        try {
            element.remove();
        } catch (e) {
            console.debug('Error removing error element:', e);
        }
    });
}

/**
 * Escape HTML to prevent XSS attacks
 * @param {string} text - Text to escape
 * @returns {string} Escaped text
 */
function escapeHtml(text) {
    if (typeof text !== 'string') return text;
    
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function updatePerformanceChart(metrics) {
    const labels = metrics.map(m => new Date(m.timestamp).toLocaleTimeString());
    let data, label, color;

    switch (currentMetric) {
        case 'memory_usage':
            data = metrics.map(m => m.memory_usage);
            label = 'Memory Usage (MB)';
            color = '#238636';
            break;
        case 'queries_per_second':
            data = metrics.map(m => m.queries_per_second);
            label = 'Queries per Second';
            color = '#f85149';
            break;
        default:
            data = metrics.map(m => m.avg_response_time);
            label = 'Response Time (ms)';
            color = '#58a6ff';
    }

    performanceChart.data.labels = labels.reverse();
    performanceChart.data.datasets[0].data = data.reverse();
    performanceChart.data.datasets[0].label = label;
    performanceChart.data.datasets[0].borderColor = color;
    performanceChart.data.datasets[0].backgroundColor = color + '20';
    performanceChart.data.datasets[0].pointBackgroundColor = color;
    performanceChart.update();
}

function updateAdminAjaxChart(ajaxData) {
    const labels = ajaxData.map(a => a.action_name).slice(0, 10);
    const data = ajaxData.map(a => a.call_count).slice(0, 10);

    adminAjaxChart.data.labels = labels;
    adminAjaxChart.data.datasets[0].data = data;
    adminAjaxChart.update();
}

function displaySlowQueries(queries) {
    // Use ContentUpdateManager for proper scroll preservation and cleanup
    if (window.contentUpdateManager) {
        window.contentUpdateManager.updateContainer('slowQueries', (data) => {
            const container = document.getElementById('slowQueries');
            const countElement = document.getElementById('slow-query-count');

            // Update count element outside of scrollable container
            if (countElement) {
                countElement.textContent = `${data.length} queries`;
            }

            // Perform atomic update with complete replacement
            if (data.length === 0) {
                container.innerHTML = '<div class="no-data">No slow queries detected 🎉</div>';
                return;
            }

            // Generate new content completely replacing old content
            const newContent = data.map(query => `
                <div class="query-item">
                    <div class="query-header">
                        <strong>Query:</strong>
                        <span class="query-time">${query.execution_time}ms</span>
                    </div>
                    <div class="query-text">${query.query_text.substring(0, 150)}${query.query_text.length > 150 ? '...' : ''}</div>
                    <div class="query-meta">
                        <span>📊 ${query.rows_examined} rows</span> |
                        <span>📁 ${query.source_file || 'Unknown'}</span>
                    </div>
                </div>
            `).join('');

            // Atomic replacement to prevent accumulation
            container.innerHTML = newContent;
            
            console.debug(`displaySlowQueries: Updated container with ${data.length} queries`);
        }, queries, {
            preserveScroll: true,
            cleanupRequired: true
        }).catch(error => {
            console.error('Error updating slow queries with ContentUpdateManager:', error);
            // Fallback to direct update on error
            displaySlowQueriesFallback(queries);
        });
    } else {
        console.warn('ContentUpdateManager not available, using fallback implementation');
        displaySlowQueriesFallback(queries);
    }
}

/**
 * Fallback implementation for displaySlowQueries when ContentUpdateManager is not available
 * @param {Array} queries - Array of slow query objects
 */
function displaySlowQueriesFallback(queries) {
    const container = document.getElementById('slowQueries');
    const countElement = document.getElementById('slow-query-count');

    if (!container) {
        console.error('displaySlowQueriesFallback: slowQueries container not found');
        return;
    }

    // Clean up any existing event listeners or resources
    if (window.DOMCleanup) {
        window.DOMCleanup.cleanupContainer(container);
    }

    // Update count element
    if (countElement) {
        countElement.textContent = `${queries.length} queries`;
    }

    if (queries.length === 0) {
        container.innerHTML = '<div class="no-data">No slow queries detected 🎉</div>';
        return;
    }

    // Atomic replacement to prevent accumulation
    container.innerHTML = queries.map(query => `
        <div class="query-item">
            <div class="query-header">
                <strong>Query:</strong>
                <span class="query-time">${query.execution_time}ms</span>
            </div>
            <div class="query-text">${query.query_text.substring(0, 150)}${query.query_text.length > 150 ? '...' : ''}</div>
            <div class="query-meta">
                <span>📊 ${query.rows_examined} rows</span> |
                <span>📁 ${query.source_file || 'Unknown'}</span>
            </div>
        </div>
    `).join('');

    console.debug(`displaySlowQueriesFallback: Updated container with ${queries.length} queries`);
}

function displayPluginPerformance(plugins) {
    // Use ContentUpdateManager for proper scroll preservation and cleanup
    if (window.contentUpdateManager) {
        window.contentUpdateManager.updateContainer('pluginPerformance', (data) => {
            const container = document.getElementById('pluginPerformance');
            const countElement = document.getElementById('plugin-count');

            // Update count element outside of scrollable container
            if (countElement) {
                countElement.textContent = `${data.length} plugins`;
            }

            // Perform atomic update with complete replacement
            if (data.length === 0) {
                container.innerHTML = '<div class="no-data">No plugin data available</div>';
                return;
            }

            // Generate new content completely replacing old content
            const newContent = data.map(plugin => {
                const impactColor = plugin.impact_score > 70 ? '#f85149' :
                                   plugin.impact_score > 40 ? '#f9826c' : '#238636';

                return `
                    <div class="plugin-item">
                        <div class="plugin-main">
                            <strong>${plugin.plugin_name}</strong>
                            <span class="plugin-impact" style="color: ${impactColor}">
                                ${plugin.impact_score}/100
                            </span>
                        </div>
                        <div class="plugin-stats">
                            <span>💾 ${plugin.memory_usage}MB</span>
                            <span>🔍 ${plugin.query_count} queries</span>
                            <span>⚡ ${plugin.load_time}ms</span>
                        </div>
                    </div>
                `;
            }).join('');

            // Atomic replacement to prevent accumulation
            container.innerHTML = newContent;
            
            console.debug(`displayPluginPerformance: Updated container with ${data.length} plugins`);
        }, plugins, {
            preserveScroll: true,
            cleanupRequired: true
        }).catch(error => {
            console.error('Error updating plugin performance with ContentUpdateManager:', error);
            // Fallback to direct update on error
            displayPluginPerformanceFallback(plugins);
        });
    } else {
        console.warn('ContentUpdateManager not available, using fallback implementation');
        displayPluginPerformanceFallback(plugins);
    }
}

/**
 * Fallback implementation for displayPluginPerformance when ContentUpdateManager is not available
 * @param {Array} plugins - Array of plugin performance objects
 */
function displayPluginPerformanceFallback(plugins) {
    const container = document.getElementById('pluginPerformance');
    const countElement = document.getElementById('plugin-count');

    if (!container) {
        console.error('displayPluginPerformanceFallback: pluginPerformance container not found');
        return;
    }

    // Clean up any existing event listeners or resources
    if (window.DOMCleanup) {
        window.DOMCleanup.cleanupContainer(container);
    }

    // Update count element
    if (countElement) {
        countElement.textContent = `${plugins.length} plugins`;
    }

    if (plugins.length === 0) {
        container.innerHTML = '<div class="no-data">No plugin data available</div>';
        return;
    }

    // Atomic replacement to prevent accumulation
    container.innerHTML = plugins.map(plugin => {
        const impactColor = plugin.impact_score > 70 ? '#f85149' :
                           plugin.impact_score > 40 ? '#f9826c' : '#238636';

        return `
            <div class="plugin-item">
                <div class="plugin-main">
                    <strong>${plugin.plugin_name}</strong>
                    <span class="plugin-impact" style="color: ${impactColor}">
                        ${plugin.impact_score}/100
                    </span>
                </div>
                <div class="plugin-stats">
                    <span>💾 ${plugin.memory_usage}MB</span>
                    <span>🔍 ${plugin.query_count} queries</span>
                    <span>⚡ ${plugin.load_time}ms</span>
                </div>
            </div>
        `;
    }).join('');

    console.debug(`displayPluginPerformanceFallback: Updated container with ${plugins.length} plugins`);
}

function updateSystemHealth(health) {
    document.getElementById('health-slow-queries').textContent = health.slow_queries_1h || 0;
    document.getElementById('health-avg-response').textContent = Math.round(health.avg_response_time || 0) + 'ms';
    document.getElementById('health-active-plugins').textContent = health.active_plugins || 0;
    document.getElementById('health-status').textContent = health.status || 'Unknown';

    const cpuElement = document.getElementById('health-cpu-usage');
    const memoryElement = document.getElementById('health-memory-usage');
    const diskElement = document.getElementById('health-disk-usage');
    const cacheElement = document.getElementById('health-cache-hit');

    if (cpuElement) {
        cpuElement.textContent = `${Math.round(health.cpu_usage || 0)}%`;
    }

    if (memoryElement) {
        const memoryUsed = health.memory_used || 0;
        const memoryTotal = health.memory_total || 0;
        const memoryPercent = health.memory_usage_percent || (memoryTotal ? (memoryUsed / memoryTotal) * 100 : 0);
        const usedDisplay = memoryUsed ? `${Math.round(memoryUsed)}MB` : '0MB';
        const totalDisplay = memoryTotal ? `${Math.round(memoryTotal)}MB` : '0MB';
        memoryElement.textContent = `${usedDisplay} / ${totalDisplay} (${Math.round(memoryPercent)}%)`;
    }

    if (diskElement) {
        diskElement.textContent = `${Math.round(health.disk_usage || 0)}%`;
    }

    if (cacheElement) {
        cacheElement.textContent = `${Math.round(health.cache_hit_ratio || 0)}%`;
    }
}

function updateRecommendations(health, queries, plugins) {
    const container = document.getElementById('recommendations');
    if (!container) {
        return;
    }

    const recommendations = [];
    const slowQueryCount = health?.slow_queries_1h || (queries ? queries.length : 0);
    const avgResponse = health?.avg_response_time || 0;
    const cpuUsage = health?.cpu_usage || 0;
    const memoryPercent = health?.memory_usage_percent || 0;
    const cacheHitRatio = health?.cache_hit_ratio || 0;

    if (slowQueryCount > 0) {
        recommendations.push({
            type: 'warning',
            icon: '⚠️',
            title: 'Query Optimization',
            message: `${slowQueryCount} slow queries detected in the selected time range. Review indexes and reduce full table scans.`
        });
    }

    if (avgResponse > 2000) {
        recommendations.push({
            type: 'warning',
            icon: '⏱️',
            title: 'High Response Time',
            message: `Average response time is ${Math.round(avgResponse)}ms. Consider caching and backend profiling.`
        });
    }

    const highImpactPlugins = (plugins || []).filter(plugin => (plugin.impact_score || 0) > 70);
    if (highImpactPlugins.length > 0) {
        recommendations.push({
            type: 'info',
            icon: '🔌',
            title: 'Plugin Review',
            message: `${highImpactPlugins.length} high-impact plugins detected. Review plugin necessity or optimize settings.`
        });
    }

    if (cacheHitRatio > 0 && cacheHitRatio < 80) {
        recommendations.push({
            type: 'info',
            icon: '🧊',
            title: 'Caching Strategy',
            message: `Cache hit ratio is ${Math.round(cacheHitRatio)}%. Consider enabling object caching (Redis/Memcached).`
        });
    }

    if (cpuUsage > 80 || memoryPercent > 80) {
        recommendations.push({
            type: 'warning',
            icon: '🔥',
            title: 'Resource Pressure',
            message: `Resource usage is elevated (CPU ${Math.round(cpuUsage)}%, Memory ${Math.round(memoryPercent)}%). Consider scaling resources.`
        });
    }

    if (recommendations.length === 0) {
        recommendations.push({
            type: 'success',
            icon: '✅',
            title: 'All Clear',
            message: 'No critical performance issues detected for the selected time range.'
        });
    }

    container.innerHTML = recommendations.map(rec => `
        <div class="recommendation ${rec.type}">
            <div class="recommendation-icon">${rec.icon}</div>
            <div class="recommendation-content">
                <strong>${rec.title}:</strong>
                <p>${rec.message}</p>
            </div>
        </div>
    `).join('');
}

// Memory leak prevention for real-time updates
let realTimeUpdateInProgress = false;
let lastRealTimeUpdate = 0;
const REAL_TIME_THROTTLE_MS = 1000; // Throttle real-time updates to prevent excessive DOM manipulation

// Socket.IO real-time updates with memory leak prevention
socket.on('real-time-metrics', (data) => {
    // Update demo mode indicator if data includes demo_mode flag
    if (data.demo_mode !== undefined) {
        const demoIndicator = document.getElementById('demo-indicator');
        if (data.demo_mode && demoIndicator) {
            demoIndicator.style.display = 'flex';
        }
    }

    // Throttle updates to prevent memory leaks from rapid successive updates
    const now = Date.now();
    if (realTimeUpdateInProgress || (now - lastRealTimeUpdate) < REAL_TIME_THROTTLE_MS) {
        console.debug('Real-time update throttled to prevent memory leaks');
        return;
    }

    realTimeUpdateInProgress = true;
    lastRealTimeUpdate = now;

    try {
        // Use throttling for real-time updates to prevent excessive DOM manipulation
        if (window.contentUpdateManager) {
            window.contentUpdateManager.updateContainer('real-time-metrics', (metricsData) => {
                updateRealTimeMetricsCore(metricsData);
                console.debug('Real-time metrics updated via ContentUpdateManager');
            }, data, {
                preserveScroll: false, // Gauges don't need scroll preservation
                cleanupRequired: true, // Enable cleanup for memory leak prevention
                priority: 'high' // Real-time updates should have higher priority
            }).catch(error => {
                console.error('Error updating real-time metrics with ContentUpdateManager:', error);
                // Fallback to direct update
                updateRealTimeMetricsFallback(data);
            }).finally(() => {
                realTimeUpdateInProgress = false;
            });
        } else {
            // Fallback to direct update with memory leak prevention
            updateRealTimeMetricsFallback(data);
            realTimeUpdateInProgress = false;
        }
    } catch (error) {
        console.error('Error in real-time metrics handler:', error);
        realTimeUpdateInProgress = false;
    }
});

/**
 * Core function for updating real-time metrics with memory leak prevention
 * @param {Object} metricsData - Metrics data
 */
function updateRealTimeMetricsCore(metricsData) {
    try {
        // Clean up any existing dynamic elements before updating
        cleanupDynamicElements();

        // Update gauge values with safe DOM manipulation
        updateGaugeValues(metricsData);

        // Update Chart.js gauges with proper cleanup
        updateChartGauges(metricsData);

    } catch (error) {
        console.error('Error in updateRealTimeMetricsCore:', error);
        throw error; // Re-throw to be handled by caller
    }
}

/**
 * Update gauge text values with memory leak prevention
 * @param {Object} data - Metrics data
 */
function updateGaugeValues(data) {
    const elements = [
        { id: 'qps-value', value: Math.round(data.queries_per_second || 0), suffix: '' },
        { id: 'response-value', value: Math.round(data.avg_response_time || 0), suffix: 'ms' },
        { id: 'memory-value', value: Math.round(data.memory_usage || 0), suffix: 'MB' }
    ];

    elements.forEach(({ id, value, suffix }) => {
        const element = document.getElementById(id);
        if (element) {
            // Use textContent instead of innerHTML to prevent XSS and memory leaks
            element.textContent = value + suffix;
        }
    });
}

/**
 * Update Chart.js gauges with proper cleanup
 * @param {Object} data - Metrics data
 */
function updateChartGauges(data) {
    const gaugeUpdates = [
        { chart: qpsGauge, value: data.queries_per_second || 0, max: 100 },
        { chart: responseGauge, value: data.avg_response_time || 0, max: 1000 },
        { chart: memoryGauge, value: data.memory_usage || 0, max: 512 }
    ];

    gaugeUpdates.forEach(({ chart, value, max }) => {
        if (chart && chart.data && chart.data.datasets && chart.data.datasets[0]) {
            try {
                // Use 'none' animation mode to prevent memory leaks from animation objects
                updateGauge(chart, value, max);
            } catch (error) {
                console.error('Error updating gauge:', error);
                // Continue with other gauges even if one fails
            }
        }
    });
}

/**
 * Clean up any dynamically created elements that might cause memory leaks
 */
function cleanupDynamicElements() {
    // Remove any orphaned notification elements that might have accumulated
    const notifications = document.querySelectorAll('.notification');
    notifications.forEach(notification => {
        // Only remove notifications older than 10 seconds to prevent interference with active ones
        const createdTime = notification.dataset.created;
        if (createdTime && (Date.now() - parseInt(createdTime)) > 10000) {
            try {
                notification.remove();
            } catch (error) {
                console.debug('Error removing old notification:', error);
            }
        }
    });

    // Clean up any temporary elements that might have been created
    const tempElements = document.querySelectorAll('[data-temp="true"]');
    tempElements.forEach(element => {
        try {
            element.remove();
        } catch (error) {
            console.debug('Error removing temporary element:', error);
        }
    });
}

/**
 * Fallback function for real-time metrics updates with memory leak prevention
 * @param {Object} data - Metrics data
 */
function updateRealTimeMetricsFallback(data) {
    try {
        // Use the same core function to ensure consistent behavior
        updateRealTimeMetricsCore(data);
        console.debug('Real-time metrics updated via fallback');
    } catch (error) {
        console.error('Error in real-time metrics fallback:', error);
        
        // Last resort: basic updates without advanced features
        try {
            const qpsElement = document.getElementById('qps-value');
            const responseElement = document.getElementById('response-value');
            const memoryElement = document.getElementById('memory-value');

            if (qpsElement) qpsElement.textContent = Math.round(data.queries_per_second || 0);
            if (responseElement) responseElement.textContent = Math.round(data.avg_response_time || 0) + 'ms';
            if (memoryElement) memoryElement.textContent = Math.round(data.memory_usage || 0) + 'MB';

            console.debug('Real-time metrics updated via basic fallback');
        } catch (basicError) {
            console.error('Critical error in basic fallback:', basicError);
        }
    }
}

socket.on('connect', () => {
    document.getElementById('connection-status').style.background = '#238636';
    console.log('Connected to real-time monitoring');
});

socket.on('disconnect', () => {
    document.getElementById('connection-status').style.background = '#f85149';
    console.log('Disconnected from real-time monitoring');
});

// Store interval IDs for cleanup
let dataRefreshInterval = null;

// Event listeners
document.addEventListener('DOMContentLoaded', () => {
    initCharts();
    initDemoMode();
    
    // Initialize performance monitoring
    if (window.performanceMonitor) {
        console.log('Initializing performance monitoring...');
        window.performanceMonitor.startMonitoring({
            memoryFrequency: 15000, // Check memory every 15 seconds
            enableMemoryAlerts: true,
            enableFrequencyBenchmarking: true
        });
        
        // Set up performance monitoring event handlers
        window.addEventListener('memoryAlert', (event) => {
            const { level, measurement } = event.detail;
            const memoryMB = measurement.memory.usedJSHeapSize ? 
                (measurement.memory.usedJSHeapSize / 1024 / 1024).toFixed(1) : 'unknown';
            
            if (level === 'critical') {
                showNotification(`🚨 Critical memory usage: ${memoryMB}MB`, 'error');
            } else if (level === 'warning') {
                showNotification(`⚠️ High memory usage: ${memoryMB}MB`, 'warning');
            }
        });
        
        // Log performance report every 5 minutes
        setInterval(() => {
            const report = window.performanceMonitor.getPerformanceReport();
            console.log('Performance Report:', report);
            
            const recommendations = window.performanceMonitor.generateOptimizationRecommendations();
            if (recommendations.length > 0) {
                console.warn('Performance Recommendations:', recommendations);
            }
        }, 5 * 60 * 1000); // 5 minutes
    } else {
        console.warn('Performance monitor not available');
    }
    
    loadDashboardData();

    // Metric toggle buttons
    document.querySelectorAll('.metric-toggle').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.metric-toggle').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            currentMetric = e.target.dataset.metric;
            loadDashboardData();
        });
    });

    // Refresh button
    document.getElementById('refreshBtn').addEventListener('click', () => {
        loadDashboardData();
        showNotification('Dashboard refreshed!');
    });

    // Time range selector
    document.getElementById('timeRange').addEventListener('change', (e) => {
        loadDashboardData();
        showNotification(`Time range changed to: ${e.target.options[e.target.selectedIndex].text}`);
    });

    // Refresh data every 30 seconds with cleanup tracking
    dataRefreshInterval = setInterval(loadDashboardData, 30000);
});

// Memory leak prevention: cleanup on page unload
window.addEventListener('beforeunload', () => {
    cleanupResources();
});

// Also cleanup on visibility change (when tab becomes hidden)
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        // Page is hidden, perform lightweight cleanup
        cleanupDynamicElements();
    }
});

/**
 * Clean up all resources to prevent memory leaks
 */
function cleanupResources() {
    try {
        // Clear intervals
        if (dataRefreshInterval) {
            clearInterval(dataRefreshInterval);
            dataRefreshInterval = null;
        }

        // Destroy Chart.js instances
        if (performanceChart) {
            performanceChart.destroy();
            performanceChart = null;
        }
        if (adminAjaxChart) {
            adminAjaxChart.destroy();
            adminAjaxChart = null;
        }
        if (qpsGauge) {
            qpsGauge.destroy();
            qpsGauge = null;
        }
        if (responseGauge) {
            responseGauge.destroy();
            responseGauge = null;
        }
        if (memoryGauge) {
            memoryGauge.destroy();
            memoryGauge = null;
        }

        // Disconnect socket
        if (socket) {
            socket.disconnect();
        }

        // Clean up any remaining dynamic elements
        cleanupDynamicElements();

        // Clear any remaining timeouts from notifications
        document.querySelectorAll('.notification').forEach(notification => {
            const timeoutId = notification.dataset.timeoutId;
            if (timeoutId) {
                clearTimeout(parseInt(timeoutId));
            }
            try {
                notification.remove();
            } catch (error) {
                console.debug('Error removing notification during cleanup:', error);
            }
        });

        console.log('Resources cleaned up successfully');
    } catch (error) {
        console.error('Error during resource cleanup:', error);
    }
}

// Utility functions
function showError(message, error = null) {
    // Enhanced error message with details if available
    let enhancedMessage = message;
    
    if (error && error.message) {
        enhancedMessage += ` (${error.message})`;
    }
    
    // Create notification with longer duration for errors
    const notification = createNotification(enhancedMessage, 'error', 8000);
    
    // Add error class for enhanced styling
    notification.classList.add('error-notification');
    
    // Add retry button for dashboard loading errors
    if (message.includes('dashboard data') || message.includes('loading')) {
        const retryButton = document.createElement('button');
        retryButton.textContent = 'Retry Now';
        retryButton.className = 'retry-button';
        retryButton.style.cssText = `
            margin-left: 10px;
            padding: 4px 8px;
            background: rgba(255, 255, 255, 0.2);
            border: 1px solid rgba(255, 255, 255, 0.3);
            border-radius: 4px;
            color: white;
            cursor: pointer;
            font-size: 12px;
        `;
        
        retryButton.addEventListener('click', (e) => {
            e.stopPropagation();
            console.log('Manual retry triggered by user');
            loadDashboardData();
            notification.remove();
        });
        
        notification.appendChild(retryButton);
    }
    
    document.body.appendChild(notification);
    
    // Log detailed error information for debugging
    if (error) {
        console.error('Enhanced error details:', {
            message: message,
            error: error,
            stack: error.stack,
            timestamp: new Date().toISOString()
        });
    }
}

function showNotification(message) {
    const notification = createNotification(message, 'success', 3000);
    document.body.appendChild(notification);
}

/**
 * Create a notification element with proper cleanup to prevent memory leaks
 * @param {string} message - Notification message
 * @param {string} type - Notification type ('success' or 'error')
 * @param {number} duration - Duration in milliseconds
 * @returns {HTMLElement} - Notification element
 */
function createNotification(message, type, duration) {
    // Clean up old notifications first to prevent accumulation
    const existingNotifications = document.querySelectorAll('.notification');
    if (existingNotifications.length > 3) {
        // Remove oldest notifications if we have too many
        existingNotifications.forEach((notification, index) => {
            if (index < existingNotifications.length - 3) {
                try {
                    notification.remove();
                } catch (error) {
                    console.debug('Error removing old notification:', error);
                }
            }
        });
    }

    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    notification.dataset.created = Date.now().toString();

    // Use a more robust cleanup mechanism
    const timeoutId = setTimeout(() => {
        try {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        } catch (error) {
            console.debug('Error removing notification:', error);
        }
    }, duration);

    // Store timeout ID for potential cleanup
    notification.dataset.timeoutId = timeoutId;

    // Add cleanup on manual removal
    notification.addEventListener('click', () => {
        try {
            clearTimeout(timeoutId);
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        } catch (error) {
            console.debug('Error removing notification on click:', error);
        }
    });

    return notification;
}

// Add notification styles
const style = document.createElement('style');
style.textContent = `
    .notification {
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 12px 20px;
        border-radius: 8px;
        color: white;
        font-weight: 600;
        z-index: 1000;
        animation: slideIn 0.3s ease;
    }

    .notification.success {
        background: #238636;
        border: 1px solid #2ea043;
    }

    .notification.error {
        background: #f85149;
        border: 1px solid #ff6b6b;
    }

    @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }

    .no-data {
        text-align: center;
        padding: 40px;
        color: #8b949e;
        font-style: italic;
    }

    .query-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 8px;
    }

    .query-text {
        font-family: 'JetBrains Mono', 'Fira Code', monospace;
        font-size: 12px;
        line-height: 1.4;
        color: #8b949e;
        margin-bottom: 8px;
        word-break: break-word;
    }

    .query-meta {
        font-size: 11px;
        color: #6e7681;
    }

    .plugin-main {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 8px;
    }
`;
document.head.appendChild(style);

// Demo Mode Functions
async function checkDemoStatus() {
    try {
        const response = await fetch('/api/demo-status');
        const status = await response.json();
        
        demoStatus = status;
        updateDemoUI(status);
        
        console.log('Demo status:', status);
        return status;
    } catch (error) {
        console.error('Error checking demo status:', error);
        demoStatus = { available: false, services: {} };
        updateDemoUI(demoStatus);
        return demoStatus;
    }
}

function updateDemoUI(status) {
    const demoIndicator = document.getElementById('demo-indicator');
    const demoControls = document.getElementById('demo-controls');
    const demoStatusElement = document.getElementById('demo-status');
    const demoToggle = document.getElementById('demo-toggle');
    
    if (status.available || status.mode === 'active') {
        // Show demo controls
        if (demoControls) demoControls.style.display = 'flex';
        
        // Update demo indicator
        if (demoIndicator && status.mode === 'active') {
            demoIndicator.style.display = 'flex';
            if (demoStatusElement) {
                demoStatusElement.textContent = `Connected • ${status.demoDataCount || 0} posts`;
            }
        }
        
        // Update toggle button
        if (demoToggle) {
            if (demoMode || status.mode === 'active') {
                demoToggle.textContent = 'Switch to Live';
                demoToggle.classList.add('active');
            } else {
                demoToggle.textContent = 'Switch to Demo';
                demoToggle.classList.remove('active');
            }
        }
    } else {
        // Hide demo controls if not available
        if (demoControls) demoControls.style.display = 'none';
        if (demoIndicator) demoIndicator.style.display = 'none';
    }
}

function toggleDemoMode() {
    demoMode = !demoMode;
    
    // Update UI immediately
    const demoIndicator = document.getElementById('demo-indicator');
    const demoToggle = document.getElementById('demo-toggle');
    
    if (demoMode) {
        if (demoIndicator) demoIndicator.style.display = 'flex';
        if (demoToggle) {
            demoToggle.textContent = 'Switch to Live';
            demoToggle.classList.add('active');
        }
    } else {
        if (demoIndicator) demoIndicator.style.display = 'none';
        if (demoToggle) {
            demoToggle.textContent = 'Switch to Demo';
            demoToggle.classList.remove('active');
        }
    }
    
    // Reload dashboard data with new mode
    loadDashboardData();
    
    console.log(`Switched to ${demoMode ? 'demo' : 'live'} mode`);
}

async function refreshDemoData() {
    const refreshBtn = document.getElementById('demo-refresh');
    if (!refreshBtn) return;
    
    try {
        refreshBtn.disabled = true;
        refreshBtn.classList.add('loading');
        
        const response = await fetch('/api/demo-refresh', { method: 'POST' });
        const result = await response.json();
        
        if (result.success) {
            // Show success message
            showNotification('Demo data refreshed successfully!', 'success');
            
            // Reload dashboard data after a short delay
            setTimeout(() => {
                loadDashboardData();
            }, 1000);
        } else {
            showNotification(`Demo refresh failed: ${result.error}`, 'error');
        }
    } catch (error) {
        console.error('Error refreshing demo data:', error);
        showNotification('Failed to refresh demo data', 'error');
    } finally {
        refreshBtn.disabled = false;
        refreshBtn.classList.remove('loading');
    }
}

function showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    
    // Add styles
    Object.assign(notification.style, {
        position: 'fixed',
        top: '20px',
        right: '20px',
        padding: '12px 20px',
        borderRadius: '6px',
        color: '#fff',
        fontWeight: '500',
        zIndex: '10000',
        animation: 'slideIn 0.3s ease-out',
        maxWidth: '300px',
        wordWrap: 'break-word'
    });
    
    // Set background color based on type
    switch (type) {
        case 'success':
            notification.style.background = '#28a745';
            break;
        case 'error':
            notification.style.background = '#dc3545';
            break;
        default:
            notification.style.background = '#17a2b8';
    }
    
    document.body.appendChild(notification);
    
    // Remove after 3 seconds
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease-in';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 3000);
}

// Initialize demo mode functionality
function initDemoMode() {
    // Check demo status on load
    checkDemoStatus();
    
    // Set up periodic demo status checking (every 30 seconds)
    demoCheckInterval = setInterval(checkDemoStatus, 30000);
    
    // Set up event listeners
    const demoToggle = document.getElementById('demo-toggle');
    const demoRefresh = document.getElementById('demo-refresh');
    
    if (demoToggle) {
        demoToggle.addEventListener('click', toggleDemoMode);
    }
    
    if (demoRefresh) {
        demoRefresh.addEventListener('click', refreshDemoData);
    }
}

// Update loadDashboardData to support demo mode
const originalLoadDashboardData = loadDashboardData;

// Export functions for testing
if (typeof global !== 'undefined') {
    global.loadDashboardData = loadDashboardData;
    global.performAtomicCoordinatedUpdates = performAtomicCoordinatedUpdates;
    global.performFallbackUpdates = performFallbackUpdates;
    global.validateDashboardData = validateDashboardData;
    global.performAtomicRollback = performAtomicRollback;
    global.performEmergencyRecovery = performEmergencyRecovery;
    global.logUpdateMetrics = logUpdateMetrics;
    global.logUpdateFailure = logUpdateFailure;
    global.updateSlowQueriesContent = updateSlowQueriesContent;
    global.updatePluginPerformanceContent = updatePluginPerformanceContent;
    global.updateNonScrollableContent = updateNonScrollableContent;
    global.fetchWithRetry = fetchWithRetry;
    global.parseResponseSafely = parseResponseSafely;
    global.showEnhancedError = showEnhancedError;
    global.clearErrorState = clearErrorState;
    global.escapeHtml = escapeHtml;
}
