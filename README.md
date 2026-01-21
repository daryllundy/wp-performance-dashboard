# WordPress Performance Dashboard

Real-time WordPress performance monitoring dashboard for database, plugin, and system metrics, styled like Grafana/Netdata.

## Highlights
- Live metrics for response time, QPS, and memory
- Slow query and plugin impact analysis
- Admin-Ajax monitoring and recommendations
- REST API + WebSocket updates
- Docker-ready demo environment

## Demo (Recommended)
Spin up the full demo stack (WordPress + MySQL + dashboard):

```bash
./demo/start-demo.sh start --with-dashboard
```

Access:
- WordPress: http://localhost:8090 (admin/demo_password)
- Dashboard: http://localhost:3001
- MySQL: localhost:3307 (demo_user/demo_password)

Full demo docs: `demo/README.md`

## Local Run (Node)
```bash
npm install
cp .env.dashboard.example .env
npm run seed:sample-data
npm start
```

Dashboard: http://localhost:3000

**App start recording (800x500):**
![App start recording](docs/app-start.gif)

## Docker
- Full stack: `docker-compose -f docker-compose.full.yml up -d`
- Dashboard-only: `docker-compose -f docker-compose.dashboard.yml up -d`

See [Docker Setup Guide](docs/docker-setup.md) for details.

## API (Quick Look)
- `GET /api/metrics`
- `GET /api/slow-queries`
- `GET /api/system-health`

Full API notes: `docs/`

## Testing
```bash
npm test
npm run test:docker
```

## Documentation

| Document | Description |
|----------|-------------|
| [Docker Setup](docs/docker-setup.md) | Docker configuration and deployment |
| [Demo Integration](docs/demo-integration.md) | How the demo environment integrates |
| [Error Recovery](docs/error-recovery-mechanisms.md) | Error handling and recovery systems |
| [Demo Quick Start](docs/demo/quick-start.md) | Get the demo running in minutes |
| [Demo Data Structure](docs/demo/data-structure.md) | Demo data schema and content |
| [Demo Scripts](docs/demo/scripts.md) | Management script documentation |
| [Demo Troubleshooting](docs/demo/troubleshooting.md) | Common issues and solutions |

## Project Links
- Demo Environment: [demo/README.md](demo/README.md)
- Task Tracking: [docs/todo.md](docs/todo.md)
- License: MIT
