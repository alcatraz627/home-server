# Terminal

The Terminal page provides full shell access to the server through the browser. It uses xterm.js with WebSocket connections for real-time, interactive terminal sessions with tab support.

## How to Use

- **Open** a new terminal tab by clicking the "+" button
- **Switch** between multiple terminal tabs using the tab bar
- **Type** commands directly; they execute on the server in a persistent shell session
- **Close** tabs individually; sessions persist across page navigations via sessionStorage
- **Resize** the terminal by resizing the browser window (auto-fits)
- **Adjust font size** using the font size controls

## Data Flow

1. `src/routes/terminal/+page.svelte` renders xterm.js terminals in tabbed containers
2. WebSocket connections are established to `src/routes/api/terminal/+server.ts`
3. The server spawns PTY sessions (pseudo-terminals) for each tab
4. Session IDs are stored in sessionStorage so tabs survive SvelteKit navigation

## Keyboard Shortcuts

- **Ctrl+C** — Send interrupt signal (SIGINT) to the running process
- **Ctrl+D** — Send EOF / close shell
- **Ctrl+L** — Clear the terminal screen
- **Ctrl mode button** — Toggle a mobile-friendly Ctrl key for touch devices

## Tips

- Terminal sessions survive page navigation but not full browser refresh (reconnects if session is still alive)
- Multiple tabs let you run commands in parallel (e.g., logs in one tab, edits in another)
- The terminal supports full ANSI colors, cursor movement, and interactive programs (vim, top, etc.)
- On mobile, use the Ctrl mode button to send control sequences without a physical keyboard
