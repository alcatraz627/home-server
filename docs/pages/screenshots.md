# Screenshots

The Screenshots page captures and displays screenshots from the server's display. It provides a gallery view of captured screens with timestamp and download options.

## How to Use

- **Capture** a new screenshot by clicking the capture button
- **Browse** the screenshot gallery sorted by date (newest first)
- **View** full-size screenshots by clicking on thumbnails
- **Download** individual screenshots as PNG files
- **Delete** old screenshots to free up disk space

## Data Flow

1. `src/routes/screenshots/+page.svelte` renders the gallery UI
2. `src/routes/screenshots/+page.server.ts` lists existing screenshot files
3. `src/routes/api/screenshots/+server.ts` handles capture, list, and delete operations
4. Screenshots are stored as image files on the server filesystem

## Keyboard Shortcuts

No dedicated shortcuts.

## Tips

- Screenshot capture requires the server to have a display or virtual framebuffer
- Headless servers may need Xvfb or similar for screenshot support
- Screenshots are stored at full resolution; disk usage grows with frequent captures
- The gallery shows thumbnails for fast loading with full-size view on click
