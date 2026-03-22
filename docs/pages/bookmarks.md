# Bookmarks

The Bookmarks page is a link manager for saving, organizing, and quickly accessing URLs. It supports tags, search, and categorization for building a personal link library.

## How to Use

- **Add** a new bookmark by entering a URL, title, and optional tags
- **Browse** saved bookmarks in a searchable, filterable list
- **Search** by title, URL, or tag to find specific bookmarks
- **Edit** bookmark details (title, URL, tags) inline
- **Delete** bookmarks you no longer need
- **Click** any bookmark to open it in a new tab

## Data Flow

1. `src/routes/bookmarks/+page.svelte` renders the bookmark list and add form
2. `src/routes/bookmarks/+page.server.ts` loads bookmarks on initial page load
3. `src/routes/api/bookmarks/+server.ts` handles CRUD operations
4. `src/lib/server/bookmarks.ts` persists bookmarks to a JSON data store

## Keyboard Shortcuts

No dedicated shortcuts.

## Tips

- Tags help organize bookmarks into categories for quick filtering
- Bookmarks are stored server-side, so they are accessible from any device
- Use the search box for instant filtering across all bookmark fields
- Bookmark URLs are validated before saving
