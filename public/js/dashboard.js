const socket = io();
let performanceChart, adminAjaxChart;

// Initialize charts
function initCharts() {
    const ctx1 = document.getElementById('performanceChart').getContext('2d');
    performanceChart = new Chart(ctx1, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: 'Query Time (ms)',
                data: [],
                borderColor: '#58a6ff',
                backgroundColor: 'rgba(88, 166, 255, 0.1)',
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    labels: {
                        color: '#f0f6fc'
                    }
                }
            },
            scales: {
                x: {
                    ticks: {
                        color: '#8b949e'
                    },
                    grid: {
                        color: '#30363d'
                    }
                },
                y: {
                    ticks: {
                        color: '#8b949e'
                    },
                    grid: {
                        color: '#30363d'
                    }
                }
            }
        }
    });

    const ctx2 = document.getElementById('adminAjaxChart').getContext('2d');
    adminAjaxChart = new Chart(ctx2, {
        type: 'bar',
        data: {
            labels: [],
            datasets: [{
                label: 'Calls per minute',
                data: [],
                backgroundColor: '#f85149',
                borderColor: '#f85149',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    labels: {
                        color: '#f0f6fc'
                    }
                }
            },
            scales: {
                x: {
                    ticks: {
                        color: '#8b949e'
                    },
                    grid: {
                        color: '#30363d'
                    }
                },
                y: {
                    ticks: {
                        color: '#8b949e'
                    },
                    grid: {
                        color: '#30363d'
                    }
                }
            }
        }
    });
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

    } catch (error) {
        console.error('Error loading dashboard data:', error);
    }
}

function updatePerformanceChart(metrics) {
    const labels = metrics.map(m => new Date(m.timestamp).toLocaleTimeString());
    const data = metrics.map(m => m.avg_execution_time);
    
    performanceChart.data.labels = labels.reverse();
    performanceChart.data.datasets[0].data = data.reverse();
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
    container.innerHTML = queries.map(query => `
        <div class="query-item">
            <strong>Query:</strong> ${query.query_text.substring(0, 100)}...<br>
            <span class="query-time">Time: ${query.execution_time}ms</span> | 
            <span>Rows: ${query.rows_examined}</span> | 
            <span>File: ${query.source_file || 'Unknown'}</span>
        </div>
    `).join('');
}

function displayPluginPerformance(plugins) {
    const container = document.getElementById('pluginPerformance');
    container.innerHTML = plugins.map(plugin => `
        <div class="plugin-item">
            <strong>${plugin.plugin_name}</strong><br>
            <span class="plugin-impact">Impact: ${plugin.impact_score}/100</span> | 
            <span>Memory: ${plugin.memory_usage}MB</span> | 
            <span>Queries: ${plugin.query_count}</span>
        </div>
    `).join('');
}

// Socket.IO real-time updates
socket.on('real-time-metrics', (data) => {
    document.getElementById('queries-per-sec').textContent = data.queries_per_second || '0';
    document.getElementById('avg-response').textContent = (data.avg_response_time || 0) + 'ms';
    document.getElementById('memory-usage').textContent = (data.memory_usage || 0) + 'MB';
});

socket.on('connect', () => {
    document.getElementById('connection-status').style.background = '#238636';
});

socket.on('disconnect', () => {
    document.getElementById('connection-status').style.background = '#f85149';
});

// Initialize dashboard
document.addEventListener('DOMContentLoaded', () => {
    initCharts();
    loadDashboardData();
    
    // Refresh data every 30 seconds
    setInterval(loadDashboardData, 30000);
});
