# Documentation

This folder contains all documentation for the WordPress Performance Dashboard project.

## Quick Links

- [Main README](../README.md) - Project overview and quick start
- [Demo README](../demo/README.md) - Demo environment details

## Setup & Deployment

| Document | Description |
|----------|-------------|
| [Docker Setup](docker-setup.md) | Docker Compose configurations and deployment options |

## Architecture & Design

| Document | Description |
|----------|-------------|
| [Demo Integration](demo-integration.md) | How the demo environment integrates with the main app |
| [Error Recovery](error-recovery-mechanisms.md) | Historical notes on the older client-side recovery approach |

## Current Runtime Notes

- The active server now runs from the root entrypoint and is organized under `src/server/`
- Dashboard loads use the aggregated `GET /api/dashboard` snapshot endpoint
- Realtime metrics are delivered over Socket.IO and server-side polling stays idle without connected clients
- Browser code is split across `public/js/api.js`, `state.js`, `renderers.js`, `realtime.js`, and `bootstrap.js`
- Automated validation includes both Jest coverage and a Playwright Chromium smoke test

## Demo Environment

Detailed documentation for the demo WordPress environment.

| Document | Description |
|----------|-------------|
| [Quick Start](demo/quick-start.md) | Get the demo running in under 5 minutes |
| [Data Structure](demo/data-structure.md) | Demo data schema, content, and performance metrics |
| [Scripts](demo/scripts.md) | Management scripts (start, stop, reset, etc.) |
| [Troubleshooting](demo/troubleshooting.md) | Common issues and solutions |

## Project Management

| Document | Description |
|----------|-------------|
| [Todo](todo.md) | Current task tracking |
| [Demo Todo](demo-todo.md) | Demo recording tasks |

## Assets

This folder also contains documentation assets:

- `*.gif` - Animated demo recordings for visual documentation
