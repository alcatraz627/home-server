<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { browser } from '$app/environment';

  interface Tab {
    id: number;
    sessionId: string | null;
    ws: WebSocket | null;
    terminal: any;
    fitAddon: any;
    connected: boolean;
    label: string;
  }

  const SESSION_STORAGE_KEY = 'terminal_sessions';

  let terminalEls: Record<number, HTMLDivElement> = {};
  let tabs = $state<Tab[]>([]);
  let activeTab = $state(0);
  let nextId = 1;
  let fontSize = $state(14);
  let Terminal: any;
  let FitAddon: any;
  let resizeObserver: ResizeObserver | null = null;
  let ctrlMode = $state(false);

  /** Persist session IDs to sessionStorage so tabs survive navigation */
  function saveSessionIds() {
    if (!browser) return;
    const data = tabs.filter((t) => t.sessionId).map((t) => ({ tabId: t.id, sessionId: t.sessionId, label: t.label }));
    sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(data));
  }

  /** Load saved session IDs from sessionStorage */
  function loadSessionIds(): { tabId: number; sessionId: string; label: string }[] {
    if (!browser) return [];
    try {
      const raw = sessionStorage.getItem(SESSION_STORAGE_KEY);
      if (!raw) return [];
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }

  onMount(async () => {
    if (!browser) return;

    const xtermMod = await import('@xterm/xterm');
    const fitMod = await import('@xterm/addon-fit');
    Terminal = xtermMod.Terminal;
    FitAddon = fitMod.FitAddon;

    resizeObserver = new ResizeObserver(() => {
      const tab = tabs[activeTab];
      if (tab?.fitAddon) {
        tab.fitAddon.fit();
        if (tab.ws?.readyState === WebSocket.OPEN && tab.terminal) {
          tab.ws.send(JSON.stringify({ type: 'resize', cols: tab.terminal.cols, rows: tab.terminal.rows }));
        }
      }
    });

    // Restore previous sessions or create a new one
    const saved = loadSessionIds();
    if (saved.length > 0) {
      for (const s of saved) {
        addTab(s.sessionId, s.label);
      }
    } else {
      addTab();
    }
  });

  function getColsFromContainer(el: HTMLDivElement): number {
    const width = el.clientWidth;
    if (width > 0) {
      return Math.max(40, Math.floor(width / 9));
    }
    return 80;
  }

  function createTerminal(): { terminal: any; fitAddon: any } {
    const term = new Terminal({
      cursorBlink: true,
      fontSize,
      fontFamily: "'JetBrains Mono', 'SF Mono', 'Fira Code', monospace",
      theme: {
        background: '#0d1117',
        foreground: '#e1e4e8',
        cursor: '#58a6ff',
        selectionBackground: '#264f78',
        black: '#0d1117',
        red: '#f85149',
        green: '#3fb950',
        yellow: '#d29922',
        blue: '#58a6ff',
        magenta: '#d2a8ff',
        cyan: '#76e3ea',
        white: '#e1e4e8',
        brightBlack: '#484f58',
        brightRed: '#f85149',
        brightGreen: '#3fb950',
        brightYellow: '#d29922',
        brightBlue: '#79c0ff',
        brightMagenta: '#d2a8ff',
        brightCyan: '#76e3ea',
        brightWhite: '#f0f6fc',
      },
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    return { terminal: term, fitAddon: fit };
  }

  function addTab(existingSessionId?: string, label?: string) {
    const id = nextId++;
    const { terminal, fitAddon } = createTerminal();
    const tab: Tab = {
      id,
      sessionId: existingSessionId || null,
      ws: null,
      terminal,
      fitAddon,
      connected: false,
      label: label || `Shell ${id}`,
    };
    tabs = [...tabs, tab];
    activeTab = tabs.length - 1;

    // Mount after DOM update
    setTimeout(() => {
      const el = terminalEls[id];
      if (el) {
        terminal.open(el);

        // Calculate cols from container width for mobile
        const cols = getColsFromContainer(el);
        terminal.resize(cols, terminal.rows);

        fitAddon.fit();
        resizeObserver?.observe(el);
        connectTab(tab);

        terminal.onData((data: string) => {
          if (tab.ws?.readyState === WebSocket.OPEN) {
            tab.ws.send(JSON.stringify({ type: 'input', data }));
          }
        });
      }
    }, 0);
  }

  function connectTab(tab: Tab) {
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const cols = tab.terminal?.cols || 80;
    const rows = tab.terminal?.rows || 24;
    const sessionParam = tab.sessionId ? `&session=${tab.sessionId}` : '';
    const url = `${protocol}//${location.host}/ws/terminal?cols=${cols}&rows=${rows}${sessionParam}`;

    const ws = new WebSocket(url);

    ws.onopen = () => {
      tab.connected = true;
      tabs = [...tabs]; // trigger reactivity
      if (tabs[activeTab]?.id === tab.id) tab.terminal?.focus();
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'output') tab.terminal?.write(msg.data);
        else if (msg.type === 'session') {
          tab.sessionId = msg.id;
          saveSessionIds();
        }
      } catch {}
    };

    ws.onclose = () => {
      tab.connected = false;
      tabs = [...tabs];
      tab.terminal?.write('\r\n\x1b[33m[Disconnected — click Reconnect]\x1b[0m\r\n');
      // Auto-reconnect after 3s
      setTimeout(() => {
        if (!tab.connected && tabs.some((t) => t.id === tab.id)) {
          connectTab(tab);
        }
      }, 3000);
    };

    ws.onerror = () => {
      tab.terminal?.write('\r\n\x1b[31m[WebSocket error — is the dev server running?]\x1b[0m\r\n');
      tab.terminal?.write('\x1b[33mRun: npm run dev\x1b[0m\r\n');
    };

    tab.ws = ws;
  }

  function closeTab(idx: number) {
    const tab = tabs[idx];
    tab.ws?.close();
    tab.terminal?.dispose();
    if (terminalEls[tab.id]) resizeObserver?.unobserve(terminalEls[tab.id]);
    tabs = tabs.filter((_, i) => i !== idx);
    if (activeTab >= tabs.length) activeTab = Math.max(0, tabs.length - 1);
    saveSessionIds();
  }

  // Tab renaming
  let renamingTab = $state<number | null>(null);
  let renameValue = $state('');

  function startRenameTab(idx: number) {
    renamingTab = idx;
    renameValue = tabs[idx].label;
  }

  function submitRenameTab(idx: number) {
    if (renameValue.trim()) {
      tabs[idx].label = renameValue.trim();
      tabs = [...tabs];
      saveSessionIds();
    }
    renamingTab = null;
  }

  // Middle-click close
  function handleTabMouseDown(e: MouseEvent, idx: number) {
    if (e.button === 1) {
      e.preventDefault();
      closeTab(idx);
    }
  }

  function switchTab(idx: number) {
    activeTab = idx;
    setTimeout(() => {
      tabs[idx]?.fitAddon?.fit();
      tabs[idx]?.terminal?.focus();
    }, 0);
  }

  function changeFontSize(delta: number) {
    fontSize = Math.max(10, Math.min(24, fontSize + delta));
    for (const tab of tabs) {
      tab.terminal?.options && (tab.terminal.options.fontSize = fontSize);
      tab.fitAddon?.fit();
    }
  }

  function clearTerminal() {
    tabs[activeTab]?.terminal?.clear();
  }

  // Mobile extra keys helpers
  function sendKey(key: string) {
    const tab = tabs[activeTab];
    if (!tab?.ws || tab.ws.readyState !== WebSocket.OPEN) return;

    if (ctrlMode && key.length === 1) {
      // Send ctrl+key: ctrl+a = \x01, ctrl+b = \x02, etc.
      const code = key.toLowerCase().charCodeAt(0) - 96;
      if (code > 0 && code < 27) {
        tab.ws.send(JSON.stringify({ type: 'input', data: String.fromCharCode(code) }));
      }
      ctrlMode = false;
      return;
    }

    tab.ws.send(JSON.stringify({ type: 'input', data: key }));
  }

  function sendEscape(seq: string) {
    const tab = tabs[activeTab];
    if (!tab?.ws || tab.ws.readyState !== WebSocket.OPEN) return;
    tab.ws.send(JSON.stringify({ type: 'input', data: seq }));
  }

  function toggleCtrl() {
    ctrlMode = !ctrlMode;
  }

  onDestroy(() => {
    for (const tab of tabs) {
      tab.ws?.close();
      tab.terminal?.dispose();
    }
    resizeObserver?.disconnect();
  });
</script>

<svelte:head>
  <title>Terminal | Home Server</title>
  <link rel="stylesheet" href="/xterm.css" />
</svelte:head>

<div class="terminal-page">
  <div class="terminal-header">
    <div class="tab-bar">
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      {#each tabs as tab, i}
        <div
          class="tab"
          class:active={activeTab === i}
          onclick={() => switchTab(i)}
          onmousedown={(e) => handleTabMouseDown(e, i)}
        >
          <span class="tab-dot" class:connected={tab.connected}></span>
          {#if renamingTab === i}
            <input
              class="tab-rename-input"
              type="text"
              bind:value={renameValue}
              onclick={(e) => e.stopPropagation()}
              onkeydown={(e) => {
                if (e.key === 'Enter') submitRenameTab(i);
                if (e.key === 'Escape') renamingTab = null;
              }}
              onblur={() => submitRenameTab(i)}
            />
          {:else}
            <span class="tab-label" ondblclick={() => startRenameTab(i)}>{tab.label}</span>
          {/if}
          <button
            class="tab-close"
            onclick={(e) => {
              e.stopPropagation();
              closeTab(i);
            }}>×</button
          >
        </div>
      {/each}
      <button class="tab tab-add" onclick={() => addTab()}>+</button>
    </div>
    <div class="toolbar">
      <button class="tool-btn" onclick={() => changeFontSize(-1)} title="Decrease font">A-</button>
      <span class="font-size">{fontSize}px</span>
      <button class="tool-btn" onclick={() => changeFontSize(1)} title="Increase font">A+</button>
      <button class="tool-btn" onclick={clearTerminal} title="Clear terminal">Clear</button>
    </div>
  </div>

  {#if tabs.length === 0}
    <div class="empty-state">
      <div class="empty-icon">▶</div>
      <p>No terminal sessions</p>
      <p class="empty-hint">Open a new shell to get started</p>
      <button class="empty-btn" onclick={() => addTab()}>New Terminal</button>
    </div>
  {:else}
    <div class="terminal-panels">
      {#each tabs as tab, i}
        <div class="terminal-container" class:visible={activeTab === i} bind:this={terminalEls[tab.id]}></div>
      {/each}
    </div>
  {/if}

  <!-- Mobile extra keys bar -->
  <div class="mobile-keys">
    <button class="mk" onclick={() => sendKey('\t')}>TAB</button>
    <button class="mk" class:active={ctrlMode} onclick={toggleCtrl}>CTRL</button>
    <button class="mk" onclick={() => sendKey('\x1b')}>ESC</button>
    <button class="mk" onclick={() => sendKey('|')}>|</button>
    <button class="mk" onclick={() => sendKey('/')}>/</button>
    <button class="mk" onclick={() => sendKey('-')}>-</button>
    <button class="mk" onclick={() => sendKey('~')}>~</button>
    <button class="mk" onclick={() => sendEscape('\x1b[D')}>←</button>
    <button class="mk" onclick={() => sendEscape('\x1b[A')}>↑</button>
    <button class="mk" onclick={() => sendEscape('\x1b[B')}>↓</button>
    <button class="mk" onclick={() => sendEscape('\x1b[C')}>→</button>
  </div>
</div>

<style>
  .terminal-page {
    display: flex;
    flex-direction: column;
    height: calc(100vh - 73px);
    margin: -24px;
  }

  .terminal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
    background: var(--bg-secondary);
  }

  .tab-bar {
    display: flex;
    overflow-x: auto;
    flex: 1;
  }

  .tab {
    padding: 8px 14px;
    font-size: 0.75rem;
    border: none;
    border-right: 1px solid var(--border);
    background: transparent;
    color: var(--text-muted);
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 6px;
    white-space: nowrap;
    font-family: inherit;
  }

  .tab:hover {
    background: var(--bg-hover);
  }
  .tab.active {
    background: var(--bg-inset);
    color: var(--text-primary);
  }

  .tab-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--danger);
  }
  .tab-dot.connected {
    background: var(--success);
  }

  .tab-close {
    background: none;
    border: none;
    color: var(--text-faint);
    font-size: 0.9rem;
    cursor: pointer;
    padding: 0 2px;
    line-height: 1;
  }
  .tab-close:hover {
    color: var(--danger);
  }

  .tab-add {
    border-right: none;
    font-size: 1rem;
    color: var(--text-faint);
    padding: 8px 12px;
  }
  .tab-add:hover {
    color: var(--accent);
  }

  .toolbar {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 0 10px;
  }

  .tool-btn {
    padding: 4px 8px;
    font-size: 0.7rem;
    border-radius: 4px;
    border: 1px solid var(--border);
    background: var(--btn-bg);
    color: var(--text-muted);
    cursor: pointer;
    font-family: inherit;
  }
  .tool-btn:hover {
    border-color: var(--accent);
    color: var(--text-primary);
  }

  .font-size {
    font-size: 0.65rem;
    color: var(--text-faint);
    font-family: 'JetBrains Mono', monospace;
    min-width: 30px;
    text-align: center;
  }

  .terminal-panels {
    flex: 1;
    position: relative;
    overflow: hidden;
    max-width: 100%;
  }

  .terminal-container {
    position: absolute;
    inset: 0;
    background: var(--bg-inset);
    padding: 8px;
    display: none;
    max-width: 100%;
    overflow-x: hidden;
  }

  .terminal-container.visible {
    display: block;
  }

  .terminal-container :global(.xterm) {
    height: 100%;
    max-width: 100%;
  }
  .terminal-container :global(.xterm-viewport) {
    overflow-y: auto !important;
  }
  .terminal-container :global(.xterm-screen) {
    max-width: 100%;
  }

  .tab-label {
    cursor: default;
    user-select: none;
  }

  .tab-rename-input {
    width: 80px;
    padding: 1px 4px;
    font-size: 0.7rem;
    border: 1px solid var(--accent);
    border-radius: 3px;
    background: var(--input-bg);
    color: var(--text-primary);
    font-family: inherit;
    outline: none;
  }

  .empty-state {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    color: var(--text-muted);
    background: var(--bg-inset);
  }

  .empty-icon {
    font-size: 2.5rem;
    opacity: 0.3;
  }

  .empty-state p {
    font-size: 0.9rem;
  }

  .empty-hint {
    font-size: 0.75rem !important;
    color: var(--text-faint);
  }

  .empty-btn {
    margin-top: 8px;
    padding: 8px 20px;
    font-size: 0.85rem;
    border-radius: 8px;
    border: 1px solid var(--accent);
    background: var(--accent-bg);
    color: var(--accent);
    cursor: pointer;
    font-family: inherit;
    transition: all 0.15s;
  }

  .empty-btn:hover {
    background: var(--accent);
    color: var(--bg-primary);
  }

  /* Mobile extra keys bar — only on touch devices */
  .mobile-keys {
    display: none;
  }

  @media (pointer: coarse) {
    .mobile-keys {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
      padding: 6px 8px;
      background: var(--bg-secondary);
      border-top: 1px solid var(--border);
      flex-shrink: 0;
    }

    .mk {
      flex: 0 0 auto;
      padding: 6px 10px;
      font-size: 0.7rem;
      font-family: 'JetBrains Mono', 'SF Mono', monospace;
      border: 1px solid var(--border);
      border-radius: 4px;
      background: var(--btn-bg, #1c2028);
      color: var(--text-muted);
      cursor: pointer;
      line-height: 1;
      touch-action: manipulation;
      -webkit-tap-highlight-color: transparent;
      user-select: none;
    }

    .mk:active {
      background: var(--accent-bg);
      border-color: var(--accent);
      color: var(--text-primary);
    }

    .mk.active {
      background: var(--accent);
      color: var(--bg-primary);
      border-color: var(--accent);
    }
  }
</style>
