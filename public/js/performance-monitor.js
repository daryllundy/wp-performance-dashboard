/**
 * Performance Monitor for WordPress Performance Dashboard
 * 
 * This module provides comprehensive performance monitoring and optimization
 * for content update operations, memory usage tracking, and update frequency benchmarking.
 */

/**
 * PerformanceTimer utility class for measuring operation timing
 */
class PerformanceTimer {
    constructor() {
        this.timers = new Map();
        this.measurements = new Map();
        this.benchmarks = new Map();
    }

    /**
     * Start timing an operation
     * @param {string} operationId - Unique identifier for the operation
     * @param {Object} metadata - Additional metadata about the operation
     */
    start(operationId, metadata = {}) {
        const startTime = performance.now();
        this.timers.set(operationId, {
            startTime,
            metadata,
            timestamp: Date.now()
        });
        
        console.debug(`PerformanceTimer: Started timing ${operationId}`);
    }

    /**
     * End timing an operation and record the measurement
     * @param {string} operationId - Unique identifier for the operation
     * @param {Object} additionalData - Additional data to record with the measurement
     * @returns {Object} Timing measurement result
     */
    end(operationId, additionalData = {}) {
        const endTime = performance.now();
        const timerData = this.timers.get(operationId);
        
        if (!timerData) {
            console.warn(`PerformanceTimer: No timer found for ${operationId}`);
            return null;
        }

        const duration = endTime - timerData.startTime;
        const measurement = {
            operationId,
            duration,
            startTime: timerData.startTime,
            endTime,
            timestamp: timerData.timestamp,
            metadata: timerData.metadata,
            ...additionalData
        };

        // Store measurement
        if (!this.measurements.has(operationId)) {
            this.measurements.set(operationId, []);
        }
        this.measurements.get(operationId).push(measurement);

        // Clean up timer
        this.timers.delete(operationId);

        console.debug(`PerformanceTimer: Completed ${operationId} in ${duration.toFixed(2)}ms`);
        return measurement;
    }

    /**
     * Get measurements for a specific operation
     * @param {string} operationId - Operation identifier
     * @param {number} limit - Maximum number of recent measurements to return
     * @returns {Array} Array of measurements
     */
    getMeasurements(operationId, limit = 100) {
        const measurements = this.measurements.get(operationId) || [];
        return measurements.slice(-limit);
    }

    /**
     * Get performance statistics for an operation
     * @param {string} operationId - Operation identifier
     * @param {number} recentCount - Number of recent measurements to analyze
     * @returns {Object} Performance statistics
     */
    getStats(operationId, recentCount = 50) {
        const measurements = this.getMeasurements(operationId, recentCount);
        
        if (measurements.length === 0) {
            return { operationId, count: 0, error: 'No measurements found' };
        }

        const durations = measurements.map(m => m.duration);
        const sorted = durations.sort((a, b) => a - b);
        
        const stats = {
            operationId,
            count: measurements.length,
            min: Math.min(...durations),
            max: Math.max(...durations),
            average: durations.reduce((sum, d) => sum + d, 0) / durations.length,
            median: sorted[Math.floor(sorted.length / 2)],
            p95: sorted[Math.floor(sorted.length * 0.95)],
            p99: sorted[Math.floor(sorted.length * 0.99)],
            recentTrend: this.calculateTrend(measurements.slice(-10)),
            timeRange: {
                start: measurements[0].timestamp,
                end: measurements[measurements.length - 1].timestamp,
                span: measurements[measurements.length - 1].timestamp - measurements[0].timestamp
            }
        };

        return stats;
    }

    /**
     * Calculate performance trend for recent measurements
     * @param {Array} measurements - Array of recent measurements
     * @returns {Object} Trend analysis
     */
    calculateTrend(measurements) {
        if (measurements.length < 3) {
            return { trend: 'insufficient_data', slope: 0 };
        }

        // Simple linear regression to detect trend
        const n = measurements.length;
        const x = measurements.map((_, i) => i);
        const y = measurements.map(m => m.duration);
        
        const sumX = x.reduce((sum, val) => sum + val, 0);
        const sumY = y.reduce((sum, val) => sum + val, 0);
        const sumXY = x.reduce((sum, val, i) => sum + val * y[i], 0);
        const sumXX = x.reduce((sum, val) => sum + val * val, 0);
        
        const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
        
        let trend = 'stable';
        if (slope > 1) trend = 'degrading';
        else if (slope < -1) trend = 'improving';
        
        return { trend, slope: slope.toFixed(3) };
    }

    /**
     * Clear measurements for an operation
     * @param {string} operationId - Operation identifier
     */
    clearMeasurements(operationId) {
        this.measurements.delete(operationId);
        console.debug(`PerformanceTimer: Cleared measurements for ${operationId}`);
    }

    /**
     * Clear all measurements
     */
    clearAll() {
        this.measurements.clear();
        this.timers.clear();
        console.debug('PerformanceTimer: Cleared all measurements');
    }

    /**
     * Get all operation statistics
     * @returns {Object} Statistics for all operations
     */
    getAllStats() {
        const stats = {};
        for (const operationId of this.measurements.keys()) {
            stats[operationId] = this.getStats(operationId);
        }
        return stats;
    }
}

/**
 * MemoryMonitor utility class for tracking memory usage
 */
class MemoryMonitor {
    constructor() {
        this.measurements = [];
        this.monitoringInterval = null;
        this.monitoringFrequency = 10000; // 10 seconds default
        this.maxMeasurements = 1000; // Keep last 1000 measurements
        this.alertThresholds = {
            warning: 50 * 1024 * 1024, // 50MB
            critical: 100 * 1024 * 1024 // 100MB
        };
    }

    /**
     * Take a memory measurement
     * @param {string} context - Context for the measurement
     * @returns {Object} Memory measurement
     */
    measure(context = 'manual') {
        const measurement = {
            timestamp: Date.now(),
            context,
            memory: this.getMemoryInfo()
        };

        this.measurements.push(measurement);
        
        // Keep only recent measurements
        if (this.measurements.length > this.maxMeasurements) {
            this.measurements = this.measurements.slice(-this.maxMeasurements);
        }

        // Check for alerts
        this.checkMemoryAlerts(measurement);

        return measurement;
    }

    /**
     * Get current memory information
     * @returns {Object} Memory information
     */
    getMemoryInfo() {
        const memory = {
            timestamp: Date.now()
        };

        // Use performance.memory if available (Chrome/Edge)
        if (performance.memory) {
            memory.jsHeapSizeLimit = performance.memory.jsHeapSizeLimit;
            memory.totalJSHeapSize = performance.memory.totalJSHeapSize;
            memory.usedJSHeapSize = performance.memory.usedJSHeapSize;
            memory.heapUsagePercent = (memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100;
        }

        // Estimate DOM memory usage
        memory.domNodeCount = document.querySelectorAll('*').length;
        memory.estimatedDOMMemory = memory.domNodeCount * 100; // Rough estimate: 100 bytes per node

        // Get additional browser info if available
        if (navigator.deviceMemory) {
            memory.deviceMemory = navigator.deviceMemory * 1024 * 1024 * 1024; // Convert GB to bytes
        }

        return memory;
    }

    /**
     * Check memory usage against alert thresholds
     * @param {Object} measurement - Memory measurement to check
     */
    checkMemoryAlerts(measurement) {
        const { memory } = measurement;
        
        if (memory.usedJSHeapSize) {
            if (memory.usedJSHeapSize > this.alertThresholds.critical) {
                console.error(`🚨 MemoryMonitor: CRITICAL memory usage: ${(memory.usedJSHeapSize / 1024 / 1024).toFixed(1)}MB (${memory.heapUsagePercent.toFixed(1)}%)`);
                this.triggerMemoryAlert('critical', measurement);
            } else if (memory.usedJSHeapSize > this.alertThresholds.warning) {
                console.warn(`⚠️ MemoryMonitor: HIGH memory usage: ${(memory.usedJSHeapSize / 1024 / 1024).toFixed(1)}MB (${memory.heapUsagePercent.toFixed(1)}%)`);
                this.triggerMemoryAlert('warning', measurement);
            }
        }

        // Check DOM node count
        if (memory.domNodeCount > 10000) {
            console.warn(`⚠️ MemoryMonitor: High DOM node count: ${memory.domNodeCount} nodes`);
        }
    }

    /**
     * Trigger memory alert
     * @param {string} level - Alert level (warning/critical)
     * @param {Object} measurement - Memory measurement
     */
    triggerMemoryAlert(level, measurement) {
        // Dispatch custom event for memory alerts
        const event = new CustomEvent('memoryAlert', {
            detail: { level, measurement }
        });
        window.dispatchEvent(event);
    }

    /**
     * Start continuous memory monitoring
     * @param {number} frequency - Monitoring frequency in milliseconds
     */
    startMonitoring(frequency = this.monitoringFrequency) {
        if (this.monitoringInterval) {
            console.warn('MemoryMonitor: Monitoring already started');
            return;
        }

        this.monitoringFrequency = frequency;
        console.log(`MemoryMonitor: Starting continuous monitoring every ${frequency}ms`);

        this.monitoringInterval = setInterval(() => {
            this.measure('continuous');
        }, frequency);

        // Take initial measurement
        this.measure('monitoring_start');
    }

    /**
     * Stop continuous memory monitoring
     */
    stopMonitoring() {
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
            this.monitoringInterval = null;
            console.log('MemoryMonitor: Stopped continuous monitoring');
        }
    }

    /**
     * Get memory usage statistics
     * @param {number} recentCount - Number of recent measurements to analyze
     * @returns {Object} Memory statistics
     */
    getStats(recentCount = 100) {
        const recent = this.measurements.slice(-recentCount);
        
        if (recent.length === 0) {
            return { error: 'No measurements available' };
        }

        const stats = {
            measurementCount: recent.length,
            timeSpan: recent[recent.length - 1].timestamp - recent[0].timestamp,
            domNodes: {
                current: recent[recent.length - 1].memory.domNodeCount,
                min: Math.min(...recent.map(m => m.memory.domNodeCount)),
                max: Math.max(...recent.map(m => m.memory.domNodeCount)),
                average: recent.reduce((sum, m) => sum + m.memory.domNodeCount, 0) / recent.length
            }
        };

        // Add JS heap stats if available
        const heapMeasurements = recent.filter(m => m.memory.usedJSHeapSize);
        if (heapMeasurements.length > 0) {
            const heapSizes = heapMeasurements.map(m => m.memory.usedJSHeapSize);
            stats.jsHeap = {
                current: heapMeasurements[heapMeasurements.length - 1].memory.usedJSHeapSize,
                min: Math.min(...heapSizes),
                max: Math.max(...heapSizes),
                average: heapSizes.reduce((sum, size) => sum + size, 0) / heapSizes.length,
                currentMB: (heapMeasurements[heapMeasurements.length - 1].memory.usedJSHeapSize / 1024 / 1024).toFixed(1),
                trend: this.calculateMemoryTrend(heapMeasurements.slice(-10))
            };
        }

        return stats;
    }

    /**
     * Calculate memory usage trend
     * @param {Array} measurements - Array of recent measurements
     * @returns {Object} Trend analysis
     */
    calculateMemoryTrend(measurements) {
        if (measurements.length < 3) {
            return { trend: 'insufficient_data', slope: 0 };
        }

        const heapSizes = measurements.map(m => m.memory.usedJSHeapSize);
        const n = heapSizes.length;
        const x = heapSizes.map((_, i) => i);
        
        const sumX = x.reduce((sum, val) => sum + val, 0);
        const sumY = heapSizes.reduce((sum, val) => sum + val, 0);
        const sumXY = x.reduce((sum, val, i) => sum + val * heapSizes[i], 0);
        const sumXX = x.reduce((sum, val) => sum + val * val, 0);
        
        const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
        
        let trend = 'stable';
        const slopeMB = slope / 1024 / 1024; // Convert to MB per measurement
        
        if (slopeMB > 0.5) trend = 'increasing';
        else if (slopeMB < -0.5) trend = 'decreasing';
        
        return { 
            trend, 
            slopeMB: slopeMB.toFixed(3),
            description: `${slopeMB > 0 ? '+' : ''}${slopeMB.toFixed(1)}MB per measurement`
        };
    }

    /**
     * Set memory alert thresholds
     * @param {Object} thresholds - Object with warning and critical thresholds in bytes
     */
    setAlertThresholds(thresholds) {
        this.alertThresholds = { ...this.alertThresholds, ...thresholds };
        console.log('MemoryMonitor: Updated alert thresholds:', this.alertThresholds);
    }

    /**
     * Clear all measurements
     */
    clearMeasurements() {
        this.measurements = [];
        console.log('MemoryMonitor: Cleared all measurements');
    }

    /**
     * Export measurements for analysis
     * @param {number} count - Number of recent measurements to export
     * @returns {Array} Array of measurements
     */
    exportMeasurements(count = 100) {
        return this.measurements.slice(-count);
    }
}

/**
 * UpdateFrequencyBenchmark utility class for analyzing update patterns and performance
 */
class UpdateFrequencyBenchmark {
    constructor() {
        this.updateEvents = new Map(); // containerId -> array of update events
        this.frequencyStats = new Map(); // containerId -> frequency statistics
        this.performanceImpact = new Map(); // containerId -> performance impact data
        this.benchmarkResults = new Map(); // containerId -> benchmark results
    }

    /**
     * Record an update event
     * @param {string} containerId - Container identifier
     * @param {Object} updateData - Update event data
     */
    recordUpdate(containerId, updateData = {}) {
        const event = {
            timestamp: Date.now(),
            containerId,
            ...updateData
        };

        if (!this.updateEvents.has(containerId)) {
            this.updateEvents.set(containerId, []);
        }

        const events = this.updateEvents.get(containerId);
        events.push(event);

        // Keep only recent events (last 1000)
        if (events.length > 1000) {
            this.updateEvents.set(containerId, events.slice(-1000));
        }

        // Update frequency statistics
        this.updateFrequencyStats(containerId);
    }

    /**
     * Update frequency statistics for a container
     * @param {string} containerId - Container identifier
     */
    updateFrequencyStats(containerId) {
        const events = this.updateEvents.get(containerId) || [];
        
        if (events.length < 2) return;

        // Calculate intervals between updates
        const intervals = [];
        for (let i = 1; i < events.length; i++) {
            intervals.push(events[i].timestamp - events[i - 1].timestamp);
        }

        const timeSpan = events[events.length - 1].timestamp - events[0].timestamp;
        const avgInterval = intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length;
        
        const stats = {
            totalUpdates: events.length,
            timeSpan: timeSpan,
            intervals: {
                min: Math.min(...intervals),
                max: Math.max(...intervals),
                average: avgInterval,
                median: this.calculateMedian(intervals)
            },
            frequency: {
                updatesPerMinute: (events.length / (timeSpan / 60000)).toFixed(2),
                averageInterval: avgInterval.toFixed(0)
            },
            recentActivity: this.analyzeRecentActivity(events.slice(-20))
        };

        this.frequencyStats.set(containerId, stats);
    }

    /**
     * Calculate median of an array
     * @param {Array} arr - Array of numbers
     * @returns {number} Median value
     */
    calculateMedian(arr) {
        const sorted = arr.sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
    }

    /**
     * Analyze recent update activity
     * @param {Array} recentEvents - Array of recent update events
     * @returns {Object} Recent activity analysis
     */
    analyzeRecentActivity(recentEvents) {
        if (recentEvents.length < 3) {
            return { pattern: 'insufficient_data' };
        }

        const intervals = [];
        for (let i = 1; i < recentEvents.length; i++) {
            intervals.push(recentEvents[i].timestamp - recentEvents[i - 1].timestamp);
        }

        const avgInterval = intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length;
        const variance = intervals.reduce((sum, interval) => sum + Math.pow(interval - avgInterval, 2), 0) / intervals.length;
        const stdDev = Math.sqrt(variance);
        const coefficient = stdDev / avgInterval;

        let pattern = 'regular';
        if (coefficient > 0.5) pattern = 'irregular';
        else if (coefficient < 0.2) pattern = 'very_regular';

        return {
            pattern,
            averageInterval: avgInterval.toFixed(0),
            variability: coefficient.toFixed(3),
            description: this.getPatternDescription(pattern, avgInterval)
        };
    }

    /**
     * Get human-readable pattern description
     * @param {string} pattern - Pattern type
     * @param {number} avgInterval - Average interval in milliseconds
     * @returns {string} Pattern description
     */
    getPatternDescription(pattern, avgInterval) {
        const intervalSec = (avgInterval / 1000).toFixed(1);
        
        switch (pattern) {
            case 'very_regular':
                return `Very consistent updates every ~${intervalSec}s`;
            case 'regular':
                return `Regular updates every ~${intervalSec}s`;
            case 'irregular':
                return `Irregular update pattern, average ~${intervalSec}s`;
            default:
                return 'Unknown pattern';
        }
    }

    /**
     * Benchmark update frequencies and their performance impact
     * @param {string} containerId - Container identifier
     * @param {Object} performanceData - Performance data from updates
     */
    benchmarkFrequency(containerId, performanceData = {}) {
        const events = this.updateEvents.get(containerId) || [];
        const stats = this.frequencyStats.get(containerId);
        
        if (!stats || events.length < 10) {
            console.warn(`UpdateFrequencyBenchmark: Insufficient data for ${containerId} benchmark`);
            return;
        }

        // Analyze performance impact of different update frequencies
        const benchmark = {
            containerId,
            timestamp: Date.now(),
            updateCount: events.length,
            timeSpan: stats.timeSpan,
            averageFrequency: parseFloat(stats.frequency.updatesPerMinute),
            performanceImpact: this.calculatePerformanceImpact(containerId, performanceData),
            recommendations: this.generateFrequencyRecommendations(containerId, stats, performanceData)
        };

        this.benchmarkResults.set(containerId, benchmark);
        console.log(`UpdateFrequencyBenchmark: Completed benchmark for ${containerId}`, benchmark);
        
        return benchmark;
    }

    /**
     * Calculate performance impact of update frequency
     * @param {string} containerId - Container identifier
     * @param {Object} performanceData - Performance data
     * @returns {Object} Performance impact analysis
     */
    calculatePerformanceImpact(containerId, performanceData) {
        const events = this.updateEvents.get(containerId) || [];
        const stats = this.frequencyStats.get(containerId);
        
        if (!stats) return { error: 'No frequency stats available' };

        const impact = {
            updateFrequency: parseFloat(stats.frequency.updatesPerMinute),
            averageUpdateTime: performanceData.averageUpdateTime || 0,
            totalUpdateTime: (performanceData.averageUpdateTime || 0) * events.length,
            cpuImpactPercent: this.estimateCPUImpact(stats, performanceData),
            memoryImpact: this.estimateMemoryImpact(events.length, performanceData),
            userExperienceImpact: this.assessUserExperienceImpact(stats, performanceData)
        };

        return impact;
    }

    /**
     * Estimate CPU impact of update frequency
     * @param {Object} stats - Frequency statistics
     * @param {Object} performanceData - Performance data
     * @returns {number} Estimated CPU impact percentage
     */
    estimateCPUImpact(stats, performanceData) {
        const updatesPerSecond = parseFloat(stats.frequency.updatesPerMinute) / 60;
        const avgUpdateTime = performanceData.averageUpdateTime || 50; // Default 50ms
        
        // Estimate CPU usage: (updates per second * average update time) / 1000ms * 100%
        const cpuPercent = (updatesPerSecond * avgUpdateTime) / 10; // Simplified calculation
        
        return Math.min(cpuPercent, 100); // Cap at 100%
    }

    /**
     * Estimate memory impact of updates
     * @param {number} updateCount - Number of updates
     * @param {Object} performanceData - Performance data
     * @returns {Object} Memory impact estimation
     */
    estimateMemoryImpact(updateCount, performanceData) {
        const estimatedMemoryPerUpdate = performanceData.memoryPerUpdate || 1024; // Default 1KB per update
        const totalEstimatedMemory = updateCount * estimatedMemoryPerUpdate;
        
        return {
            estimatedMemoryPerUpdate,
            totalEstimatedMemory,
            totalEstimatedMemoryMB: (totalEstimatedMemory / 1024 / 1024).toFixed(2)
        };
    }

    /**
     * Assess user experience impact of update frequency
     * @param {Object} stats - Frequency statistics
     * @param {Object} performanceData - Performance data
     * @returns {Object} User experience impact assessment
     */
    assessUserExperienceImpact(stats, performanceData) {
        const updatesPerMinute = parseFloat(stats.frequency.updatesPerMinute);
        const avgUpdateTime = performanceData.averageUpdateTime || 50;
        
        let impact = 'low';
        let description = 'Updates are infrequent and fast';
        
        if (updatesPerMinute > 30 && avgUpdateTime > 100) {
            impact = 'high';
            description = 'Frequent updates with long duration may cause UI lag';
        } else if (updatesPerMinute > 20 || avgUpdateTime > 200) {
            impact = 'medium';
            description = 'Moderate impact on user experience';
        }
        
        return {
            impact,
            description,
            updatesPerMinute,
            avgUpdateTime
        };
    }

    /**
     * Generate frequency optimization recommendations
     * @param {string} containerId - Container identifier
     * @param {Object} stats - Frequency statistics
     * @param {Object} performanceData - Performance data
     * @returns {Array} Array of recommendations
     */
    generateFrequencyRecommendations(containerId, stats, performanceData) {
        const recommendations = [];
        const updatesPerMinute = parseFloat(stats.frequency.updatesPerMinute);
        const avgUpdateTime = performanceData.averageUpdateTime || 50;
        
        // High frequency recommendations
        if (updatesPerMinute > 20) {
            recommendations.push({
                type: 'frequency_reduction',
                priority: 'high',
                message: `Consider reducing update frequency from ${updatesPerMinute}/min to improve performance`,
                suggestedFrequency: Math.max(10, updatesPerMinute / 2)
            });
        }
        
        // Long update time recommendations
        if (avgUpdateTime > 100) {
            recommendations.push({
                type: 'performance_optimization',
                priority: 'medium',
                message: `Update operations are slow (${avgUpdateTime}ms avg). Consider optimizing update logic`,
                targetTime: 50
            });
        }
        
        // Pattern-based recommendations
        if (stats.recentActivity.pattern === 'irregular') {
            recommendations.push({
                type: 'pattern_optimization',
                priority: 'low',
                message: 'Update pattern is irregular. Consider implementing consistent update intervals',
                suggestion: 'Use fixed intervals or throttling'
            });
        }
        
        // Memory impact recommendations
        const memoryImpact = this.estimateMemoryImpact(stats.totalUpdates, performanceData);
        if (parseFloat(memoryImpact.totalEstimatedMemoryMB) > 10) {
            recommendations.push({
                type: 'memory_optimization',
                priority: 'medium',
                message: `High estimated memory usage (${memoryImpact.totalEstimatedMemoryMB}MB). Consider cleanup optimizations`,
                suggestion: 'Implement more aggressive cleanup or reduce update payload size'
            });
        }
        
        return recommendations;
    }

    /**
     * Get frequency statistics for a container
     * @param {string} containerId - Container identifier
     * @returns {Object} Frequency statistics
     */
    getFrequencyStats(containerId) {
        return this.frequencyStats.get(containerId) || { error: 'No data available' };
    }

    /**
     * Get benchmark results for a container
     * @param {string} containerId - Container identifier
     * @returns {Object} Benchmark results
     */
    getBenchmarkResults(containerId) {
        return this.benchmarkResults.get(containerId) || { error: 'No benchmark data available' };
    }

    /**
     * Get all frequency statistics
     * @returns {Object} All frequency statistics
     */
    getAllFrequencyStats() {
        const stats = {};
        for (const [containerId, data] of this.frequencyStats.entries()) {
            stats[containerId] = data;
        }
        return stats;
    }

    /**
     * Get all benchmark results
     * @returns {Object} All benchmark results
     */
    getAllBenchmarkResults() {
        const results = {};
        for (const [containerId, data] of this.benchmarkResults.entries()) {
            results[containerId] = data;
        }
        return results;
    }

    /**
     * Clear data for a specific container
     * @param {string} containerId - Container identifier
     */
    clearContainer(containerId) {
        this.updateEvents.delete(containerId);
        this.frequencyStats.delete(containerId);
        this.performanceImpact.delete(containerId);
        this.benchmarkResults.delete(containerId);
        console.log(`UpdateFrequencyBenchmark: Cleared data for ${containerId}`);
    }

    /**
     * Clear all data
     */
    clearAll() {
        this.updateEvents.clear();
        this.frequencyStats.clear();
        this.performanceImpact.clear();
        this.benchmarkResults.clear();
        console.log('UpdateFrequencyBenchmark: Cleared all data');
    }

    /**
     * Export benchmark data for analysis
     * @returns {Object} Exported benchmark data
     */
    exportData() {
        return {
            updateEvents: Object.fromEntries(this.updateEvents),
            frequencyStats: Object.fromEntries(this.frequencyStats),
            performanceImpact: Object.fromEntries(this.performanceImpact),
            benchmarkResults: Object.fromEntries(this.benchmarkResults),
            exportTimestamp: Date.now()
        };
    }
}

/**
 * Comprehensive Performance Monitor that integrates all monitoring capabilities
 */
class PerformanceMonitor {
    constructor() {
        this.timer = new PerformanceTimer();
        this.memoryMonitor = new MemoryMonitor();
        this.frequencyBenchmark = new UpdateFrequencyBenchmark();
        this.isMonitoring = false;
        this.monitoringStartTime = null;
    }

    /**
     * Start comprehensive performance monitoring
     * @param {Object} options - Monitoring options
     */
    startMonitoring(options = {}) {
        const {
            memoryFrequency = 10000, // 10 seconds
            enableMemoryAlerts = true,
            enableFrequencyBenchmarking = true
        } = options;

        if (this.isMonitoring) {
            console.warn('PerformanceMonitor: Already monitoring');
            return;
        }

        console.log('PerformanceMonitor: Starting comprehensive performance monitoring');
        
        this.isMonitoring = true;
        this.monitoringStartTime = Date.now();

        // Start memory monitoring
        this.memoryMonitor.startMonitoring(memoryFrequency);

        // Set up memory alert handling
        if (enableMemoryAlerts) {
            window.addEventListener('memoryAlert', this.handleMemoryAlert.bind(this));
        }

        console.log('PerformanceMonitor: Monitoring started successfully');
    }

    /**
     * Stop comprehensive performance monitoring
     */
    stopMonitoring() {
        if (!this.isMonitoring) {
            console.warn('PerformanceMonitor: Not currently monitoring');
            return;
        }

        console.log('PerformanceMonitor: Stopping performance monitoring');
        
        this.memoryMonitor.stopMonitoring();
        this.isMonitoring = false;
        
        const monitoringDuration = Date.now() - this.monitoringStartTime;
        console.log(`PerformanceMonitor: Monitoring stopped after ${(monitoringDuration / 1000).toFixed(1)} seconds`);
    }

    /**
     * Handle memory alerts
     * @param {Event} event - Memory alert event
     */
    handleMemoryAlert(event) {
        const { level, measurement } = event.detail;
        
        console.warn(`PerformanceMonitor: Memory alert (${level}):`, measurement);
        
        // Trigger emergency cleanup for critical alerts
        if (level === 'critical' && window.contentUpdateManager) {
            console.warn('PerformanceMonitor: Triggering emergency cleanup due to critical memory usage');
            window.contentUpdateManager.emergencyStop();
            
            // Resume after cleanup
            setTimeout(() => {
                window.contentUpdateManager.resumeOperations();
            }, 5000);
        }
    }

    /**
     * Instrument a content update operation with comprehensive monitoring
     * @param {string} containerId - Container identifier
     * @param {Function} updateFunction - Update function to instrument
     * @param {*} data - Data for the update
     * @param {Object} options - Monitoring options
     * @returns {Promise} Instrumented update result
     */
    async instrumentUpdate(containerId, updateFunction, data, options = {}) {
        const operationId = `${containerId}_update_${Date.now()}`;
        const startMemory = this.memoryMonitor.measure(`before_${operationId}`);
        
        // Start timing
        this.timer.start(operationId, {
            containerId,
            operation: 'content_update',
            dataSize: JSON.stringify(data || {}).length
        });

        try {
            // Execute the update
            const result = await updateFunction(data);
            
            // End timing
            const timing = this.timer.end(operationId, {
                success: true,
                resultSize: JSON.stringify(result || {}).length
            });

            // Measure memory after update
            const endMemory = this.memoryMonitor.measure(`after_${operationId}`);
            
            // Record update event for frequency analysis
            this.frequencyBenchmark.recordUpdate(containerId, {
                duration: timing.duration,
                memoryBefore: startMemory.memory.usedJSHeapSize,
                memoryAfter: endMemory.memory.usedJSHeapSize,
                memoryDelta: endMemory.memory.usedJSHeapSize - startMemory.memory.usedJSHeapSize,
                success: true
            });

            console.debug(`PerformanceMonitor: Instrumented update for ${containerId} completed in ${timing.duration.toFixed(2)}ms`);
            
            return result;
            
        } catch (error) {
            // End timing with error
            this.timer.end(operationId, {
                success: false,
                error: error.message
            });

            // Record failed update
            this.frequencyBenchmark.recordUpdate(containerId, {
                success: false,
                error: error.message
            });

            console.error(`PerformanceMonitor: Instrumented update for ${containerId} failed:`, error);
            throw error;
        }
    }

    /**
     * Get comprehensive performance report
     * @returns {Object} Complete performance report
     */
    getPerformanceReport() {
        const report = {
            timestamp: Date.now(),
            monitoringDuration: this.isMonitoring ? Date.now() - this.monitoringStartTime : 0,
            isMonitoring: this.isMonitoring,
            timing: this.timer.getAllStats(),
            memory: this.memoryMonitor.getStats(),
            frequency: this.frequencyBenchmark.getAllFrequencyStats(),
            benchmarks: this.frequencyBenchmark.getAllBenchmarkResults()
        };

        return report;
    }

    /**
     * Generate performance optimization recommendations
     * @returns {Array} Array of optimization recommendations
     */
    generateOptimizationRecommendations() {
        const recommendations = [];
        const report = this.getPerformanceReport();

        // Timing-based recommendations
        for (const [operationId, stats] of Object.entries(report.timing)) {
            if (stats.average > 200) {
                recommendations.push({
                    type: 'timing_optimization',
                    priority: 'high',
                    operation: operationId,
                    message: `Operation ${operationId} is slow (${stats.average.toFixed(1)}ms avg)`,
                    suggestion: 'Consider optimizing update logic or reducing payload size'
                });
            }
            
            if (stats.recentTrend.trend === 'degrading') {
                recommendations.push({
                    type: 'performance_degradation',
                    priority: 'medium',
                    operation: operationId,
                    message: `Performance degrading for ${operationId} (slope: ${stats.recentTrend.slope})`,
                    suggestion: 'Monitor for memory leaks or increasing complexity'
                });
            }
        }

        // Memory-based recommendations
        if (report.memory.jsHeap && report.memory.jsHeap.trend.trend === 'increasing') {
            recommendations.push({
                type: 'memory_leak',
                priority: 'high',
                message: `Memory usage trending upward (${report.memory.jsHeap.trend.description})`,
                suggestion: 'Check for memory leaks in update operations'
            });
        }

        // Frequency-based recommendations
        for (const [containerId, benchmarkResult] of Object.entries(report.benchmarks)) {
            if (benchmarkResult.recommendations) {
                recommendations.push(...benchmarkResult.recommendations.map(rec => ({
                    ...rec,
                    containerId
                })));
            }
        }

        return recommendations.sort((a, b) => {
            const priorityOrder = { high: 3, medium: 2, low: 1 };
            return (priorityOrder[b.priority] || 0) - (priorityOrder[a.priority] || 0);
        });
    }

    /**
     * Clear all performance data
     */
    clearAllData() {
        this.timer.clearAll();
        this.memoryMonitor.clearMeasurements();
        this.frequencyBenchmark.clearAll();
        console.log('PerformanceMonitor: Cleared all performance data');
    }

    /**
     * Export all performance data
     * @returns {Object} Exported performance data
     */
    exportData() {
        return {
            report: this.getPerformanceReport(),
            recommendations: this.generateOptimizationRecommendations(),
            rawData: {
                timing: this.timer.measurements,
                memory: this.memoryMonitor.exportMeasurements(),
                frequency: this.frequencyBenchmark.exportData()
            },
            exportTimestamp: Date.now()
        };
    }
}

// Export classes for use in other modules
window.PerformanceTimer = PerformanceTimer;
window.MemoryMonitor = MemoryMonitor;
window.UpdateFrequencyBenchmark = UpdateFrequencyBenchmark;
window.PerformanceMonitor = PerformanceMonitor;

// Create global instance
window.performanceMonitor = new PerformanceMonitor();

console.log('Performance Monitor utilities loaded successfully');

// Global utility functions for debugging and monitoring
window.startPerformanceMonitoring = (options) => {
    console.log('=== Starting Performance Monitoring ===');
    window.performanceMonitor.startMonitoring(options);
};

window.stopPerformanceMonitoring = () => {
    console.log('=== Stopping Performance Monitoring ===');
    window.performanceMonitor.stopMonitoring();
};

window.getPerformanceReport = () => {
    console.log('=== Performance Report ===');
    return window.performanceMonitor.getPerformanceReport();
};

window.getOptimizationRecommendations = () => {
    console.log('=== Optimization Recommendations ===');
    return window.performanceMonitor.generateOptimizationRecommendations();
};

window.exportPerformanceData = () => {
    console.log('=== Exporting Performance Data ===');
    return window.performanceMonitor.exportData();
};

window.clearPerformanceData = () => {
    console.log('=== Clearing Performance Data ===');
    window.performanceMonitor.clearAllData();
};
