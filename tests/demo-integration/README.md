# Demo Integration Tests

This directory contains Jest integration tests for the demo environment.

## Test Structure

- `container-health.test.js` - Tests for demo container startup and health checks
- `data-generation.test.js` - Tests for demo data generation and validation
- `wordpress-functionality.test.js` - Tests for WordPress functionality with demo content
- `dashboard-connectivity.test.js` - Tests for performance dashboard connectivity with demo database

## Prerequisites

- Docker and Docker Compose must be installed and running
- Demo environment must be set up and accessible
- Jest must be configured (see `jest.config.js` at the project root)
