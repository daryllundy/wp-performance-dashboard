<?php
/**
 * Plugin Name: Performance Simulator
 * Description: Demo plugin that simulates various performance scenarios for the WordPress Performance Dashboard
 * Version: 1.0.0
 * Author: WordPress Performance Dashboard Demo
 */

// Prevent direct access
if (!defined('ABSPATH')) {
    exit;
}

class PerformanceSimulator {
    
    private $slow_query_chance = 0.1; // 10% chance of slow query
    private $memory_spike_chance = 0.05; // 5% chance of memory spike
    
    public function __construct() {
        add_action('init', array($this, 'init'));
        add_action('wp_ajax_demo_slow_action', array($this, 'simulate_slow_ajax'));
        add_action('wp_ajax_nopriv_demo_slow_action', array($this, 'simulate_slow_ajax'));
        add_action('wp_ajax_demo_memory_spike', array($this, 'simulate_memory_spike'));
        add_action('wp_ajax_nopriv_demo_memory_spike', array($this, 'simulate_memory_spike'));
        add_action('wp_head', array($this, 'maybe_simulate_slow_query'));
        add_action('admin_menu', array($this, 'add_admin_menu'));
        
        // Hook into WordPress query to occasionally add complexity
        add_filter('posts_request', array($this, 'maybe_complicate_query'), 10, 2);
    }
    
    public function init() {
        // Register performance logging
        if (defined('DEMO_MODE') && DEMO_MODE) {
            $this->log_performance_metrics();
        }
    }
    
    public function simulate_slow_ajax() {
        // Simulate processing time between 1-5 seconds
        $delay = rand(1, 5);
        sleep($delay);
        
        // Log the ajax call
        $this->log_ajax_call('demo_slow_action', $delay);
        
        wp_send_json_success(array(
            'message' => 'Slow AJAX action completed',
            'delay' => $delay,
            'timestamp' => current_time('mysql')
        ));
    }
    
    public function simulate_memory_spike() {
        // Allocate memory to simulate spike
        $memory_hog = array();
        for ($i = 0; $i < 10000; $i++) {
            $memory_hog[] = str_repeat('x', 1000);
        }
        
        $memory_usage = memory_get_usage(true);
        $this->log_memory_usage($memory_usage);
        
        wp_send_json_success(array(
            'message' => 'Memory spike simulated',
            'memory_usage' => $memory_usage,
            'timestamp' => current_time('mysql')
        ));
    }
    
    public function maybe_simulate_slow_query() {
        if (rand(1, 100) <= ($this->slow_query_chance * 100)) {
            global $wpdb;
            
            // Execute a deliberately slow query
            $wpdb->get_results("SELECT SLEEP(2), ID FROM {$wpdb->posts} LIMIT 1");
            
            $this->log_slow_query('Simulated slow query via SLEEP(2)');
        }
    }
    
    public function maybe_complicate_query($request, $query) {
        if (rand(1, 100) <= ($this->slow_query_chance * 100)) {
            // Add unnecessary complexity to some queries
            if (strpos($request, 'SELECT') === 0 && strpos($request, 'ORDER BY') !== false) {
                $request = str_replace('ORDER BY', 'ORDER BY RAND(),', $request);
            }
        }
        return $request;
    }
    
    public function add_admin_menu() {
        add_management_page(
            'Performance Simulator',
            'Performance Simulator',
            'manage_options',
            'performance-simulator',
            array($this, 'admin_page')
        );
    }
    
    public function admin_page() {
        ?>
        <div class="wrap">
            <h1>Performance Simulator</h1>
            <p>This plugin simulates various performance scenarios for demo purposes.</p>
            
            <div class="card">
                <h2>Simulate Performance Issues</h2>
                <p>
                    <button type="button" class="button" onclick="simulateSlowAjax()">Trigger Slow AJAX Call</button>
                    <button type="button" class="button" onclick="simulateMemorySpike()">Trigger Memory Spike</button>
                </p>
            </div>
            
            <div class="card">
                <h2>Current Settings</h2>
                <ul>
                    <li>Slow Query Chance: <?php echo ($this->slow_query_chance * 100); ?>%</li>
                    <li>Memory Spike Chance: <?php echo ($this->memory_spike_chance * 100); ?>%</li>
                    <li>Demo Mode: <?php echo defined('DEMO_MODE') && DEMO_MODE ? 'Enabled' : 'Disabled'; ?></li>
                </ul>
            </div>
        </div>
        
        <script>
        function simulateSlowAjax() {
            fetch('<?php echo admin_url('admin-ajax.php'); ?>', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: 'action=demo_slow_action'
            })
            .then(response => response.json())
            .then(data => {
                alert('Slow AJAX completed in ' + data.data.delay + ' seconds');
            });
        }
        
        function simulateMemorySpike() {
            fetch('<?php echo admin_url('admin-ajax.php'); ?>', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: 'action=demo_memory_spike'
            })
            .then(response => response.json())
            .then(data => {
                alert('Memory spike simulated: ' + Math.round(data.data.memory_usage / 1024 / 1024) + ' MB');
            });
        }
        </script>
        <?php
    }
    
    private function log_performance_metrics() {
        global $wpdb;
        
        // Create performance log table if it doesn't exist
        $table_name = $wpdb->prefix . 'performance_logs';
        
        $charset_collate = $wpdb->get_charset_collate();
        
        $sql = "CREATE TABLE IF NOT EXISTS $table_name (
            id mediumint(9) NOT NULL AUTO_INCREMENT,
            timestamp datetime DEFAULT CURRENT_TIMESTAMP,
            query_type varchar(50) NOT NULL,
            execution_time float NOT NULL,
            query_hash varchar(32),
            affected_rows int,
            plugin_context varchar(100),
            PRIMARY KEY (id),
            KEY timestamp (timestamp),
            KEY query_type (query_type)
        ) $charset_collate;";
        
        require_once(ABSPATH . 'wp-admin/includes/upgrade.php');
        dbDelta($sql);
    }
    
    private function log_ajax_call($action, $execution_time) {
        global $wpdb;
        
        $table_name = $wpdb->prefix . 'ajax_calls';
        
        $wpdb->insert(
            $table_name,
            array(
                'action' => $action,
                'execution_time' => $execution_time,
                'user_id' => get_current_user_id(),
                'timestamp' => current_time('mysql'),
                'success' => 1
            )
        );
    }
    
    private function log_memory_usage($memory_usage) {
        global $wpdb;
        
        $table_name = $wpdb->prefix . 'performance_logs';
        
        $wpdb->insert(
            $table_name,
            array(
                'query_type' => 'memory_usage',
                'execution_time' => $memory_usage,
                'plugin_context' => 'performance-simulator',
                'timestamp' => current_time('mysql')
            )
        );
    }
    
    private function log_slow_query($query_info) {
        global $wpdb;
        
        $table_name = $wpdb->prefix . 'performance_logs';
        
        $wpdb->insert(
            $table_name,
            array(
                'query_type' => 'slow_query',
                'execution_time' => 2.0,
                'query_hash' => md5($query_info),
                'plugin_context' => 'performance-simulator',
                'timestamp' => current_time('mysql')
            )
        );
    }
}

// Initialize the plugin
new PerformanceSimulator();

// Add activation hook to create tables
register_activation_hook(__FILE__, function() {
    global $wpdb;
    
    // Create ajax_calls table
    $table_name = $wpdb->prefix . 'ajax_calls';
    $charset_collate = $wpdb->get_charset_collate();
    
    $sql = "CREATE TABLE IF NOT EXISTS $table_name (
        id mediumint(9) NOT NULL AUTO_INCREMENT,
        action varchar(100) NOT NULL,
        execution_time float NOT NULL,
        response_size int DEFAULT 0,
        user_id bigint(20) DEFAULT 0,
        timestamp datetime DEFAULT CURRENT_TIMESTAMP,
        success tinyint(1) DEFAULT 1,
        PRIMARY KEY (id),
        KEY action (action),
        KEY timestamp (timestamp),
        KEY user_id (user_id)
    ) $charset_collate;";
    
    require_once(ABSPATH . 'wp-admin/includes/upgrade.php');
    dbDelta($sql);
});
