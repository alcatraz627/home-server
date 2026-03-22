# Tasks

The Tasks page is an automation engine for running shell commands on the server. It supports one-off execution, cron scheduling, templates, retries, and timeout controls.

## How to Use

- **View** all configured tasks with their last run status, exit code, and output
- **Create** a new task by filling in the name, command, timeout, and retry count
- **Schedule** tasks with cron expressions (e.g., `*/5 * * * *` for every 5 minutes)
- **Run** any task on-demand by clicking its play button
- **Use templates** to quickly create common tasks (disk alerts, network checks, cleanup scripts)
- **Edit or delete** existing tasks from the task list
- **View output** of the last run inline, including stdout and stderr

## Data Flow

1. `src/routes/tasks/+page.svelte` renders the task list, form, and templates
2. `src/routes/tasks/+page.server.ts` loads saved task configs and their latest statuses
3. `src/routes/api/tasks/+server.ts` handles CRUD, execution, and scheduling
4. `src/lib/server/operator.ts` manages task lifecycle, retry logic, and cron scheduling

## Keyboard Shortcuts

No dedicated shortcuts.

## Tips

- Templates provide pre-built tasks for common operations (disk alerts, service checks, log rotation)
- Tasks with a cron schedule run automatically even when the browser is closed
- Timeout prevents runaway commands; adjust for long-running scripts
- Retries are useful for flaky network operations; failed tasks retry automatically
- Cron output indicator shows whether the last scheduled run succeeded or failed
