<?php
/**
 * Demo WordPress Configuration
 * 
 * This configuration is specifically designed for the demo environment
 * with performance monitoring and debugging enabled.
 */

// ** MySQL settings ** //
define('DB_NAME', 'demo_wordpress');
define('DB_USER', 'demo_user');
define('DB_PASSWORD', 'demo_password');
define('DB_HOST', 'demo-mysql:3306');
define('DB_CHARSET', 'utf8mb4');
define('DB_COLLATE', '');

// ** Authentication Unique Keys and Salts ** //
define('AUTH_KEY',         'demo-auth-key-12345');
define('SECURE_AUTH_KEY',  'demo-secure-auth-key-12345');
define('LOGGED_IN_KEY',    'demo-logged-in-key-12345');
define('NONCE_KEY',        'demo-nonce-key-12345');
define('AUTH_SALT',        'demo-auth-salt-12345');
define('SECURE_AUTH_SALT', 'demo-secure-auth-salt-12345');
define('LOGGED_IN_SALT',   'demo-logged-in-salt-12345');
define('NONCE_SALT',       'demo-nonce-salt-12345');

// ** WordPress Database Table prefix ** //
$table_prefix = 'wp_';

// ** Demo Environment Settings ** //
define('WP_DEBUG', true);
define('WP_DEBUG_LOG', true);
define('WP_DEBUG_DISPLAY', false);
define('SCRIPT_DEBUG', true);
define('SAVEQUERIES', true);

// Performance monitoring settings
define('WP_MEMORY_LIMIT', '256M');
define('WP_MAX_MEMORY_LIMIT', '512M');

// Demo mode identifier
define('DEMO_MODE', true);
define('DEMO_ENVIRONMENT', 'wordpress-performance-dashboard');

// Disable file editing in admin
define('DISALLOW_FILE_EDIT', true);

// Auto-update settings for demo stability
define('WP_AUTO_UPDATE_CORE', false);
define('AUTOMATIC_UPDATER_DISABLED', true);

// Cache settings (disabled for demo to show real performance)
define('WP_CACHE', false);

// Demo content settings
define('DEMO_POSTS_COUNT', 50);
define('DEMO_PAGES_COUNT', 10);
define('DEMO_USERS_COUNT', 5);
define('DEMO_COMMENTS_COUNT', 200);

// Performance simulation settings
define('DEMO_SLOW_QUERY_SIMULATION', true);
define('DEMO_PLUGIN_PERFORMANCE_TRACKING', true);
define('DEMO_AJAX_MONITORING', true);

// WordPress Localization
define('WPLANG', '');

/* That's all, stop editing! Happy blogging. */

/** Absolute path to the WordPress directory. */
if (!defined('ABSPATH')) {
    define('ABSPATH', dirname(__FILE__) . '/');
}

/** Sets up WordPress vars and included files. */
require_once(ABSPATH . 'wp-settings.php');

// Demo-specific hooks and filters
if (defined('DEMO_MODE') && DEMO_MODE) {
    // Add performance monitoring hooks
    add_action('init', function() {
        if (!wp_next_scheduled('demo_performance_log_cleanup')) {
            wp_schedule_event(time(), 'daily', 'demo_performance_log_cleanup');
        }
    });
    
    // Log slow queries for demo purposes
    add_action('shutdown', function() {
        global $wpdb;
        if (defined('SAVEQUERIES') && SAVEQUERIES && !empty($wpdb->queries)) {
            foreach ($wpdb->queries as $query) {
                if ($query[1] > 1.0) { // Log queries taking more than 1 second
                    error_log("Demo Slow Query: " . $query[0] . " (Time: " . $query[1] . "s)");
                }
            }
        }
    });
}
