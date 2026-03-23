# Notes

A Notion-inspired block editor for creating and organizing notes.

## Features

- **Block-based editing** — 10 block types: text, H1/H2/H3, bullet list, numbered list, to-do checkbox, code, quote, divider
- **Auto-save** — saves automatically 1 second after you stop typing
- **Keyboard shortcuts** — Enter creates new block, Backspace on empty block deletes it
- **Block type switching** — change any block's type via dropdown without losing content
- **Sidebar navigation** — searchable note list sorted by last modified
- **Nested pages** — notes can be children of other notes (parentId)
- **Custom icons** — per-note emoji/icon support
- **Mobile responsive** — sidebar collapses to top panel on narrow screens

## Block Types

| Type          | Description                               |
| ------------- | ----------------------------------------- |
| Text          | Default paragraph text                    |
| Heading 1/2/3 | Three heading levels with distinct sizes  |
| Bullet list   | Unordered list with bullet markers        |
| Numbered list | Ordered list items                        |
| To-do         | Checkbox with strikethrough on complete   |
| Code          | Monospace code block                      |
| Quote         | Italicized block quote with accent border |
| Divider       | Horizontal rule separator                 |

## Storage

Notes are stored as individual JSON files in `~/.home-server/notes/{id}.json`.

## API

| Endpoint          | Method | Description                         |
| ----------------- | ------ | ----------------------------------- |
| `/api/notes`      | GET    | List all notes (without blocks)     |
| `/api/notes?id=X` | GET    | Get a single note with blocks       |
| `/api/notes`      | POST   | Create a new note                   |
| `/api/notes`      | PUT    | Update a note (title, blocks, icon) |
| `/api/notes`      | DELETE | Delete a note and its children      |
