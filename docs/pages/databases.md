# Databases & Services

Monitor and manage database services and process managers installed on the system.

## Supported Services

| Service        | Detection             | Details                                               |
| -------------- | --------------------- | ----------------------------------------------------- |
| **PostgreSQL** | `pg_isready` / `psql` | Database list with sizes, connection count            |
| **Redis**      | `redis-cli INFO`      | Key count, memory usage, connected clients, uptime    |
| **MongoDB**    | `mongosh` / `mongod`  | Connection count, version, running status             |
| **PM2**        | `pm2 jlist`           | Process list with CPU/MEM, restart/stop/start actions |

## Features

- **Auto-detection** — checks if each service is installed and running
- **Status dashboard** — shows version, PID, port, memory, connections per service
- **Expandable details** — click a service card to load detailed info
- **PM2 management** — restart, stop, start individual processes
- **Graceful fallback** — shows "Not Installed" for missing services

## API

| Endpoint                          | Method | Description                                   |
| --------------------------------- | ------ | --------------------------------------------- |
| `/api/databases`                  | GET    | List all service statuses                     |
| `/api/databases?service=postgres` | GET    | PostgreSQL database list                      |
| `/api/databases?service=redis`    | GET    | Redis key count + info                        |
| `/api/databases?service=pm2`      | GET    | PM2 process list                              |
| `/api/databases`                  | POST   | PM2 actions (restart/stop/start), Redis flush |
