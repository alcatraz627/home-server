# Terminal

The Terminal page provides full shell access to the server through the browser. It uses xterm.js with WebSocket connections for real-time, interactive terminal sessions with tab support.

## How to Use

- **Open** a new terminal tab by clicking the "+" button
- **Switch** between multiple terminal tabs using the tab bar
- **Type** commands directly; they execute on the server in a persistent shell session
- **Close** tabs individually; sessions persist across page navigations via sessionStorage
- **Resize** the terminal by resizing the browser window (auto-fits)
- **Adjust font size** using the font size controls
- **Rename** a tab by double-clicking its label

## Shared Sessions

Sessions are multi-client — multiple browser tabs or a system terminal can attach to the same running PTY simultaneously. All connections share full input and output.

### Session bar

The "Running:" bar at the top lists all active server sessions. Each badge shows:
- Session label and short ID
- A client count number when more than one connection is active
- A terminal icon (hover) that copies the CLI attach command to clipboard

Click any badge to attach the current browser tab to that session.

### Connecting from a system terminal

Click **"Connect from system terminal"** on the page for inline instructions, or see below.

#### Option A — Attach to an app session

Start a session in the app, then join it from iTerm/Terminal.app/SSH:

```bash
# From the project root on the same machine:
node scripts/attach.mjs                   # list all active sessions
node scripts/attach.mjs <session-id>      # attach to a specific one
node scripts/attach.mjs <id> --port 5555  # explicit port
TERMINAL_PIN=1234 node scripts/attach.mjs <id>  # non-interactive PIN
```

**Detach** with `Ctrl-Q` or `Ctrl-B` then `d` — the session stays alive on the server.

The script discovers the server port automatically from `~/.home-server/config.json`, which the server writes on startup. The default port is 5555.

#### Option B — Attach to an existing terminal via tmux

If you already have a session running in your system terminal (e.g., Claude Code in iTerm), wrap it in tmux so the app can join it:

**Step 1** — In your system terminal, create or resume a named tmux session:
```bash
tmux new-session -s my-work     # start new
tmux attach -t my-work          # or resume existing one
```

**Step 2** — In the app, open a new terminal tab and run:
```bash
tmux attach -t my-work
```

Both the system terminal and the app terminal now share the same tmux session. Use `Ctrl-B d` to detach from either side without killing the session.

### Renaming sessions

Double-click a tab label to rename it. The new name propagates to all attached clients (other browser tabs and CLI connections) in real time.

## Data Flow

1. `src/routes/terminal/+page.svelte` renders xterm.js terminals in tabbed containers
2. WebSocket connections are established to `/ws/terminal` (handled in `vite.config.ts`)
3. The server spawns PTY sessions (pseudo-terminals) using `node-pty`
4. Multiple WebSocket clients can attach to the same PTY — output is fanned out via node-pty's native multi-listener support
5. PTY dimensions use a minimum-wins strategy across all connected clients (like tmux)
6. Session IDs are stored in sessionStorage so tabs survive SvelteKit navigation

## API

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/terminal` | GET | List all active sessions (includes `clientCount`) |
| `/api/terminal/:id` | GET | Get single session info |
| `/api/terminal/:id` | PATCH | Rename a session |
| `/api/terminal/:id` | DELETE | Kill a session |
| `/api/terminal/pin` | GET | Check if PIN is required |
| `/api/terminal/pin` | POST | Set / verify / disable PIN |
| `/ws/terminal` | WebSocket | Bi-directional PTY I/O |

## WebSocket Message Protocol

**Client → Server**

| Type | Fields | Description |
|------|--------|-------------|
| `input` | `data: string` | Keyboard input |
| `resize` | `cols, rows` | Terminal resize |
| `rename` | `label: string` | Rename the session |

**Server → Client**

| Type | Fields | Description |
|------|--------|-------------|
| `output` | `data: string` | PTY stdout/stderr |
| `session` | `id, shell, clientCount` | Session info on connect |
| `scrollback` | `data: string` | Buffer replay on attach |
| `client_count` | `count: number` | Live update when clients attach/detach |
| `renamed` | `label: string` | Broadcast when any client renames |
| `exit` | `code: number` | Shell exited |

## Keyboard Shortcuts

- **Ctrl+C** — Send interrupt signal (SIGINT) to the running process
- **Ctrl+D** — Send EOF / close shell
- **Ctrl+L** — Clear the terminal screen
- **Ctrl mode button** — Toggle a mobile-friendly Ctrl key for touch devices

## Security

- **PIN protection** — Optional SHA256-hashed PIN required for all connections (browser and CLI)
- **Environment filtering** — API keys, tokens, and secrets are stripped from the PTY environment before shell spawn
- For CLI attach, prefer `TERMINAL_PIN=<pin>` env var over `--pin` flag (the flag is visible in `ps aux`)

## Tips

- Terminal sessions survive page navigation but not full browser refresh (auto-reconnects if session still alive)
- Multiple tabs let you run commands in parallel (e.g., logs in one tab, edits in another)
- The terminal supports full ANSI colors, cursor movement, and interactive programs (vim, top, htop, etc.)
- On mobile, use the Ctrl mode button to send control sequences without a physical keyboard
- The status bar shows connection state, session ID, shell type, dimensions, and live client count
