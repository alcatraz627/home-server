# Files

The Files page is a full-featured file browser and transfer tool. You can navigate directories, upload and download files, preview documents, stream media, and manage files on the server's filesystem.

## How to Use

- **Browse** directories by clicking folder names; use the breadcrumb path bar to jump back
- **Upload** files by clicking the upload button or dragging files onto the page
- **Download** any file by clicking its download icon
- **Preview** supported file types inline: markdown, images, CSV/Excel tables, PDFs, code files
- **Stream** video and audio files with the built-in media player (MP4, WebM, MP3, FLAC, etc.)
- **Delete** files using the trash icon (confirmation required)
- **Create** new folders with the new-folder button

## Data Flow

1. `src/routes/files/+page.svelte` renders the file browser UI with previews and media player
2. `src/routes/files/+page.server.ts` reads directory listings on initial load
3. `src/routes/api/files/+server.ts` handles upload, download, delete, and directory operations
4. `src/routes/api/files/stream/` serves media files for the built-in player
5. `src/lib/server/files.ts` provides the low-level filesystem operations

## Keyboard Shortcuts

No dedicated shortcuts. Standard browser file-input shortcuts apply for uploads.

## Tips

- The file browser supports Excel/CSV rendering as sortable data tables
- Media files play in a modal player with playlist support for browsing folders of media
- Markdown files are rendered with full formatting in the preview pane
- Large uploads show a progress indicator; the server streams the file to disk
- File metadata (size, modified date) is displayed in the listing columns
