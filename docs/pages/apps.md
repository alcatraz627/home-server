# Application Launcher

## Overview

Browse and launch applications installed on the server machine. Shows a searchable grid of apps with running status detection.

## How to Use

- **Browse:** Apps shown as cards grouped by first letter
- **Search:** Filter by app name
- **Launch:** Click any app card to launch it on the server
- **Running indicator:** Green "Running" badge on apps with active processes (polled every 10s)

## Data Flow

```
Page → GET /api/apps → scan /Applications (macOS) or .desktop files (Linux)
     → POST /api/apps { path } → exec('open "path"') (macOS) or xdg-open (Linux)
```

## Platform Support

| Platform | App Discovery | Launch Method |
|----------|--------------|---------------|
| macOS | `/Applications/*.app` | `open "path"` |
| Linux | `/usr/share/applications/*.desktop` | Exec command or `xdg-open` |

## Notes

- On macOS, launching requires the server to have access to the GUI session
- Running app detection uses `ps -eo comm` and matches against app paths
- The app list is scanned on each page load (not cached) to reflect installs/uninstalls
