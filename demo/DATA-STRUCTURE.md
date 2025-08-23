# Demo Data Structure Documentation

This document provides a comprehensive overview of the demo data structure, performance scenarios, and data generation patterns used in the WordPress Performance Dashboard demo environment.

## Overview

The demo environment generates realistic WordPress data and performance metrics to showcase the dashboard's monitoring capabilities. The data is designed to simulate real-world WordPress usage patterns with varied performance characteristics.

## WordPress Content Data

### Posts and Pages

#### Blog Posts (75+ entries)
```sql
-- Post distribution by type and status
SELECT post_type, post_status, COUNT(*) as count 
FROM wp_posts 
GROUP BY post_type, post_status;

-- Expected results:
-- post | publish | 75+
-- page | publish | 15+
-- attachment | inherit | 20+
```

**Content Characteristics:**
- **Title Patterns**: SEO-focused, performance-related topics
- **Content Length**: 500-3000 words with realistic variance
- **Categories**: Performance, WordPress, Development, Tutorials
- **Tags**: Varied technical tags for realistic taxonomy queries
- **Publication Dates**: Distributed over last 30 days

**Sample Post Titles:**
- "Advanced WordPress Performance Optimization Techniques"
- "Database Query Optimization for WordPress"
- "Plugin Performance Impact Analysis"
- "Caching Strategies for High-Traffic WordPress Sites"

#### Pages (15+ entries)
- **Homepage**: Complex layout with multiple widgets
- **About Page**: Standard content page
- **Contact Page**: Contact Form 7 integration
- **Services Pages**: Multiple service-related pages
- **Landing Pages**: Conversion-focused pages with forms

### Users and Roles

#### User Distribution
```sql
-- User roles distribution
SELECT um.meta_value as role, COUNT(*) as count
FROM wp_users u
JOIN wp_usermeta um ON u.ID = um.user_id
WHERE um.meta_key = 'wp_capabilities'
GROUP BY um.meta_value;
```

**User Accounts:**
1. **admin** (Administrator)
   - Username: `admin`
   - Password: `demo_password`
   - Full site access, frequent admin-ajax calls

2. **demo_performance_tester** (Editor)
   - Content management access
   - Moderate admin activity

3. **demo_content_creator** (Author)
   - Content creation only
   - Limited admin access

4. **demo_site_visitor** (Subscriber)
   - Frontend-only access
   - Minimal database interaction

### Comments and Interactions

#### Comment Distribution
```sql
-- Comment status distribution
SELECT comment_approved, COUNT(*) as count
FROM wp_comments
GROUP BY comment_approved;

-- Expected results:
-- 1 (approved) | 170+
-- 0 (pending)  | 20+
-- spam         | 10+
```

**Comment Characteristics:**
- **Approval Rate**: 85% approved (realistic moderation)
- **Content**: Varied lengths and quality
- **Authors**: Mix of registered users and anonymous visitors
- **Timestamps**: Distributed realistically across posts

### Media and Attachments

#### Media Library Structure
```sql
-- Media types and counts
SELECT post_mime_type, COUNT(*) as count
FROM wp_posts
WHERE post_type = 'attachment'
GROUP BY post_mime_type;
```

**Media Assets:**
- **Images**: 20+ JPEG/PNG files with proper metadata
- **File Sizes**: Varied from 50KB to 2MB
- **Alt Text**: SEO-optimized descriptions
- **Attachment Metadata**: Proper EXIF data and thumbnails

## Performance Monitoring Data

### Performance Logs Table (`wp_performance_logs`)

#### Schema Structure
```sql
CREATE TABLE wp_performance_logs (
    id mediumint(9) NOT NULL AUTO_INCREMENT,
    timestamp datetime DEFAULT CURRENT_TIMESTAMP,
    query_type varchar(50) NOT NULL,
    execution_time float NOT NULL,
    query_hash varchar(32),
    affected_rows int,
    plugin_context varchar(100),
    query_pattern varchar(100),
    memory_usage int DEFAULT 0,
    PRIMARY KEY (id),
    KEY timestamp (timestamp),
    KEY query_type (query_type),
    KEY plugin_context (plugin_context)
);
```

#### Data Distribution
```sql
-- Query type distribution
SELECT query_type, COUNT(*) as count, 
       AVG(execution_time) as avg_time,
       MAX(execution_time) as max_time
FROM wp_performance_logs
GROUP BY query_type
ORDER BY count DESC;
```

**Expected Distribution:**
- **SELECT**: 70% of queries (0.001-0.5s typical)
- **INSERT**: 15% of queries (0.05-0.2s typical)
- **UPDATE**: 10% of queries (0.03-0.15s typical)
- **DELETE**: 5% of queries (0.02-0.1s typical)

#### Query Patterns by Plugin Context
```sql
-- Performance by plugin context
SELECT plugin_context, COUNT(*) as queries,
       AVG(execution_time) as avg_time,
       AVG(memory_usage) as avg_memory
FROM wp_performance_logs
GROUP BY plugin_context
ORDER BY avg_time DESC;
```

**Plugin Performance Characteristics:**
- **core**: Fast, efficient queries (0.01-0.1s)
- **woocommerce**: Moderate complexity (0.1-0.5s)
- **yoast-seo**: SEO analysis queries (0.05-0.3s)
- **performance-simulator**: Controlled slow queries (0.5-15s)

### Slow Queries Data

#### Slow Query Examples
The demo includes realistic slow query patterns:

```sql
-- Complex post query with metadata
SELECT p.*, pm1.meta_value as view_count, pm2.meta_value as featured_image,
       GROUP_CONCAT(t.name) as tags,
       (SELECT COUNT(*) FROM wp_comments WHERE comment_post_ID = p.ID) as comment_count
FROM wp_posts p
LEFT JOIN wp_postmeta pm1 ON p.ID = pm1.post_id AND pm1.meta_key = 'view_count'
LEFT JOIN wp_postmeta pm2 ON p.ID = pm2.post_id AND pm2.meta_key = '_thumbnail_id'
LEFT JOIN wp_term_relationships tr ON p.ID = tr.object_id
LEFT JOIN wp_terms t ON tr.term_taxonomy_id = t.term_id
WHERE p.post_status = 'publish'
GROUP BY p.ID
ORDER BY RAND(), comment_count DESC
LIMIT 15;
```

**Slow Query Categories:**
1. **Unoptimized JOINs**: Complex multi-table queries
2. **RAND() Operations**: Random ordering causing full table scans
3. **Subquery Heavy**: Nested SELECT statements
4. **Missing Indexes**: Queries on unindexed columns
5. **Large Result Sets**: Queries returning excessive data

### AJAX Calls Data (`wp_ajax_calls`)

#### Schema Structure
```sql
CREATE TABLE wp_ajax_calls (
    id mediumint(9) NOT NULL AUTO_INCREMENT,
    action varchar(100) NOT NULL,
    execution_time float NOT NULL,
    response_size int DEFAULT 0,
    user_id bigint(20) DEFAULT 0,
    timestamp datetime DEFAULT CURRENT_TIMESTAMP,
    success tinyint(1) DEFAULT 1,
    request_method varchar(10) DEFAULT 'POST',
    user_agent varchar(255) DEFAULT '',
    ip_address varchar(45) DEFAULT '',
    nonce_verified tinyint(1) DEFAULT 1,
    PRIMARY KEY (id),
    KEY action (action),
    KEY timestamp (timestamp)
);
```

#### AJAX Action Distribution
```sql
-- AJAX actions by frequency and performance
SELECT action, COUNT(*) as calls,
       AVG(execution_time) as avg_time,
       AVG(response_size) as avg_size,
       (COUNT(*) * 100.0 / (SELECT COUNT(*) FROM wp_ajax_calls)) as percentage
FROM wp_ajax_calls
GROUP BY action
ORDER BY calls DESC;
```

**Realistic AJAX Patterns:**
- **heartbeat**: 25% frequency, 0.08s avg, 150 bytes
- **save_post**: 15% frequency, 0.35s avg, 500 bytes
- **inline_save**: 10% frequency, 0.25s avg, 300 bytes
- **query_attachments**: 8% frequency, 0.18s avg, 2500 bytes
- **fetch_list**: 12% frequency, 0.12s avg, 1200 bytes

### Plugin Performance Data (`wp_plugin_performance`)

#### Active Plugins Simulation
The demo simulates performance data for common WordPress plugins:

```sql
-- Plugin performance summary
SELECT plugin_name, COUNT(*) as measurements,
       AVG(execution_time) as avg_time,
       AVG(memory_usage) as avg_memory,
       AVG(call_count) as avg_calls
FROM wp_plugin_performance
GROUP BY plugin_name
ORDER BY avg_time DESC;
```

**Plugin Performance Profiles:**
1. **performance-simulator**: Intentionally slow (0.5-2.5s, 1-6MB)
2. **woocommerce**: E-commerce complexity (0.2-1.2s, 0.5-3.5MB)
3. **elementor**: Page builder overhead (0.2-1.0s, 0.5-3MB)
4. **yoast-seo**: SEO analysis (0.1-0.4s, 0.2-1MB)
5. **jetpack**: Multiple features (0.1-0.5s, 0.3-1.5MB)
6. **contact-form-7**: Form processing (0.05-0.2s, 0.1-0.5MB)
7. **akismet**: Spam checking (0.03-0.15s, 0.1-0.3MB)

## Performance Scenarios

### Load Scenario Definitions

#### 1. Light Load Scenario
```php
'light_load' => array(
    'min_delay' => 0.1,
    'max_delay' => 0.5,
    'memory_factor' => 1,
    'query_complexity' => 'simple'
)
```
- **Use Case**: Normal WordPress operations
- **Database**: Simple SELECT queries
- **Memory**: Minimal allocation (100KB-500KB)
- **Response Time**: 0.1-0.5 seconds

#### 2. Medium Load Scenario
```php
'medium_load' => array(
    'min_delay' => 0.5,
    'max_delay' => 2.0,
    'memory_factor' => 2,
    'query_complexity' => 'moderate'
)
```
- **Use Case**: Moderate traffic with some complexity
- **Database**: JOINs with GROUP BY operations
- **Memory**: Moderate allocation (200KB-1MB)
- **Response Time**: 0.5-2.0 seconds

#### 3. Heavy Load Scenario
```php
'heavy_load' => array(
    'min_delay' => 2.0,
    'max_delay' => 8.0,
    'memory_factor' => 5,
    'query_complexity' => 'complex'
)
```
- **Use Case**: High traffic with resource-intensive operations
- **Database**: Subqueries with RAND() operations
- **Memory**: High allocation (500KB-2.5MB)
- **Response Time**: 2.0-8.0 seconds

#### 4. Critical Load Scenario
```php
'critical_load' => array(
    'min_delay' => 8.0,
    'max_delay' => 15.0,
    'memory_factor' => 10,
    'query_complexity' => 'extreme'
)
```
- **Use Case**: System under extreme stress
- **Database**: Complex queries with SLEEP(1) delays
- **Memory**: Very high allocation (1MB-5MB)
- **Response Time**: 8.0-15.0 seconds

### Performance Spike Simulation

#### Automatic Spike Generation
The demo automatically generates performance spikes:

```php
// 5% chance of 3-10x slower response
if (Math.random() < 0.05) {
    executionTime *= (Math.random() * 7 + 3);
}

// 3% chance of AJAX performance spike
if (Math.random() < 0.03) {
    executionTime *= (Math.random() * 5 + 2);
}
```

#### Background Load Simulation
Hourly background tasks simulate realistic server load:
- **Cron Jobs**: Automated maintenance tasks
- **Plugin Updates**: Background plugin operations
- **Cache Warming**: Preemptive cache generation
- **Backup Operations**: Simulated backup processes

## Data Generation Process

### Generation Phases

#### Phase 1: WordPress Content (60-120 seconds)
1. **User Creation**: Generate demo users with proper roles
2. **Post Generation**: Create varied blog posts and pages
3. **Media Upload**: Generate media library with metadata
4. **Comment Creation**: Add realistic comments and interactions
5. **Taxonomy Setup**: Create categories, tags, and relationships

#### Phase 2: Performance Data (120-300 seconds)
1. **Performance Logs**: Generate 1000-10000 performance entries
2. **Slow Queries**: Create 50-500 slow query examples
3. **AJAX Calls**: Generate 200-2000 AJAX call records
4. **Plugin Metrics**: Create plugin performance data
5. **Real-time Metrics**: Initialize live monitoring data

#### Phase 3: Validation and Optimization (30-60 seconds)
1. **Data Integrity**: Verify all relationships are correct
2. **Index Creation**: Ensure proper database indexing
3. **Performance Schema**: Configure MySQL performance monitoring
4. **Cache Warming**: Pre-populate query caches

### Data Size Configurations

#### Small Dataset (`DEMO_DATA_SIZE=small`)
- Posts: 25, Performance Logs: 1,000, AJAX Calls: 200
- Generation Time: ~2 minutes
- Disk Usage: ~50MB

#### Medium Dataset (`DEMO_DATA_SIZE=medium`) - Default
- Posts: 75, Performance Logs: 5,000, AJAX Calls: 1,000
- Generation Time: ~5 minutes
- Disk Usage: ~150MB

#### Large Dataset (`DEMO_DATA_SIZE=large`)
- Posts: 150, Performance Logs: 10,000, AJAX Calls: 2,000
- Generation Time: ~10 minutes
- Disk Usage: ~300MB

## Data Validation

### Validation Queries

#### Content Validation
```sql
-- Verify content generation
SELECT 
    (SELECT COUNT(*) FROM wp_posts WHERE post_status = 'publish' AND post_type = 'post') as posts,
    (SELECT COUNT(*) FROM wp_posts WHERE post_status = 'publish' AND post_type = 'page') as pages,
    (SELECT COUNT(*) FROM wp_comments WHERE comment_approved = '1') as comments,
    (SELECT COUNT(*) FROM wp_users) as users;
```

#### Performance Data Validation
```sql
-- Verify performance data
SELECT 
    (SELECT COUNT(*) FROM wp_performance_logs) as performance_logs,
    (SELECT COUNT(*) FROM wp_ajax_calls) as ajax_calls,
    (SELECT COUNT(*) FROM wp_plugin_performance) as plugin_metrics,
    (SELECT COUNT(*) FROM wp_slow_queries) as slow_queries;
```

#### Data Quality Checks
```sql
-- Check data quality
SELECT 
    'Performance Logs' as table_name,
    MIN(timestamp) as earliest,
    MAX(timestamp) as latest,
    AVG(execution_time) as avg_execution_time
FROM wp_performance_logs
UNION ALL
SELECT 
    'AJAX Calls',
    MIN(timestamp),
    MAX(timestamp),
    AVG(execution_time)
FROM wp_ajax_calls;
```

## Monitoring and Maintenance

### Real-time Data Updates

The demo environment continuously generates new performance data:

#### Automatic Data Generation
- **Background Tasks**: Hourly performance simulation
- **User Interactions**: Simulated user activity
- **Plugin Operations**: Automated plugin performance events
- **System Metrics**: Live system health updates

#### Data Retention Policies
```sql
-- Automatic cleanup (runs daily)
DELETE FROM wp_performance_logs WHERE timestamp < DATE_SUB(NOW(), INTERVAL 7 DAY);
DELETE FROM wp_ajax_calls WHERE timestamp < DATE_SUB(NOW(), INTERVAL 7 DAY);
DELETE FROM wp_plugin_performance WHERE timestamp < DATE_SUB(NOW(), INTERVAL 7 DAY);

-- Keep only last 1000 real-time metrics
DELETE rm1 FROM wp_realtime_metrics rm1
LEFT JOIN (
    SELECT id FROM wp_realtime_metrics 
    ORDER BY timestamp DESC 
    LIMIT 1000
) rm2 ON rm1.id = rm2.id
WHERE rm2.id IS NULL;
```

### Performance Optimization

#### Database Indexing
The demo includes optimized indexes for performance monitoring:

```sql
-- Performance-critical indexes
CREATE INDEX idx_perf_timestamp ON wp_performance_logs(timestamp);
CREATE INDEX idx_perf_query_type ON wp_performance_logs(query_type);
CREATE INDEX idx_perf_plugin ON wp_performance_logs(plugin_context);
CREATE INDEX idx_ajax_action ON wp_ajax_calls(action);
CREATE INDEX idx_ajax_timestamp ON wp_ajax_calls(timestamp);
CREATE INDEX idx_plugin_name ON wp_plugin_performance(plugin_name);
```

#### Query Optimization
Common dashboard queries are optimized for performance:

```sql
-- Optimized real-time metrics query
SELECT metric_name, metric_value, timestamp
FROM wp_realtime_metrics
WHERE timestamp > DATE_SUB(NOW(), INTERVAL 1 HOUR)
ORDER BY timestamp DESC;

-- Optimized slow query analysis
SELECT query_type, AVG(execution_time) as avg_time, COUNT(*) as count
FROM wp_performance_logs
WHERE execution_time > 1.0
  AND timestamp > DATE_SUB(NOW(), INTERVAL 24 HOUR)
GROUP BY query_type
ORDER BY avg_time DESC;
```

This comprehensive data structure provides a realistic foundation for demonstrating WordPress performance monitoring capabilities while maintaining data integrity and performance optimization.
