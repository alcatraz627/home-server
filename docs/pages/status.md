# App Status

Server health dashboard showing application info, resource usage, and storage breakdown.

## Features

- **Health indicator** — green/yellow/red banner based on CPU load and memory usage
- **Application info** — version, Node.js version, PID, page count, git branch/commit
- **Server info** — hostname, platform, CPU model/cores, uptime, load average
- **Memory visualization** — bar chart with percentage and GB used/total
- **Storage breakdown** — per-directory sizes for logs, notes, screenshots, uploads, configs
- **Auto-refresh** — click Refresh to update all metrics

## Sections

| Section       | Data                                   |
| ------------- | -------------------------------------- |
| Health Banner | Green/yellow/red status with latency   |
| Application   | Version, Node.js, PID, git info        |
| Server        | Hostname, CPU, cores, uptime, load     |
| Memory        | Usage bar, percentage, GB values       |
| Storage       | Size and file count per data directory |

## API

| Endpoint      | Method | Description                                |
| ------------- | ------ | ------------------------------------------ |
| `/api/status` | GET    | Full status including app, server, storage |
| `/api/health` | GET    | Quick health check (status + latency)      |
