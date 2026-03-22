# Docker Management

## Overview

View and control Docker containers running on the server. Start, stop, and restart containers from the dashboard. Only visible if Docker is installed.

## How to Use

- **Container list:** Shows all containers (running + stopped) with name, image, status, ports
- **Actions:** Start/Stop/Restart buttons per container
- **Status badges:** Running (green), Stopped (gray), Exited (red)
- **Refresh:** Manual refresh or auto-poll every 10s

## Data Flow

```
Page → GET /api/docker → execSync('docker ps -a --format json')
     → POST /api/docker → docker start/stop/restart <id>
```

## Requirements

- Docker must be installed (`which docker`)
- The server process must have permission to run `docker` commands
- On Linux, add the server user to the `docker` group: `sudo usermod -aG docker $USER`

## Notes

- If Docker is not installed, the page shows a helpful "Not installed" message
- Container logs are not currently displayed (future feature)
- Volume and network management are not included (use Docker CLI or Portainer for advanced management)
