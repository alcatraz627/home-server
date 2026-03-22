# Kanban

The Kanban page provides a drag-and-drop project board with customizable columns. It is useful for visual task management and workflow tracking.

## How to Use

- **View** cards organized in columns (e.g., To Do, In Progress, Done)
- **Create** new cards with a title and optional description
- **Drag and drop** cards between columns to update their status
- **Edit** card details by clicking on a card
- **Delete** cards that are completed or no longer needed
- **Reorder** cards within a column by dragging them up or down

## Data Flow

1. `src/routes/kanban/+page.svelte` renders the board with drag-and-drop support
2. `src/routes/kanban/+page.server.ts` loads board state on initial page load
3. `src/routes/api/kanban/+server.ts` handles card CRUD and column operations
4. `src/lib/server/kanban.ts` persists board data to a JSON data store

## Keyboard Shortcuts

No dedicated shortcuts. Drag-and-drop is the primary interaction model.

## Tips

- Columns can be customized to match your workflow
- Card positions are saved automatically when you drop them
- The board supports multiple projects or contexts
- Data persists server-side; access your board from any device
