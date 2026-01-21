# Asciinema Recording Tasks

## Overview

Create terminal recordings demonstrating the WP Performance Dashboard demo environment, then convert them to animated GIFs for documentation.

## Current Status

| Task | Status | Progress |
|------|--------|----------|
| Review project for demo scenarios | ✅ Complete | Done |
| Document suggested recording steps | ✅ Complete | Done |
| Record asciinema demos | 🔶 In Progress | 2/6 |
| Convert recordings to GIFs | 🔶 In Progress | 3 GIFs exist |

## Tools

- **asciinema**: Terminal recording tool
- **agg**: v1.7.0 installed at `/opt/homebrew/bin/agg` - converts .cast to .gif

---

## Existing Recordings

| File | Description | GIF Converted |
|------|-------------|---------------|
| `demo/recordings/01-demo-overview.cast` | Shows manage-demo.sh overview command | ❌ No |
| `demo/recordings/02-demo-validation.cast` | Shows validate-demo-setup.sh output | ❌ No |

## Existing GIFs

- `docs/app-start.gif` - Application startup
- `docs/demo-setup.gif` - Demo setup process
- `demo/dashboard-demo.gif` - Dashboard demonstration

---

## Suggested Recordings

### 1. Demo Overview (EXISTS)
- [x] **File**: `demo/recordings/01-demo-overview.cast`
- [ ] Convert to GIF
- **Command**: `./demo/manage-demo.sh overview`
- **Purpose**: Show available demo commands and architecture

### 2. Demo Validation (EXISTS)
- [x] **File**: `demo/recordings/02-demo-validation.cast`
- [ ] Convert to GIF
- **Command**: `./demo/validate-demo-setup.sh`
- **Purpose**: Show setup validation checks

### 3. Demo Startup
- [ ] Record asciinema
- [ ] Convert to GIF
- **Commands**:
  ```bash
  ./demo/start-demo.sh start --with-dashboard
  # Wait for services to become healthy
  ./demo/status-demo.sh
  ```
- **Purpose**: Show full demo environment startup process

### 4. Demo Status Check
- [ ] Record asciinema
- [ ] Convert to GIF
- **Commands**:
  ```bash
  ./demo/status-demo.sh --detailed
  ```
- **Purpose**: Show service health and status information

### 5. Demo Reset/Cleanup
- [ ] Record asciinema
- [ ] Convert to GIF
- **Commands**:
  ```bash
  ./demo/reset-demo.sh --force
  ```
- **Purpose**: Show how to reset demo to clean state

### 6. Quick Start Flow
- [ ] Record asciinema
- [ ] Convert to GIF
- **Commands**:
  ```bash
  # Full quick start sequence
  ./demo/manage-demo.sh setup
  ./demo/start-demo.sh start --with-dashboard
  ./demo/status-demo.sh
  echo "Access WordPress: http://localhost:8090"
  echo "Access Dashboard: http://localhost:3001"
  ```
- **Purpose**: Complete beginner walkthrough

---

## Recording Commands

### Record a new asciinema
```bash
# Basic recording
asciinema rec demo/recordings/FILENAME.cast

# With specific settings
asciinema rec \
  --idle-time-limit 2 \
  --title "Recording Title" \
  demo/recordings/FILENAME.cast
```

### Convert .cast to .gif using agg
```bash
# Basic conversion
agg demo/recordings/INPUT.cast demo/recordings/OUTPUT.gif

# With custom settings
agg \
  --cols 100 \
  --rows 30 \
  --font-size 14 \
  --speed 1.5 \
  demo/recordings/INPUT.cast \
  demo/recordings/OUTPUT.gif
```

---

## Task Checklist

### Phase 1: Convert Existing Recordings
- [ ] Convert `01-demo-overview.cast` to `01-demo-overview.gif`
- [ ] Convert `02-demo-validation.cast` to `02-demo-validation.gif`

### Phase 2: Record New Demos
- [ ] Record `03-demo-startup.cast` - Full startup with dashboard
- [ ] Record `04-demo-status.cast` - Detailed status check
- [ ] Record `05-demo-reset.cast` - Reset and cleanup
- [ ] Record `06-quick-start.cast` - Complete quick start flow

### Phase 3: Convert New Recordings
- [ ] Convert `03-demo-startup.cast` to GIF
- [ ] Convert `04-demo-status.cast` to GIF
- [ ] Convert `05-demo-reset.cast` to GIF
- [ ] Convert `06-quick-start.cast` to GIF

### Phase 4: Integration
- [ ] Move final GIFs to `docs/` directory
- [ ] Update README.md with embedded GIFs
- [ ] Update demo/README.md with relevant GIFs

---

## Notes

- Keep recordings short (< 30 seconds each)
- Use `--idle-time-limit 2` to cap pauses
- Recommended GIF settings: 100 cols, 30 rows, font-size 14
- Consider using `--speed 1.5` for faster playback
