# Keeper

Keeper is a feature tracker and project management tool built into Home Server. It lets you track features, bugs, ideas, and tasks with status workflows, labels, and priority levels.

## How to Use

- **View** all tracked items in a filterable, sortable list
- **Create** new items with a title, description, type (feature/bug/idea), and priority
- **Update status** by moving items through workflow stages (e.g., backlog, in progress, done)
- **Filter** by type, status, priority, or search text
- **Edit** any item inline to update its details
- **Delete** items that are no longer relevant

## Data Flow

1. `src/routes/keeper/+page.svelte` renders the tracker UI
2. `src/routes/keeper/+page.server.ts` loads all items from persistent storage
3. `src/routes/api/keeper/+server.ts` handles CRUD operations
4. `src/lib/server/keeper.ts` manages the data store (JSON file or database)

## Keyboard Shortcuts

No dedicated shortcuts.

## Tips

- Keeper is designed for tracking Home Server's own features and roadmap
- Use priorities to surface the most important items at the top
- Labels help categorize items beyond the built-in type system
- Items persist across server restarts; data is stored server-side
