# Performance Simulator Plugin

A WordPress plugin designed to simulate various performance scenarios for the WordPress Performance Dashboard demo environment.

## Features

### Performance Load Scenarios

The plugin provides four distinct performance scenarios with controlled response times and resource usage:

1. **Light Load** (0.1-0.5s)
   - Minimal processing delay
   - Low memory usage (1x factor)
   - Simple database queries

2. **Medium Load** (0.5-2.0s)
   - Moderate processing delay
   - Medium memory usage (2x factor)
   - Complex queries with JOINs and GROUP BY

3. **Heavy Load** (2.0-8.0s)
   - Significant processing delay
   - High memory usage (5x factor)
   - Complex queries with subqueries and RAND()

4. **Critical Load** (8.0-15.0s)
   - Extreme processing delay
   - Very high memory usage (10x factor)
   - Complex queries with deliberate SLEEP(1) delays

### AJAX Endpoints

The plugin registers the following AJAX endpoints for performance testing:

- `wp_ajax_demo_light_load` / `wp_ajax_nopriv_demo_light_load`
- `wp_ajax_demo_medium_load` / `wp_ajax_nopriv_demo_medium_load`
- `wp_ajax_demo_heavy_load` / `wp_ajax_nopriv_demo_heavy_load`
- `wp_ajax_demo_critical_load` / `wp_ajax_nopriv_demo_critical_load`

Legacy endpoints (maintained for compatibility):
- `wp_ajax_demo_slow_action` / `wp_ajax_nopriv_demo_slow_action`
- `wp_ajax_demo_memory_spike` / `wp_ajax_nopriv_demo_memory_spike`

### Database Tables

The plugin creates and manages the following database tables:

1. **wp_ajax_calls** - Tracks AJAX call performance
   - `action`: AJAX action name
   - `execution_time`: Response time in seconds
   - `response_size`: Response size in bytes
   - `user_id`: User who triggered the call
   - `timestamp`: When the call occurred
   - `success`: Whether the call succeeded

2. **wp_performance_logs** - General performance metrics
   - `query_type`: Type of performance event
   - `execution_time`: Duration or value of the metric
   - `query_hash`: Hash of the query or operation
   - `plugin_context`: Context information
   - `timestamp`: When the event occurred

3. **wp_plugin_performance** - Plugin-specific performance data
   - `plugin_name`: Name of the plugin
   - `hook_name`: WordPress hook being measured
   - `execution_time`: Hook execution time
   - `memory_usage`: Memory used during execution
   - `call_count`: Number of times called
   - `timestamp`: When the measurement occurred

### Background Simulation

The plugin includes background performance simulation that:
- Runs hourly via WordPress cron
- Randomly selects performance scenarios
- Generates realistic background load
- Only operates when `DEMO_MODE` is defined and true

### Admin Interface

Access the plugin's admin interface at **Tools > Performance Simulator** to:
- Trigger different performance scenarios manually
- View configuration details for each scenario
- Monitor recent performance simulation activity
- Check current plugin settings and status

## Installation

1. Copy the plugin directory to `wp-content/plugins/performance-simulator/`
2. Activate the plugin through the WordPress admin interface
3. The plugin will automatically create required database tables
4. Access the admin interface under **Tools > Performance Simulator**

## Configuration

### Demo Mode

To enable background simulation, define `DEMO_MODE` in your `wp-config.php`:

```php
define('DEMO_MODE', true);
```

### Performance Scenarios

The performance scenarios are configured in the plugin class and can be modified by editing the `$performance_scenarios` array:

```php
private $performance_scenarios = array(
    'light_load' => array('min_delay' => 0.1, 'max_delay' => 0.5, 'memory_factor' => 1),
    'medium_load' => array('min_delay' => 0.5, 'max_delay' => 2.0, 'memory_factor' => 2),
    'heavy_load' => array('min_delay' => 2.0, 'max_delay' => 8.0, 'memory_factor' => 5),
    'critical_load' => array('min_delay' => 8.0, 'max_delay' => 15.0, 'memory_factor' => 10)
);
```

## Usage Examples

### Manual Testing via AJAX

```javascript
// Trigger a heavy load scenario
fetch('/wp-admin/admin-ajax.php', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'action=demo_heavy_load'
})
.then(response => response.json())
.then(data => console.log(data));
```

### Monitoring Performance Data

Query the performance tables to analyze simulation results:

```sql
-- Recent AJAX performance
SELECT action, AVG(execution_time) as avg_time, COUNT(*) as call_count
FROM wp_ajax_calls 
WHERE action LIKE 'demo_%' 
AND timestamp > DATE_SUB(NOW(), INTERVAL 1 HOUR)
GROUP BY action;

-- Memory usage patterns
SELECT plugin_context, AVG(execution_time) as avg_memory_mb
FROM wp_performance_logs 
WHERE query_type = 'memory_usage'
AND timestamp > DATE_SUB(NOW(), INTERVAL 1 HOUR)
GROUP BY plugin_context;
```

## Requirements

- WordPress 5.0+
- PHP 7.4+
- MySQL 5.7+ or MariaDB 10.2+

## Version History

- **1.1.0** - Enhanced performance scenarios, improved logging, background simulation
- **1.0.0** - Initial release with basic performance simulation

## License

This plugin is part of the WordPress Performance Dashboard demo environment and is intended for demonstration purposes only.
