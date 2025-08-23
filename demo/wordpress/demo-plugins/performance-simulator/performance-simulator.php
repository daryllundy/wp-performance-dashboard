<?php
/**
 * Plugin Name: Performance Simulator
 * Description: Demo plugin that simulates various performance scenarios for the WordPress Performance Dashboard
 * Version: 1.1.0
 * Author: WordPress Performance Dashboard Demo
 */

// Prevent direct access
if (!defined('ABSPATH')) {
    exit;
}

class PerformanceSimulator {
    
    private $slow_query_chance = 0.15; // 15% chance of slow query
    private $memory_spike_chance = 0.08; // 8% chance of memory spike
    private $performance_scenarios = array(
        'light_load' => array('min_delay' => 0.1, 'max_delay' => 0.5, 'memory_factor' => 1),
        'medium_load' => array('min_delay' => 0.5, 'max_delay' => 2.0, 'memory_factor' => 2),
        'heavy_load' => array('min_delay' => 2.0, 'max_delay' => 8.0, 'memory_factor' => 5),
        'critical_load' => array('min_delay' => 8.0, 'max_delay' => 15.0, 'memory_factor' => 10)
    );
    
    public function __construct() {
        add_action('init', array($this, 'init'));
        
        // Enhanced AJAX endpoints with varied response times
        add_action('wp_ajax_demo_light_load', array($this, 'simulate_light_load'));
        add_action('wp_ajax_nopriv_demo_light_load', array($this, 'simulate_light_load'));
        add_action('wp_ajax_demo_medium_load', array($this, 'simulate_medium_load'));
        add_action('wp_ajax_nopriv_demo_medium_load', array($this, 'simulate_medium_load'));
        add_action('wp_ajax_demo_heavy_load', array($this, 'simulate_heavy_load'));
        add_action('wp_ajax_nopriv_demo_heavy_load', array($this, 'simulate_heavy_load'));
        add_action('wp_ajax_demo_critical_load', array($this, 'simulate_critical_load'));
        add_action('wp_ajax_nopriv_demo_critical_load', array($this, 'simulate_critical_load'));
        
        // Legacy endpoints (maintained for compatibility)
        add_action('wp_ajax_demo_slow_action', array($this, 'simulate_slow_ajax'));
        add_action('wp_ajax_nopriv_demo_slow_action', array($this, 'simulate_slow_ajax'));
        add_action('wp_ajax_demo_memory_spike', array($this, 'simulate_memory_spike'));
        add_action('wp_ajax_nopriv_demo_memory_spike', array($this, 'simulate_memory_spike'));
        
        // Enhanced query simulation
        add_action('wp_head', array($this, 'maybe_simulate_slow_query'));
        add_action('admin_menu', array($this, 'add_admin_menu'));
        
        // Hook into WordPress query to occasionally add complexity
        add_filter('posts_request', array($this, 'maybe_complicate_query'), 10, 2);
        
        // Background performance simulation
        add_action('wp_loaded', array($this, 'schedule_background_simulation'));
        add_action('performance_simulator_background', array($this, 'run_background_simulation'));
    }
    
    public function init() {
        // Register performance logging
        if (defined('DEMO_MODE') && DEMO_MODE) {
            $this->log_performance_metrics();
        }
    }
    
    public function simulate_light_load() {
        $this->simulate_performance_scenario('light_load');
    }
    
    public function simulate_medium_load() {
        $this->simulate_performance_scenario('medium_load');
    }
    
    public function simulate_heavy_load() {
        $this->simulate_performance_scenario('heavy_load');
    }
    
    public function simulate_critical_load() {
        $this->simulate_performance_scenario('critical_load');
    }
    
    private function simulate_performance_scenario($scenario_type) {
        $start_time = microtime(true);
        $start_memory = memory_get_usage(true);
        
        $scenario = $this->performance_scenarios[$scenario_type];
        
        // Simulate processing delay
        $delay = $this->get_random_float($scenario['min_delay'], $scenario['max_delay']);
        usleep($delay * 1000000); // Convert to microseconds
        
        // Simulate memory usage
        $this->simulate_memory_usage($scenario['memory_factor']);
        
        // Simulate database queries based on load type
        $this->simulate_database_load($scenario_type);
        
        $execution_time = microtime(true) - $start_time;
        $memory_used = memory_get_usage(true) - $start_memory;
        
        // Log the ajax call with detailed metrics
        $this->log_ajax_call("demo_{$scenario_type}", $execution_time, array(
            'memory_used' => $memory_used,
            'scenario_type' => $scenario_type,
            'simulated_delay' => $delay
        ));
        
        wp_send_json_success(array(
            'message' => ucfirst(str_replace('_', ' ', $scenario_type)) . ' simulation completed',
            'execution_time' => round($execution_time, 3),
            'memory_used' => $memory_used,
            'scenario_type' => $scenario_type,
            'timestamp' => current_time('mysql')
        ));
    }
    
    public function simulate_slow_ajax() {
        // Legacy method - simulate processing time between 1-5 seconds
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
        // Legacy method - allocate memory to simulate spike
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
    
    private function simulate_memory_usage($factor) {
        // Simulate memory usage based on factor (1-10)
        $base_allocation = 1000; // Base allocation size
        $allocation_size = $base_allocation * $factor;
        $iterations = 100 * $factor;
        
        $memory_hog = array();
        for ($i = 0; $i < $iterations; $i++) {
            $memory_hog[] = str_repeat('x', $allocation_size);
            
            // Occasionally clear some memory to simulate realistic patterns
            if ($i % 50 === 0 && count($memory_hog) > 10) {
                array_splice($memory_hog, 0, 10);
            }
        }
        
        // Log memory usage
        $this->log_memory_usage(memory_get_usage(true), "factor_{$factor}");
        
        // Clean up to prevent actual memory issues
        unset($memory_hog);
    }
    
    private function simulate_database_load($scenario_type) {
        global $wpdb;
        
        switch ($scenario_type) {
            case 'light_load':
                // Simple query
                $wpdb->get_var("SELECT COUNT(*) FROM {$wpdb->posts} WHERE post_status = 'publish'");
                break;
                
            case 'medium_load':
                // More complex query with joins
                $wpdb->get_results("
                    SELECT p.ID, p.post_title, COUNT(c.comment_ID) as comment_count 
                    FROM {$wpdb->posts} p 
                    LEFT JOIN {$wpdb->comments} c ON p.ID = c.comment_post_ID 
                    WHERE p.post_status = 'publish' 
                    GROUP BY p.ID 
                    ORDER BY comment_count DESC 
                    LIMIT 10
                ");
                break;
                
            case 'heavy_load':
                // Complex query with subqueries and sorting
                $wpdb->get_results("
                    SELECT p.*, 
                           (SELECT COUNT(*) FROM {$wpdb->comments} WHERE comment_post_ID = p.ID) as comment_count,
                           (SELECT meta_value FROM {$wpdb->postmeta} WHERE post_id = p.ID AND meta_key = '_edit_last' LIMIT 1) as last_editor
                    FROM {$wpdb->posts} p 
                    WHERE p.post_status = 'publish' 
                    ORDER BY RAND(), p.post_date DESC 
                    LIMIT 20
                ");
                break;
                
            case 'critical_load':
                // Very expensive query with multiple operations
                $wpdb->get_results("SELECT SLEEP(1)"); // Deliberate 1-second delay
                $wpdb->get_results("
                    SELECT p.*, pm1.meta_value as view_count, pm2.meta_value as featured_image,
                           GROUP_CONCAT(t.name) as tags,
                           (SELECT COUNT(*) FROM {$wpdb->comments} WHERE comment_post_ID = p.ID AND comment_approved = '1') as approved_comments
                    FROM {$wpdb->posts} p
                    LEFT JOIN {$wpdb->postmeta} pm1 ON p.ID = pm1.post_id AND pm1.meta_key = 'view_count'
                    LEFT JOIN {$wpdb->postmeta} pm2 ON p.ID = pm2.post_id AND pm2.meta_key = '_thumbnail_id'
                    LEFT JOIN {$wpdb->term_relationships} tr ON p.ID = tr.object_id
                    LEFT JOIN {$wpdb->term_taxonomy} tt ON tr.term_taxonomy_id = tt.term_taxonomy_id AND tt.taxonomy = 'post_tag'
                    LEFT JOIN {$wpdb->terms} t ON tt.term_id = t.term_id
                    WHERE p.post_status = 'publish'
                    GROUP BY p.ID
                    ORDER BY RAND(), approved_comments DESC
                    LIMIT 15
                ");
                break;
        }
        
        // Log the database operation
        $this->log_slow_query("Database load simulation: {$scenario_type}");
    }
    
    public function maybe_simulate_slow_query() {
        if (rand(1, 100) <= ($this->slow_query_chance * 100)) {
            global $wpdb;
            
            // Vary the slow query types for more realistic simulation
            $query_types = array(
                array('query' => "SELECT SLEEP(1), ID FROM {$wpdb->posts} LIMIT 1", 'delay' => 1),
                array('query' => "SELECT SLEEP(2), COUNT(*) FROM {$wpdb->posts} WHERE post_status = 'publish'", 'delay' => 2),
                array('query' => "SELECT SLEEP(0.5), p.* FROM {$wpdb->posts} p ORDER BY RAND() LIMIT 5", 'delay' => 0.5),
            );
            
            $selected_query = $query_types[array_rand($query_types)];
            $wpdb->get_results($selected_query['query']);
            
            $this->log_slow_query("Simulated slow query via SLEEP({$selected_query['delay']})", $selected_query['delay']);
        }
    }
    
    public function schedule_background_simulation() {
        if (!wp_next_scheduled('performance_simulator_background')) {
            wp_schedule_event(time(), 'hourly', 'performance_simulator_background');
        }
    }
    
    public function run_background_simulation() {
        // Only run in demo mode
        if (!defined('DEMO_MODE') || !DEMO_MODE) {
            return;
        }
        
        // Randomly trigger different performance scenarios
        $scenarios = array_keys($this->performance_scenarios);
        $random_scenario = $scenarios[array_rand($scenarios)];
        
        // Simulate background load (without AJAX response)
        $this->simulate_background_load($random_scenario);
    }
    
    private function simulate_background_load($scenario_type) {
        $start_time = microtime(true);
        $scenario = $this->performance_scenarios[$scenario_type];
        
        // Lighter background simulation to avoid overwhelming the system
        $delay = $this->get_random_float($scenario['min_delay'] * 0.1, $scenario['max_delay'] * 0.1);
        usleep($delay * 1000000);
        
        // Simulate some database activity
        $this->simulate_database_load($scenario_type);
        
        $execution_time = microtime(true) - $start_time;
        
        // Log background activity
        $this->log_ajax_call("background_{$scenario_type}", $execution_time, array(
            'type' => 'background_simulation',
            'scenario_type' => $scenario_type
        ));
    }
    
    private function get_random_float($min, $max) {
        return $min + mt_rand() / mt_getrandmax() * ($max - $min);
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
                <h2>Performance Load Scenarios</h2>
                <p>Simulate different performance loads with controlled response times and memory usage:</p>
                <div style="margin: 10px 0;">
                    <button type="button" class="button button-secondary" onclick="simulateLoad('light_load')">Light Load (0.1-0.5s)</button>
                    <button type="button" class="button button-secondary" onclick="simulateLoad('medium_load')">Medium Load (0.5-2s)</button>
                    <button type="button" class="button button-primary" onclick="simulateLoad('heavy_load')">Heavy Load (2-8s)</button>
                    <button type="button" class="button button-primary" onclick="simulateLoad('critical_load')" style="background-color: #dc3232;">Critical Load (8-15s)</button>
                </div>
            </div>
            
            <div class="card">
                <h2>Legacy Performance Tests</h2>
                <p>Original performance simulation methods:</p>
                <p>
                    <button type="button" class="button" onclick="simulateSlowAjax()">Trigger Slow AJAX Call</button>
                    <button type="button" class="button" onclick="simulateMemorySpike()">Trigger Memory Spike</button>
                </p>
            </div>
            
            <div class="card">
                <h2>Performance Scenarios Configuration</h2>
                <table class="widefat">
                    <thead>
                        <tr>
                            <th>Scenario</th>
                            <th>Response Time Range</th>
                            <th>Memory Factor</th>
                            <th>Database Complexity</th>
                        </tr>
                    </thead>
                    <tbody>
                        <?php foreach ($this->performance_scenarios as $name => $config): ?>
                        <tr>
                            <td><?php echo ucfirst(str_replace('_', ' ', $name)); ?></td>
                            <td><?php echo $config['min_delay']; ?>s - <?php echo $config['max_delay']; ?>s</td>
                            <td><?php echo $config['memory_factor']; ?>x</td>
                            <td><?php 
                                $complexity = array(
                                    'light_load' => 'Simple SELECT',
                                    'medium_load' => 'JOINs + GROUP BY',
                                    'heavy_load' => 'Subqueries + RAND()',
                                    'critical_load' => 'Complex + SLEEP(1)'
                                );
                                echo $complexity[$name];
                            ?></td>
                        </tr>
                        <?php endforeach; ?>
                    </tbody>
                </table>
            </div>
            
            <div class="card">
                <h2>Current Settings</h2>
                <ul>
                    <li>Slow Query Chance: <?php echo ($this->slow_query_chance * 100); ?>%</li>
                    <li>Memory Spike Chance: <?php echo ($this->memory_spike_chance * 100); ?>%</li>
                    <li>Demo Mode: <?php echo defined('DEMO_MODE') && DEMO_MODE ? 'Enabled' : 'Disabled'; ?></li>
                    <li>Background Simulation: <?php echo wp_next_scheduled('performance_simulator_background') ? 'Scheduled' : 'Not Scheduled'; ?></li>
                </ul>
            </div>
            
            <div class="card">
                <h2>Performance Logs</h2>
                <p>Recent performance simulation activity:</p>
                <?php $this->display_recent_logs(); ?>
            </div>
        </div>
        
        <script>
        function simulateLoad(scenario) {
            const button = event.target;
            const originalText = button.textContent;
            button.textContent = 'Running...';
            button.disabled = true;
            
            fetch('<?php echo admin_url('admin-ajax.php'); ?>', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: 'action=demo_' + scenario
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    alert(data.data.message + '\nExecution Time: ' + data.data.execution_time + 's\nMemory Used: ' + Math.round(data.data.memory_used / 1024) + ' KB');
                } else {
                    alert('Error: ' + data.data);
                }
            })
            .catch(error => {
                alert('Error: ' + error.message);
            })
            .finally(() => {
                button.textContent = originalText;
                button.disabled = false;
            });
        }
        
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
    
    private function log_ajax_call($action, $execution_time, $additional_data = array()) {
        global $wpdb;
        
        $table_name = $wpdb->prefix . 'ajax_calls';
        
        // Calculate response size based on additional data
        $response_size = isset($additional_data['memory_used']) ? $additional_data['memory_used'] : strlen(json_encode($additional_data));
        
        $wpdb->insert(
            $table_name,
            array(
                'action' => $action,
                'execution_time' => $execution_time,
                'response_size' => $response_size,
                'user_id' => get_current_user_id(),
                'timestamp' => current_time('mysql'),
                'success' => 1
            )
        );
        
        // Also log to performance_logs for comprehensive tracking
        $this->log_performance_metric('ajax_call', $execution_time, array(
            'action' => $action,
            'additional_data' => $additional_data
        ));
    }
    
    private function log_memory_usage($memory_usage, $context = 'general') {
        global $wpdb;
        
        $table_name = $wpdb->prefix . 'performance_logs';
        
        $wpdb->insert(
            $table_name,
            array(
                'query_type' => 'memory_usage',
                'execution_time' => $memory_usage,
                'plugin_context' => "performance-simulator-{$context}",
                'timestamp' => current_time('mysql')
            )
        );
    }
    
    private function log_slow_query($query_info, $execution_time = 2.0) {
        global $wpdb;
        
        $table_name = $wpdb->prefix . 'performance_logs';
        
        $wpdb->insert(
            $table_name,
            array(
                'query_type' => 'slow_query',
                'execution_time' => $execution_time,
                'query_hash' => md5($query_info),
                'plugin_context' => 'performance-simulator',
                'timestamp' => current_time('mysql')
            )
        );
    }
    
    private function log_performance_metric($metric_type, $value, $context = array()) {
        global $wpdb;
        
        $table_name = $wpdb->prefix . 'performance_logs';
        
        $wpdb->insert(
            $table_name,
            array(
                'query_type' => $metric_type,
                'execution_time' => $value,
                'query_hash' => md5(json_encode($context)),
                'plugin_context' => 'performance-simulator',
                'timestamp' => current_time('mysql')
            )
        );
    }
    
    private function display_recent_logs() {
        global $wpdb;
        
        $ajax_table = $wpdb->prefix . 'ajax_calls';
        $perf_table = $wpdb->prefix . 'performance_logs';
        
        // Get recent AJAX calls
        $recent_ajax = $wpdb->get_results("
            SELECT action, execution_time, timestamp 
            FROM {$ajax_table} 
            WHERE action LIKE 'demo_%' 
            ORDER BY timestamp DESC 
            LIMIT 10
        ");
        
        if ($recent_ajax) {
            echo '<h4>Recent AJAX Calls:</h4>';
            echo '<ul>';
            foreach ($recent_ajax as $call) {
                echo '<li>' . esc_html($call->action) . ' - ' . round($call->execution_time, 3) . 's (' . esc_html($call->timestamp) . ')</li>';
            }
            echo '</ul>';
        }
        
        // Get recent performance logs
        $recent_perf = $wpdb->get_results("
            SELECT query_type, execution_time, timestamp 
            FROM {$perf_table} 
            WHERE plugin_context LIKE '%performance-simulator%' 
            ORDER BY timestamp DESC 
            LIMIT 10
        ");
        
        if ($recent_perf) {
            echo '<h4>Recent Performance Events:</h4>';
            echo '<ul>';
            foreach ($recent_perf as $event) {
                $display_value = $event->query_type === 'memory_usage' ? 
                    number_format($event->execution_time / 1024 / 1024, 2) . ' MB' : 
                    round($event->execution_time, 3) . 's';
                echo '<li>' . esc_html($event->query_type) . ' - ' . $display_value . ' (' . esc_html($event->timestamp) . ')</li>';
            }
            echo '</ul>';
        }
        
        if (!$recent_ajax && !$recent_perf) {
            echo '<p>No recent performance simulation activity found.</p>';
        }
    }
}

// Initialize the plugin
new PerformanceSimulator();

// Add activation hook to create tables
register_activation_hook(__FILE__, function() {
    global $wpdb;
    
    $charset_collate = $wpdb->get_charset_collate();
    
    // Create ajax_calls table
    $ajax_table = $wpdb->prefix . 'ajax_calls';
    $ajax_sql = "CREATE TABLE IF NOT EXISTS $ajax_table (
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
        KEY user_id (user_id),
        KEY execution_time (execution_time)
    ) $charset_collate;";
    
    // Create performance_logs table
    $perf_table = $wpdb->prefix . 'performance_logs';
    $perf_sql = "CREATE TABLE IF NOT EXISTS $perf_table (
        id mediumint(9) NOT NULL AUTO_INCREMENT,
        timestamp datetime DEFAULT CURRENT_TIMESTAMP,
        query_type varchar(50) NOT NULL,
        execution_time float NOT NULL,
        query_hash varchar(32),
        affected_rows int DEFAULT 0,
        plugin_context varchar(100),
        PRIMARY KEY (id),
        KEY timestamp (timestamp),
        KEY query_type (query_type),
        KEY plugin_context (plugin_context),
        KEY execution_time (execution_time)
    ) $charset_collate;";
    
    // Create plugin_performance table for detailed plugin metrics
    $plugin_perf_table = $wpdb->prefix . 'plugin_performance';
    $plugin_perf_sql = "CREATE TABLE IF NOT EXISTS $plugin_perf_table (
        id mediumint(9) NOT NULL AUTO_INCREMENT,
        plugin_name varchar(100) NOT NULL,
        hook_name varchar(100),
        execution_time float NOT NULL,
        memory_usage bigint DEFAULT 0,
        call_count int DEFAULT 1,
        timestamp datetime DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY plugin_name (plugin_name),
        KEY hook_name (hook_name),
        KEY timestamp (timestamp),
        KEY execution_time (execution_time)
    ) $charset_collate;";
    
    require_once(ABSPATH . 'wp-admin/includes/upgrade.php');
    dbDelta($ajax_sql);
    dbDelta($perf_sql);
    dbDelta($plugin_perf_sql);
    
    // Schedule background simulation
    if (!wp_next_scheduled('performance_simulator_background')) {
        wp_schedule_event(time(), 'hourly', 'performance_simulator_background');
    }
});

// Add deactivation hook to clean up
register_deactivation_hook(__FILE__, function() {
    wp_clear_scheduled_hook('performance_simulator_background');
});
