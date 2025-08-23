# Demo Environment Integration

This document describes the demo environment integration feature that allows the main WordPress Performance Dashboard to connect to and interact with the demo environment.

## Overview

The demo integration feature provides:

1. **Automatic Demo Detection**: The dashboard automatically detects when a demo environment is available
2. **Demo Mode Toggle**: Users can switch between live data and demo data
3. **Demo Status Monitoring**: Real-time status of demo environment services
4. **Demo Data Refresh**: Ability to regenerate demo data from the dashboard

## Features

### Demo Mode Indicator

When demo mode is active, a visual indicator appears in the dashboard header:
- 🎭 **DEMO MODE** badge with glowing animation
- Connection status showing number of demo posts
- Clear visual distinction from live mode

### Demo Controls

The dashboard provides controls to:
- **Switch to Demo/Live**: Toggle between demo and live data sources
- **Refresh Demo Data**: Regenerate demo data with fresh content
- **Monitor Demo Status**: Check health of demo services

### API Integration

All existing API endpoints support demo mode:
- `/api/metrics?demo=true` - Performance metrics from demo database
- `/api/slow-queries?demo=true` - Slow queries from demo environment
- `/api/admin-ajax?demo=true` - Admin AJAX data from demo
- `/api/plugins?demo=true` - Plugin performance from demo
- `/api/system-health?demo=true` - System health with demo flag

### New Demo-Specific Endpoints

- `GET /api/demo-status` - Check demo environment availability and status
- `POST /api/demo-refresh` - Trigger demo data regeneration

## Configuration

### Environment Variables

- `DEMO_MODE=true` - Enable demo mode by default
- `NODE_ENV=demo` - Alternative way to enable demo mode

### Demo Database Connection

The system automatically connects to the demo database when available:
- **Host**: `demo-mysql`
- **Port**: `3306`
- **Database**: `demo_wordpress`
- **User**: `demo_user`
- **Password**: `demo_password`

## Usage

### Starting with Demo Mode

1. Start the demo environment:
   ```bash
   docker-compose -f docker-compose.demo.yml up -d
   ```

2. Start the main dashboard:
   ```bash
   DEMO_MODE=true npm start
   ```

3. Access the dashboard at `http://localhost:3000`

### Switching Between Modes

- Click the **"Switch to Demo"** button to view demo data
- Click **"Switch to Live"** to return to live data
- The demo indicator will show when in demo mode

### Refreshing Demo Data

1. Click the refresh button (🔄) next to the demo toggle
2. Wait for the refresh process to complete
3. Dashboard will automatically reload with fresh demo data

## Technical Implementation

### Server-Side Changes

- Added demo database pool management
- Enhanced API endpoints with demo parameter support
- Added demo status checking and data refresh endpoints
- Modified real-time broadcasting to include demo mode flag

### Client-Side Changes

- Added demo mode UI components and styling
- Implemented demo status checking and controls
- Enhanced API calls to include demo parameter
- Added notification system for demo operations

### Database Integration

- Automatic detection of demo database availability
- Fallback handling when demo database is unavailable
- Connection pooling for both live and demo databases
- Health checking for demo services

## Error Handling

The system gracefully handles various error scenarios:

- **Demo Database Unavailable**: Falls back to live database
- **Demo Refresh Failures**: Shows error notifications with details
- **Connection Timeouts**: Provides timeout handling and retry logic
- **Service Health Issues**: Displays service status in demo indicator

## Testing

The demo integration includes comprehensive tests:

- Unit tests for demo API endpoints
- Integration tests for server startup with demo mode
- UI component tests for demo controls
- Error handling and fallback scenario tests

Run tests with:
```bash
npm test -- tests/demo-integration.test.js
npm test -- tests/demo-server-integration.test.js
```

## Security Considerations

- Demo database credentials are separate from production
- Demo mode is clearly indicated to prevent confusion
- Demo data refresh is limited to demo environment only
- No sensitive data should be included in demo environment

## Future Enhancements

Potential improvements for the demo integration:

1. **Demo Scenarios**: Pre-configured performance scenarios
2. **Demo Scheduling**: Automatic demo data refresh on schedule
3. **Demo Analytics**: Usage tracking for demo environment
4. **Demo Customization**: User-configurable demo parameters
