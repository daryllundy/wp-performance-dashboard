# MySQL Demo Database Configuration

This directory contains the MySQL configuration files and scripts for the WordPress Performance Dashboard demo environment.

## Files Overview

### Configuration Files

- **`my.cnf`** - Custom MySQL configuration optimized for performance monitoring
  - Enables Performance Schema with comprehensive instrumentation
  - Configures slow query logging and general query logging
  - Sets up optimal buffer sizes and connection settings for demo environment

- **`init.sql`** - Database initialization script
  - Creates demo database and performance monitoring tables
  - Sets up Performance Schema consumers and instruments
  - Inserts sample performance data for demonstration
  - Creates views and stored procedures for easier data access

- **`performance-schema-setup.sql`** - Additional Performance Schema configuration
  - Enables all necessary Performance Schema consumers
  - Configures statement, stage, and wait event instrumentation
  - Sets up memory and connection monitoring

- **`generate-performance-data.sql`** - Ongoing data generation script
  - Creates realistic performance metrics over time
  - Simulates various query patterns and response times
  - Maintains data freshness by cleaning up old records

- **`validate-performance-setup.sql`** - Validation and testing script
  - Verifies Performance Schema is properly configured
  - Checks that all custom tables and views exist
  - Validates sample data is present

## Performance Monitoring Tables

### Core Performance Tables

1. **`wp_performance_logs`** - General query performance tracking
   - Query types, execution times, affected rows
   - Plugin context and user association
   - Indexed for efficient time-based queries

2. **`wp_slow_queries`** - Slow query analysis
   - Query execution time, lock time, rows examined
   - Full query text with hash for deduplication
   - Mirrors MySQL slow query log in structured format

3. **`wp_plugin_performance`** - Plugin-specific performance metrics
   - Hook execution times and memory usage
   - Call frequency tracking
   - Plugin impact analysis data

4. **`wp_ajax_calls`** - AJAX request monitoring
   - Action names, response times, payload sizes
   - Success/failure tracking with error messages
   - User context for authenticated requests

### Extended Monitoring Tables

5. **`wp_realtime_metrics`** - Real-time dashboard metrics
   - System metrics (CPU, memory, connections)
   - Database performance indicators
   - Cache hit ratios and response times

6. **`wp_connection_stats`** - Database connection monitoring
   - Active connection counts and limits
   - Queries per second calculations
   - Slow query frequency tracking

7. **`wp_memory_usage`** - Memory consumption tracking
   - Process-specific memory usage
   - Peak memory tracking
   - Memory limit monitoring

## Performance Views

- **`v_performance_summary`** - Daily performance overview by query type
- **`v_slow_query_summary`** - Daily slow query statistics
- **`v_plugin_performance_summary`** - Plugin performance rankings
- **`v_realtime_dashboard`** - Latest metrics for dashboard display

## Stored Procedures

- **`InsertPerformanceLog`** - Standardized performance data insertion
- **`UpdateRealtimeMetric`** - Real-time metric updates with automatic cleanup

## Performance Schema Configuration

The configuration enables comprehensive monitoring of:

- **Statement Events** - All SQL statement execution tracking
- **Stage Events** - Query execution stage monitoring
- **Wait Events** - I/O and lock wait tracking
- **Memory Events** - Memory allocation monitoring
- **Connection Events** - Thread and connection tracking

## Usage in Docker Environment

The MySQL service in `docker-compose.demo.yml` is configured to:

1. Mount `my.cnf` as custom configuration
2. Execute initialization scripts in order:
   - `01-init.sql` - Database and table creation
   - `02-performance-schema.sql` - Performance Schema setup
   - `03-generate-data.sql` - Initial data generation
3. Enable logging to mounted volume for external access
4. Expose port 3307 to avoid conflicts with existing MySQL instances

## Validation

To verify the configuration is working correctly:

1. Connect to the demo MySQL instance:
   ```bash
   mysql -h localhost -P 3307 -u demo_user -pdemo_password demo_wordpress
   ```

2. Run the validation script:
   ```sql
   source /path/to/validate-performance-setup.sql
   ```

3. Check that Performance Schema is enabled:
   ```sql
   SELECT @@performance_schema;
   ```

4. Verify custom tables exist:
   ```sql
   SHOW TABLES LIKE 'wp_%performance%';
   ```

## Performance Considerations

- Performance Schema adds ~5-10% overhead but provides comprehensive monitoring
- Slow query log threshold set to 1 second for demo purposes
- Data retention policies automatically clean up old records
- Indexes optimized for time-series queries common in dashboard applications

## Security Notes

- Demo credentials are hardcoded for demonstration purposes only
- Performance Schema access granted to demo user for monitoring
- General query log enabled (contains sensitive data in production)
- Binary logging enabled for replication simulation

**Note**: This configuration is optimized for demonstration and development. Production deployments should review security settings and performance overhead.
