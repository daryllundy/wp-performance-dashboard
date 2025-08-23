<?php
/**
 * WordPress Demo Content Initialization Script
 * 
 * This script sets up demo content, users, and configuration
 * for the WordPress Performance Dashboard demo environment.
 */

// Prevent direct access
if (!defined('ABSPATH')) {
    require_once(dirname(__FILE__) . '/wp-config-demo.php');
}

class DemoContentInitializer {
    
    private $demo_users = array();
    private $demo_posts = array();
    private $demo_pages = array();
    
    public function __construct() {
        add_action('init', array($this, 'maybe_initialize_demo_content'));
    }
    
    public function maybe_initialize_demo_content() {
        // Only run if this is demo mode and content hasn't been initialized
        if (!defined('DEMO_MODE') || !DEMO_MODE) {
            return;
        }
        
        if (get_option('demo_content_initialized')) {
            return;
        }
        
        $this->create_demo_users();
        $this->create_demo_posts();
        $this->create_demo_pages();
        $this->create_demo_comments();
        $this->activate_demo_plugins();
        $this->configure_demo_settings();
        
        update_option('demo_content_initialized', true);
        update_option('demo_content_version', '1.0.0');
    }
    
    private function create_demo_users() {
        $users = array(
            array(
                'user_login' => 'demo_admin',
                'user_pass' => 'demo_password',
                'user_email' => 'admin@demo.local',
                'display_name' => 'Demo Administrator',
                'role' => 'administrator'
            ),
            array(
                'user_login' => 'demo_editor',
                'user_pass' => 'demo_password',
                'user_email' => 'editor@demo.local',
                'display_name' => 'Demo Editor',
                'role' => 'editor'
            ),
            array(
                'user_login' => 'demo_author',
                'user_pass' => 'demo_password',
                'user_email' => 'author@demo.local',
                'display_name' => 'Demo Author',
                'role' => 'author'
            ),
            array(
                'user_login' => 'demo_contributor',
                'user_pass' => 'demo_password',
                'user_email' => 'contributor@demo.local',
                'display_name' => 'Demo Contributor',
                'role' => 'contributor'
            ),
            array(
                'user_login' => 'demo_subscriber',
                'user_pass' => 'demo_password',
                'user_email' => 'subscriber@demo.local',
                'display_name' => 'Demo Subscriber',
                'role' => 'subscriber'
            )
        );
        
        foreach ($users as $user_data) {
            if (!username_exists($user_data['user_login'])) {
                $user_id = wp_insert_user($user_data);
                if (!is_wp_error($user_id)) {
                    $this->demo_users[] = $user_id;
                }
            }
        }
    }
    
    private function create_demo_posts() {
        $post_count = defined('DEMO_POSTS_COUNT') ? DEMO_POSTS_COUNT : 50;
        
        $sample_titles = array(
            'Understanding WordPress Performance Optimization',
            'Database Query Optimization Techniques',
            'Plugin Performance Impact Analysis',
            'Caching Strategies for WordPress Sites',
            'Memory Management in WordPress',
            'AJAX Performance Best Practices',
            'WordPress Security and Performance',
            'Theme Development Performance Tips',
            'Server Configuration for WordPress',
            'Monitoring WordPress Performance Metrics'
        );
        
        $sample_content = array(
            'This is a comprehensive guide to WordPress performance optimization. Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
            'Database optimization is crucial for WordPress performance. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.',
            'Understanding plugin performance impact helps maintain site speed. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.',
            'Effective caching strategies can dramatically improve site performance. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.'
        );
        
        for ($i = 0; $i < $post_count; $i++) {
            $title = $sample_titles[array_rand($sample_titles)] . ' #' . ($i + 1);
            $content = $sample_content[array_rand($sample_content)];
            
            // Add some variation to content length
            if ($i % 5 == 0) {
                $content = str_repeat($content . "\n\n", rand(3, 8));
            }
            
            $post_data = array(
                'post_title' => $title,
                'post_content' => $content,
                'post_status' => 'publish',
                'post_author' => $this->demo_users[array_rand($this->demo_users)],
                'post_date' => date('Y-m-d H:i:s', strtotime('-' . rand(1, 365) . ' days')),
                'post_type' => 'post'
            );
            
            $post_id = wp_insert_post($post_data);
            if (!is_wp_error($post_id)) {
                $this->demo_posts[] = $post_id;
                
                // Add some meta data for performance testing
                update_post_meta($post_id, 'demo_performance_score', rand(60, 100));
                update_post_meta($post_id, 'demo_load_time', rand(500, 3000) / 1000);
            }
        }
    }
    
    private function create_demo_pages() {
        $pages = array(
            array(
                'title' => 'Performance Dashboard Demo',
                'content' => 'Welcome to the WordPress Performance Dashboard demo environment. This page demonstrates various performance monitoring capabilities.',
                'slug' => 'demo-home'
            ),
            array(
                'title' => 'About Performance Monitoring',
                'content' => 'This page contains information about performance monitoring techniques and best practices for WordPress sites.',
                'slug' => 'about-performance'
            ),
            array(
                'title' => 'Database Optimization Guide',
                'content' => 'A comprehensive guide to optimizing WordPress database performance, including query optimization and indexing strategies.',
                'slug' => 'database-optimization'
            ),
            array(
                'title' => 'Plugin Performance Analysis',
                'content' => 'Learn how to analyze plugin performance impact and identify performance bottlenecks in your WordPress installation.',
                'slug' => 'plugin-analysis'
            ),
            array(
                'title' => 'Caching Configuration',
                'content' => 'Best practices for configuring caching solutions to improve WordPress site performance and user experience.',
                'slug' => 'caching-config'
            )
        );
        
        foreach ($pages as $page_data) {
            $page = array(
                'post_title' => $page_data['title'],
                'post_content' => $page_data['content'],
                'post_status' => 'publish',
                'post_type' => 'page',
                'post_name' => $page_data['slug'],
                'post_author' => $this->demo_users[0] // Admin user
            );
            
            $page_id = wp_insert_post($page);
            if (!is_wp_error($page_id)) {
                $this->demo_pages[] = $page_id;
            }
        }
    }
    
    private function create_demo_comments() {
        $comment_count = defined('DEMO_COMMENTS_COUNT') ? DEMO_COMMENTS_COUNT : 200;
        
        $sample_comments = array(
            'Great article! This really helped me understand WordPress performance optimization.',
            'Thanks for sharing these insights. The database optimization tips are particularly useful.',
            'I implemented these suggestions and saw a significant improvement in my site speed.',
            'Very informative post. Looking forward to more content like this.',
            'The performance monitoring techniques mentioned here are excellent.',
            'This is exactly what I was looking for. Thank you for the detailed explanation.'
        );
        
        for ($i = 0; $i < $comment_count; $i++) {
            if (empty($this->demo_posts)) continue;
            
            $comment_data = array(
                'comment_post_ID' => $this->demo_posts[array_rand($this->demo_posts)],
                'comment_author' => 'Demo User ' . rand(1, 20),
                'comment_author_email' => 'user' . rand(1, 20) . '@demo.local',
                'comment_content' => $sample_comments[array_rand($sample_comments)],
                'comment_approved' => 1,
                'comment_date' => date('Y-m-d H:i:s', strtotime('-' . rand(1, 180) . ' days'))
            );
            
            wp_insert_comment($comment_data);
        }
    }
    
    private function activate_demo_plugins() {
        // Activate the performance simulator plugin
        $plugin_path = 'demo-plugins/performance-simulator/performance-simulator.php';
        
        if (!is_plugin_active($plugin_path)) {
            activate_plugin($plugin_path);
        }
    }
    
    private function configure_demo_settings() {
        // Set demo-specific WordPress options
        update_option('blogname', 'WordPress Performance Dashboard Demo');
        update_option('blogdescription', 'Demonstrating WordPress performance monitoring capabilities');
        update_option('start_of_week', 1);
        update_option('use_balanceTags', 0);
        update_option('use_smilies', 1);
        update_option('require_name_email', 1);
        update_option('comments_notify', 1);
        update_option('posts_per_page', 10);
        update_option('default_pingback_flag', 0);
        update_option('default_ping_status', 'closed');
        update_option('default_comment_status', 'open');
        
        // Performance-related settings
        update_option('demo_performance_monitoring_enabled', 1);
        update_option('demo_slow_query_threshold', 1.0);
        update_option('demo_memory_limit_warning', 200 * 1024 * 1024); // 200MB
        
        // Set a demo theme if available
        $demo_theme = 'twentytwentyfour';
        if (wp_get_theme($demo_theme)->exists()) {
            switch_theme($demo_theme);
        }
    }
}

// Initialize demo content
new DemoContentInitializer();

// Add WP-CLI command for manual initialization
if (defined('WP_CLI') && WP_CLI) {
    WP_CLI::add_command('demo init-content', function() {
        delete_option('demo_content_initialized');
        $initializer = new DemoContentInitializer();
        $initializer->maybe_initialize_demo_content();
        WP_CLI::success('Demo content initialized successfully.');
    });
}
