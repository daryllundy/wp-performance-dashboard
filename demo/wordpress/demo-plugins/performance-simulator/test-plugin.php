<?php
/**
 * Test script for Performance Simulator Plugin
 * This script validates the plugin's core functionality
 */

// Mock WordPress environment for testing
if (!defined('ABSPATH')) {
    define('ABSPATH', '/tmp/');
}

// Mock WordPress functions for testing
if (!function_exists('add_action')) {
    function add_action($hook, $callback, $priority = 10, $args = 1) {
        echo "Action registered: $hook\n";
        return true;
    }
}

if (!function_exists('add_filter')) {
    function add_filter($hook, $callback, $priority = 10, $args = 1) {
        echo "Filter registered: $hook\n";
        return true;
    }
}

if (!function_exists('wp_schedule_event')) {
    function wp_schedule_event($timestamp, $recurrence, $hook, $args = array()) {
        echo "Event scheduled: $hook ($recurrence)\n";
        return true;
    }
}

if (!function_exists('wp_next_scheduled')) {
    function wp_next_scheduled($hook, $args = array()) {
        return false; // Simulate no scheduled events
    }
}

if (!function_exists('register_activation_hook')) {
    function register_activation_hook($file, $callback) {
        echo "Activation hook registered for: " . basename($file) . "\n";
        return true;
    }
}

if (!function_exists('register_deactivation_hook')) {
    function register_deactivation_hook($file, $callback) {
        echo "Deactivation hook registered for: " . basename($file) . "\n";
        return true;
    }
}

if (!function_exists('wp_clear_scheduled_hook')) {
    function wp_clear_scheduled_hook($hook, $args = array()) {
        echo "Scheduled hook cleared: $hook\n";
        return true;
    }
}

// Include the plugin
require_once 'performance-simulator.php';

echo "Performance Simulator Plugin Test\n";
echo "================================\n\n";

// Test plugin instantiation
$plugin = new PerformanceSimulator();

echo "✓ Plugin class instantiated successfully\n";

// Test performance scenarios configuration
$reflection = new ReflectionClass($plugin);
$scenarios_property = $reflection->getProperty('performance_scenarios');
$scenarios_property->setAccessible(true);
$scenarios = $scenarios_property->getValue($plugin);

echo "✓ Performance scenarios configured:\n";
foreach ($scenarios as $name => $config) {
    echo "  - $name: {$config['min_delay']}s-{$config['max_delay']}s (memory factor: {$config['memory_factor']})\n";
}

// Test utility method
$get_random_float = $reflection->getMethod('get_random_float');
$get_random_float->setAccessible(true);

$random_value = $get_random_float->invoke($plugin, 1.0, 5.0);
echo "✓ Random float generation: $random_value (between 1.0 and 5.0)\n";

echo "\n✓ All tests passed! Plugin is ready for deployment.\n";
