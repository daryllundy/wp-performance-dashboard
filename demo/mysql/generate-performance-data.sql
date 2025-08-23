-- Generate Ongoing Performance Data for Demo
-- This script can be run periodically to simulate realistic performance data

USE demo_wordpress;

-- Insert current performance metrics
INSERT INTO wp_realtime_metrics (metric_name, metric_value, metric_unit, category) VALUES
('queries_per_second', ROUND(RAND() * 50 + 20, 2), 'qps', 'database'),
('avg_query_time', ROUND(RAND() * 0.1 + 0.01, 4), 'seconds', 'database'),
('memory_usage', ROUND(RAND() * 30 + 50, 1), 'percent', 'system'),
('cpu_usage', ROUND(RAND() * 40 + 10, 1), 'percent', 'system'),
('active_connections', FLOOR(RAND() * 20 + 5), 'count', 'database'),
('cache_hit_ratio', ROUND(RAND() * 20 + 75, 1), 'percent', 'cache'),
('page_load_time', ROUND(RAND() * 2 + 0.5, 3), 'seconds', 'frontend'),
('plugin_load_time', ROUND(RAND() * 0.5 + 0.1, 3), 'seconds', 'plugins'),
('theme_load_time', ROUND(RAND() * 0.3 + 0.05, 3), 'seconds', 'theme');

-- Insert random performance logs
INSERT INTO wp_performance_logs (query_type, execution_time, query_hash, affected_rows, plugin_context) VALUES
('SELECT', ROUND(RAND() * 0.1 + 0.001, 6), SHA2(CONCAT('query_', UNIX_TIMESTAMP(), '_', RAND()), 256), FLOOR(RAND() * 100 + 1), 'core'),
('INSERT', ROUND(RAND() * 0.05 + 0.001, 6), SHA2(CONCAT('insert_', UNIX_TIMESTAMP(), '_', RAND()), 256), 1, 'woocommerce'),
('UPDATE', ROUND(RAND() * 0.08 + 0.001, 6), SHA2(CONCAT('update_', UNIX_TIMESTAMP(), '_', RAND()), 256), FLOOR(RAND() * 5 + 1), 'yoast-seo'),
('DELETE', ROUND(RAND() * 0.03 + 0.001, 6), SHA2(CONCAT('delete_', UNIX_TIMESTAMP(), '_', RAND()), 256), FLOOR(RAND() * 3 + 1), 'core');

-- Insert occasional slow query
INSERT INTO wp_slow_queries (query_time, lock_time, rows_sent, rows_examined, query_text, query_hash)
SELECT 
    ROUND(RAND() * 3 + 1, 6) as query_time,
    ROUND(RAND() * 0.01, 6) as lock_time,
    FLOOR(RAND() * 200 + 10) as rows_sent,
    FLOOR(RAND() * 5000 + 100) as rows_examined,
    CONCAT('SELECT * FROM wp_posts WHERE complex_condition_', FLOOR(RAND() * 1000)) as query_text,
    SHA2(CONCAT('slow_query_', UNIX_TIMESTAMP(), '_', RAND()), 256) as query_hash
WHERE RAND() < 0.1; -- 10% chance of generating a slow query

-- Insert plugin performance data
INSERT INTO wp_plugin_performance (plugin_name, hook_name, execution_time, memory_usage, call_count)
SELECT 
    plugin_name,
    hook_name,
    ROUND(RAND() * 0.1 + 0.01, 6) as execution_time,
    FLOOR(RAND() * 2097152 + 524288) as memory_usage, -- 512KB to 2.5MB
    FLOOR(RAND() * 5 + 1) as call_count
FROM (
    SELECT 'woocommerce' as plugin_name, 'woocommerce_init' as hook_name
    UNION SELECT 'yoast-seo', 'wp_head'
    UNION SELECT 'contact-form-7', 'wp_enqueue_scripts'
    UNION SELECT 'akismet', 'comment_form'
    UNION SELECT 'demo-performance-plugin', 'admin_init'
    UNION SELECT 'elementor', 'wp_footer'
    UNION SELECT 'jetpack', 'wp_loaded'
) as plugins
WHERE RAND() < 0.3; -- 30% chance for each plugin

-- Insert AJAX call data
INSERT INTO wp_ajax_calls (action, execution_time, response_size, user_id, success)
SELECT 
    action,
    ROUND(RAND() * 1 + 0.1, 6) as execution_time,
    FLOOR(RAND() * 4096 + 512) as response_size,
    CASE WHEN RAND() < 0.7 THEN 1 ELSE NULL END as user_id,
    CASE WHEN RAND() < 0.95 THEN TRUE ELSE FALSE END as success
FROM (
    SELECT 'heartbeat' as action
    UNION SELECT 'save_post'
    UNION SELECT 'load_more_posts'
    UNION SELECT 'contact_form_submit'
    UNION SELECT 'woocommerce_add_to_cart'
    UNION SELECT 'admin_ajax_search'
    UNION SELECT 'wp_ajax_query_attachments'
) as actions
WHERE RAND() < 0.2; -- 20% chance for each action

-- Update connection statistics
INSERT INTO wp_connection_stats (active_connections, max_connections, queries_per_second, slow_queries_count) VALUES
(
    FLOOR(RAND() * 25 + 5),
    200,
    ROUND(RAND() * 50 + 20, 2),
    FLOOR(RAND() * 5)
);

-- Clean up old data (keep last 7 days for most tables)
DELETE FROM wp_performance_logs WHERE timestamp < DATE_SUB(NOW(), INTERVAL 7 DAY);
DELETE FROM wp_plugin_performance WHERE timestamp < DATE_SUB(NOW(), INTERVAL 7 DAY);
DELETE FROM wp_ajax_calls WHERE timestamp < DATE_SUB(NOW(), INTERVAL 7 DAY);
DELETE FROM wp_connection_stats WHERE timestamp < DATE_SUB(NOW(), INTERVAL 7 DAY);
DELETE FROM wp_memory_usage WHERE timestamp < DATE_SUB(NOW(), INTERVAL 7 DAY);

-- Keep only last 1000 entries for real-time metrics
DELETE rm1 FROM wp_realtime_metrics rm1
LEFT JOIN (
    SELECT id FROM wp_realtime_metrics 
    ORDER BY timestamp DESC 
    LIMIT 1000
) rm2 ON rm1.id = rm2.id
WHERE rm2.id IS NULL;
