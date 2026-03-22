# Clipboard

The Clipboard page provides a shared clipboard for syncing text snippets between devices. Paste text on one device and retrieve it from another through the server.

## How to Use

- **Paste** or type text into the clipboard input area
- **Save** the snippet to the server
- **View** all saved clipboard entries with timestamps
- **Copy** any entry to your local clipboard with one click
- **Delete** entries you no longer need
- **Search** through saved snippets

## Data Flow

1. `src/routes/clipboard/+page.svelte` renders the clipboard UI
2. Client-side fetches hit `src/routes/api/clipboard/+server.ts` for CRUD operations
3. `src/lib/server/clipboard.ts` persists snippets to a server-side data store
4. All connected devices see the same clipboard contents

## Keyboard Shortcuts

No dedicated shortcuts.

## Tips

- Useful for transferring text between your phone and desktop via the Home Server
- Clipboard entries persist until manually deleted
- Large text blocks are supported but very long content may be truncated in the preview
- The clipboard is shared across all users of the Home Server instance
