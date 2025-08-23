-- Validation Script for MySQL Performance Configuration
-- Run this script to verify that performance monitoring is properly configured

-- Check Performance Schema status
SELECT 
    'Performance Schema Status' as check_type,
    CASE 
        WHEN @@performance_schema = 1 THEN 'ENABLED' 
        ELSE 'DISABLED' 
    END as status;

-- Check enabled consumers
SELECT 
    'Enabled Consumers' as check_type,
    COUNT(*) as enabled_count,
    (SELECT COUNT(*) FROM performance_schema.setup_consumers) as total_count
FROM performance_schema.setup_consumers 
WHERE ENABLED = 'YES';

-- Check enabled instruments
SELECT 
    'Enabled Instruments' as check_type,
    COUNT(*) as enabled_count,
    (SELECT COUNT(*) FROM performance_schema.setup_instruments) as total_count
FROM performance_schema.setup_instruments 
WHERE ENABLED = 'YES';

-- Check slow query log status
SHOW VARIABLES LIKE 'slow_query_log';
SHOW VARIABLES LIKE 'long_query_time';
SHOW VARIABLES LIKE 'log_queries_not_using_indexes';

-- Check general log status
SHOW VARIABLES LIKE 'general_log';

-- Verify custom performance tables exist
SELECT 
    'Custom Performance Tables' as check_type,
    TABLE_NAME,
    TABLE_ROWS
FROM information_schema.TABLES 
WHERE TABLE_SCHEMA = 'demo_wordpress' 
AND TABLE_NAME LIKE 'wp_%performance%' 
OR TABLE_NAME LIKE 'wp_%metrics%'
OR TABLE_NAME LIKE 'wp_%stats%'
OR TABLE_NAME LIKE 'wp_%usage%';

-- Check if performance views exist
SELECT 
    'Performance Views' as check_type,
    TABLE_NAME as view_name
FROM information_schema.VIEWS 
WHERE TABLE_SCHEMA = 'demo_wordpress' 
AND TABLE_NAME LIKE 'v_%';

-- Check stored procedures
SELECT 
    'Stored Procedures' as check_type,
    ROUTINE_NAME as procedure_name,
    ROUTINE_TYPE
FROM information_schema.ROUTINES 
WHERE ROUTINE_SCHEMA = 'demo_wordpress';

-- Sample data verification
SELECT 'Performance Logs Sample' as check_type, COUNT(*) as record_count FROM wp_performance_logs;
SELECT 'Slow Queries Sample' as check_type, COUNT(*) as record_count FROM wp_slow_queries;
SELECT 'Plugin Performance Sample' as check_type, COUNT(*) as record_count FROM wp_plugin_performance;
SELECT 'AJAX Calls Sample' as check_type, COUNT(*) as record_count FROM wp_ajax_calls;
SELECT 'Realtime Metrics Sample' as check_type, COUNT(*) as record_count FROM wp_realtime_metrics;
SELECT 'Connection Stats Sample' as check_type, COUNT(*) as record_count FROM wp_connection_stats;
SELECT 'Memory Usage Sample' as check_type, COUNT(*) as record_count FROM wp_memory_usage;

-- Test performance schema data collection
SELECT 
    'Recent Statement Events' as check_type,
    COUNT(*) as event_count
FROM performance_schema.events_statements_history_long 
WHERE TIMER_START > (SELECT MAX(TIMER_START) - 1000000000000 FROM performance_schema.events_statements_history_long);

-- Show current performance metrics
SELECT * FROM v_realtime_dashboard ORDER BY category, metric_name;
