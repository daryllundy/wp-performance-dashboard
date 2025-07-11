const socket = io();
let performanceChart, adminAjaxChart;
let qpsGauge, responseGauge, memoryGauge;
let currentMetric = 'response_time';

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

// Update gauge with value (0-100)
function updateGauge(chart, value, maxValue = 100) {
    const percentage = Math.min((value / maxValue) * 100, 100);
    chart.data.datasets[0].data = [percentage, 100 - percentage];
    chart.update('none');
}

// Load dashboard data
async function loadDashboardData() {
    try {
        // Load performance metrics
        const metricsResponse = await fetch('/api/metrics');
        const metrics = await metricsResponse.json();

        if (metrics.length > 0) {
            updatePerformanceChart(metrics);
        }

        // Load slow queries
        const queriesResponse = await fetch('/api/slow-queries');
        const queries = await queriesResponse.json();
        displaySlowQueries(queries);

        // Load admin-ajax data
        const ajaxResponse = await fetch('/api/admin-ajax');
        const ajaxData = await ajaxResponse.json();
        updateAdminAjaxChart(ajaxData);

        // Load plugin performance
        const pluginsResponse = await fetch('/api/plugins');
        const plugins = await pluginsResponse.json();
        displayPluginPerformance(plugins);

        // Load system health
        const healthResponse = await fetch('/api/system-health');
        const health = await healthResponse.json();
        updateSystemHealth(health);

    } catch (error) {
        console.error('Error loading dashboard data:', error);
        showError('Failed to load dashboard data. Please check your connection.');
    }
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
    const container = document.getElementById('slowQueries');
    const countElement = document.getElementById('slow-query-count');

    countElement.textContent = `${queries.length} queries`;

    if (queries.length === 0) {
        container.innerHTML = '<div class="no-data">No slow queries detected 🎉</div>';
        return;
    }

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
}

function displayPluginPerformance(plugins) {
    const container = document.getElementById('pluginPerformance');
    const countElement = document.getElementById('plugin-count');

    countElement.textContent = `${plugins.length} plugins`;

    if (plugins.length === 0) {
        container.innerHTML = '<div class="no-data">No plugin data available</div>';
        return;
    }

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
}

function updateSystemHealth(health) {
    document.getElementById('health-slow-queries').textContent = health.slow_queries_1h || 0;
    document.getElementById('health-avg-response').textContent = Math.round(health.avg_response_time || 0) + 'ms';
    document.getElementById('health-active-plugins').textContent = health.active_plugins || 0;
    document.getElementById('health-status').textContent = health.status || 'Unknown';
}

// Socket.IO real-time updates
socket.on('real-time-metrics', (data) => {
    // Update gauge values
    document.getElementById('qps-value').textContent = Math.round(data.queries_per_second || 0);
    document.getElementById('response-value').textContent = Math.round(data.avg_response_time || 0) + 'ms';
    document.getElementById('memory-value').textContent = Math.round(data.memory_usage || 0) + 'MB';

    // Update gauges
    updateGauge(qpsGauge, data.queries_per_second || 0, 100);
    updateGauge(responseGauge, data.avg_response_time || 0, 1000);
    updateGauge(memoryGauge, data.memory_usage || 0, 512);
});

socket.on('connect', () => {
    document.getElementById('connection-status').style.background = '#238636';
    console.log('Connected to real-time monitoring');
});

socket.on('disconnect', () => {
    document.getElementById('connection-status').style.background = '#f85149';
    console.log('Disconnected from real-time monitoring');
});

// Event listeners
document.addEventListener('DOMContentLoaded', () => {
    initCharts();
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

    // Refresh data every 30 seconds
    setInterval(loadDashboardData, 30000);
});

// Utility functions
function showError(message) {
    const notification = document.createElement('div');
    notification.className = 'notification error';
    notification.textContent = message;
    document.body.appendChild(notification);

    setTimeout(() => {
        document.body.removeChild(notification);
    }, 5000);
}

function showNotification(message) {
    const notification = document.createElement('div');
    notification.className = 'notification success';
    notification.textContent = message;
    document.body.appendChild(notification);

    setTimeout(() => {
        document.body.removeChild(notification);
    }, 3000);
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
