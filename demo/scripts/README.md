# Demo Data Generator

This directory contains scripts for generating realistic demo data for the WordPress Performance Dashboard demo environment.

## Overview

The demo data generator creates comprehensive test data including:

- **WordPress Content**: Posts, pages, users, media metadata, and comments
- **Performance Logs**: Realistic database query performance data with varied patterns
- **AJAX Call Data**: Simulated admin-ajax calls with realistic timing and response data
- **Plugin Performance**: Performance metrics for various WordPress plugins

## Usage

### Basic Usage

```bash
# Run with default settings (medium dataset)
node demo/scripts/generate-demo-data.js

# Or use npm script
npm run seed:sample-data
```

### Environment Variables

Configure the generator using environment variables:

```bash
# Database connection
DB_HOST=demo-mysql          # Database host (default: demo-mysql)
DB_USER=demo_user          # Database user (default: demo_user)
DB_PASSWORD=demo_password  # Database password (default: demo_password)
DB_NAME=demo_wordpress     # Database name (default: demo_wordpress)
DB_PORT=3306              # Database port (default: 3306)

# Data generation settings
DEMO_DATA_SIZE=medium     # Dataset size: small, medium, large (default: medium)
```

### Dataset Sizes

| Size   | Posts | Performance Logs | AJAX Calls | Plugin Performance |
|--------|-------|------------------|------------|--------------------|
| Small  | 25    | 1,000           | 200        | 300               |
| Medium | 75    | 5,000           | 1,000      | 1,500             |
| Large  | 150   | 10,000          | 2,000      | 3,000             |

## Generated Data Structure

### WordPress Content

- **Users**: Demo users with different roles (admin, editor, author, contributor, subscriber)
- **Posts**: Blog posts with varied content lengths and performance metadata
- **Pages**: Static pages for demo navigation and content
- **Media**: Attachment metadata for images, videos, and documents
- **Comments**: User comments on posts with realistic timestamps

### Performance Data

#### Performance Logs (`wp_performance_logs`)
- Query execution times with realistic variance
- Different query patterns (post_lookup, meta_query, taxonomy_query, etc.)
- Plugin-specific performance data
- Memory usage tracking

#### AJAX Calls (`wp_ajax_calls`)
- Realistic admin-ajax actions (heartbeat, save_post, query_attachments, etc.)
- Varied execution times based on action complexity
- User agent and IP address simulation
- Success/failure rates

#### Plugin Performance (`wp_plugin_performance`)
- Hook-specific performance metrics
- Memory usage per plugin
- Call count tracking
- Realistic performance characteristics per plugin type

## Docker Integration

The generator is designed to run in a Docker container as part of the demo environment:

```yaml
demo-data-generator:
  build:
    context: .
    dockerfile: demo/data-generator/Dockerfile
  depends_on:
    demo-mysql:
      condition: service_healthy
    demo-wordpress:
      condition: service_healthy
  environment:
    - DB_HOST=demo-mysql
    - DEMO_DATA_SIZE=medium
  restart: "no"
  profiles:
    - init
```

## Testing

Test the generator without a database connection:

```bash
node demo/scripts/test-generator.js
```

## Data Validation

The generator includes built-in validation to ensure data quality:

- Minimum record counts for each data type
- Data integrity checks
- Performance metric validation
- Comprehensive logging of generation results

## Troubleshooting

### Common Issues

1. **Database Connection Failed**
   - Ensure MySQL container is running and healthy
   - Verify database credentials and network connectivity

2. **WordPress Not Ready**
   - The generator waits up to 5 minutes for WordPress initialization
   - Check WordPress container logs for initialization issues

3. **Insufficient Data Generated**
   - Check validation output for specific data type issues
   - Verify database permissions for table creation

### Logs

The generator provides detailed logging:
- Connection status
- Generation progress (every 10-100 records)
- Validation results
- Error messages with context

## Performance Considerations

- Generation time varies by dataset size (1-10 minutes)
- Memory usage scales with dataset size
- Database performance affects generation speed
- Consider running during off-peak hours for large datasets

## Customization

To customize the generated data:

1. **Modify Data Patterns**: Edit the query patterns and AJAX actions in the generator
2. **Adjust Frequencies**: Change the frequency weights for different data types
3. **Add New Data Types**: Extend the generator with additional tables and data structures
4. **Custom Content**: Modify the sample content arrays for posts, pages, and comments
