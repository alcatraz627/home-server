<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { useShortcuts, SHORTCUT_DEFAULTS } from '$lib/shortcuts';
  import { browser } from '$app/environment';
  import { toast } from '$lib/toast';
  import EmptyState from '$lib/components/EmptyState.svelte';
  import Badge from '$lib/components/Badge.svelte';
  import Icon from '$lib/components/Icon.svelte';
  import Button from '$lib/components/Button.svelte';
  import { fetchApi, postJson } from '$lib/api';
  import { SK_TERMINAL_SESSIONS } from '$lib/constants/storage-keys';

  interface Tab {
    id: number;
    sessionId: string | null;
    ws: WebSocket | null;
    terminal: any;
    fitAddon: any;
    connected: boolean;
    label: string;
    shellType: string;
    cols: number;
    rows: number;
    exited: boolean;
    clientCount: number;
  }

  interface ServerSession {
    id: string;
    label: string;
    pid: number;
    uptime: number;
    clientCount: number;
  }

  const SESSION_STORAGE_KEY = SK_TERMINAL_SESSIONS;

  let terminalEls: Record<number, HTMLDivElement> = {};
  let tabs = $state<Tab[]>([]);
  let activeTab = $state(0);
  let nextId = 1;
  let fontSize = $state(14);
  let Terminal: any;
  let FitAddon: any;
  let resizeObserver: ResizeObserver | null = null;
  let ctrlMode = $state(false);
  let serverSessions = $state<ServerSession[]>([]);
  let sessionPollTimer: ReturnType<typeof setInterval> | null = null;

  // PIN gate
  let pinRequired = $state(false);
  let pinVerified = $state(false);
  let pinInput = $state('');
  let pinError = $state('');
  let terminalPin = $state(''); // verified PIN to include in WS URL

  async function checkPinRequired() {
    try {
      const res = await fetchApi('/api/terminal/pin');
      if (res.ok) {
        const data = await res.json();
        pinRequired = data.enabled;
        if (!pinRequired) pinVerified = true;
      }
    } catch {
      pinVerified = true; // On error, allow
    }
  }

  async function submitPin() {
    pinError = '';
    try {
      const res = await postJson('/api/terminal/pin', { action: 'verify', pin: pinInput });
      const data = await res.json();
      if (data.valid) {
        pinVerified = true;
        terminalPin = pinInput;
        pinInput = '';
      } else {
        pinError = 'Incorrect PIN';
      }
    } catch {
      pinError = 'Verification failed';
    }
  }

  /** Persist session IDs to sessionStorage so tabs survive navigation */
  function saveSessionIds() {
    if (!browser) return;
    const data = tabs
      .filter((t) => t.sessionId && !t.exited)
      .map((t) => ({ tabId: t.id, sessionId: t.sessionId, label: t.label }));
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

  async function fetchServerSessions() {
    try {
      const res = await fetchApi('/api/terminal');
      if (res.ok) {
        const data = await res.json();
        serverSessions = data.sessions || [];
      }
    } catch {
      // ignore fetch errors
    }
  }

  function formatUptime(seconds: number): string {
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
    return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
  }

  let cleanupShortcuts: (() => void) | null = null;
  let wakeLock: WakeLockSentinel | null = null;

  onMount(async () => {
    if (!browser) return;

    // Keep screen on during terminal sessions (PWA / Android)
    if ('wakeLock' in navigator) {
      try {
        wakeLock = await navigator.wakeLock.request('screen');
      } catch {
        // Wake lock request can fail if page is not visible
      }
    }

    cleanupShortcuts = useShortcuts([
      { ...SHORTCUT_DEFAULTS.find((d) => d.id === 'terminal:new-tab')!, handler: () => addTab() },
    ]);

    await checkPinRequired();

    const xtermMod = await import('@xterm/xterm');
    const fitMod = await import('@xterm/addon-fit');
    Terminal = xtermMod.Terminal;
    FitAddon = fitMod.FitAddon;

    resizeObserver = new ResizeObserver(() => {
      const tab = tabs[activeTab];
      if (tab?.fitAddon) {
        tab.fitAddon.fit();
        tab.cols = tab.terminal?.cols || tab.cols;
        tab.rows = tab.terminal?.rows || tab.rows;
        if (tab.ws?.readyState === WebSocket.OPEN && tab.terminal) {
          tab.ws.send(JSON.stringify({ type: 'resize', cols: tab.terminal.cols, rows: tab.terminal.rows }));
        }
      }
    });

    // Restore previous sessions — do NOT auto-create a new one
    const saved = loadSessionIds();
    if (saved.length > 0) {
      for (const s of saved) {
        addTab(s.sessionId, s.label);
      }
    }

    // Poll server sessions
    fetchServerSessions();
    sessionPollTimer = setInterval(fetchServerSessions, 5000);
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
    // If restoring and already have a tab for this session, switch to it
    if (existingSessionId) {
      const existingIdx = tabs.findIndex((t) => t.sessionId === existingSessionId);
      if (existingIdx >= 0) {
        switchTab(existingIdx);
        return;
      }
    }

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
      shellType: '',
      cols: 80,
      rows: 24,
      exited: false,
      clientCount: 1,
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
        tab.cols = terminal.cols;
        tab.rows = terminal.rows;
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
    const isRestoring = !!tab.sessionId;
    const sessionParam = tab.sessionId ? `&session=${tab.sessionId}` : '';
    const pinParam = terminalPin ? `&pin=${encodeURIComponent(terminalPin)}` : '';
    const url = `${protocol}//${location.host}/ws/terminal?cols=${cols}&rows=${rows}${sessionParam}${pinParam}`;

    const ws = new WebSocket(url);

    ws.onopen = () => {
      tab.connected = true;
      tab.exited = false;
      tabs = [...tabs]; // trigger reactivity
      if (tabs[activeTab]?.id === tab.id) tab.terminal?.focus();
      // Only show restore message when actually restoring a saved session
      if (isRestoring && sessionParam) {
        tab.terminal?.write('\r\n\x1b[2m[Session restored — press Enter to continue]\x1b[0m\r\n');
      }
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'output') {
          tab.terminal?.write(msg.data);
        } else if (msg.type === 'scrollback') {
          // Scrollback from a reconnected session — write then reflow
          tab.terminal?.write(msg.data);
          setTimeout(() => {
            const t = tab.terminal;
            if (t) {
              t.resize(t.cols, t.rows);
              t.scrollToBottom();
            }
          }, 50);
        } else if (msg.type === 'session') {
          tab.sessionId = msg.id;
          if (msg.shell) tab.shellType = msg.shell;
          if (msg.clientCount != null) tab.clientCount = msg.clientCount;
          saveSessionIds();
          fetchServerSessions();
        } else if (msg.type === 'client_count') {
          tab.clientCount = msg.count;
          tabs = [...tabs];
        } else if (msg.type === 'renamed') {
          tab.label = msg.label;
          tabs = [...tabs];
          saveSessionIds();
        } else if (msg.type === 'exit') {
          tab.exited = true;
          const tabLabel = tab.label;
          toast.info(`Shell exited: ${tabLabel} (code ${msg.code ?? '?'})`);
          const idx = tabs.findIndex((t) => t.id === tab.id);
          if (idx >= 0) {
            removeTab(idx, true);
          }
        }
      } catch {}
    };

    ws.onclose = () => {
      tab.connected = false;
      tabs = [...tabs];
      // Don't show disconnected message or auto-reconnect if the shell exited
      if (tab.exited) return;
      tab.terminal?.write('\r\n\x1b[33m[Disconnected — click Reconnect]\x1b[0m\r\n');
      // Auto-reconnect after 3s
      setTimeout(() => {
        if (!tab.connected && !tab.exited && tabs.some((t) => t.id === tab.id)) {
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

  /** Remove a tab from the UI without killing the server session */
  function removeTab(idx: number, skipKill = false) {
    const tab = tabs[idx];
    tab.ws?.close();
    tab.terminal?.dispose();
    if (terminalEls[tab.id]) resizeObserver?.unobserve(terminalEls[tab.id]);
    tabs = tabs.filter((_, i) => i !== idx);
    if (activeTab >= tabs.length) activeTab = Math.max(0, tabs.length - 1);
    saveSessionIds();
  }

  /** Close a tab AND destroy the server-side session */
  async function closeTab(idx: number) {
    const tab = tabs[idx];
    const tabLabel = tab.label;
    const sessionId = tab.sessionId;

    removeTab(idx);

    // Kill server-side session
    if (sessionId) {
      try {
        await fetchApi(`/api/terminal/${sessionId}`, { method: 'DELETE' });
      } catch {
        // ignore
      }
    }

    toast.info(`Closed: ${tabLabel}`);
    fetchServerSessions();
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
      // Propagate rename to server — broadcasts to all clients via 'renamed' message
      if (tabs[idx].ws?.readyState === WebSocket.OPEN) {
        tabs[idx].ws.send(JSON.stringify({ type: 'rename', label: renameValue.trim() }));
      }
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

  /** Attach to a server session that may not have a client tab yet */
  function attachToSession(session: ServerSession) {
    const existingIdx = tabs.findIndex((t) => t.sessionId === session.id);
    if (existingIdx >= 0) {
      switchTab(existingIdx);
      return;
    }
    addTab(session.id, session.label);
  }

  async function copyAttachCommand(session: ServerSession) {
    const port = location.port || '5555';
    const cmd = `node scripts/attach.mjs ${session.id} --port ${port}`;
    try {
      await navigator.clipboard.writeText(cmd);
      toast.info(`Copied: ${cmd}`);
    } catch {
      toast.info(cmd);
    }
  }

  // Mobile extra keys helpers
  function sendKey(key: string) {
    const tab = tabs[activeTab];
    if (!tab?.ws || tab.ws.readyState !== WebSocket.OPEN) return;

    if (ctrlMode && key.length === 1) {
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

  let showAttachHelp = $state(false);

  // Derived status bar info
  let currentTab = $derived(tabs[activeTab] ?? null);
  let shortSessionId = $derived(currentTab?.sessionId ? currentTab.sessionId.slice(0, 6) : '--');
  let connectionStatus = $derived(
    currentTab ? (currentTab.connected ? 'connected' : currentTab.exited ? 'exited' : 'disconnected') : 'none',
  );

  onDestroy(() => {
    cleanupShortcuts?.();
    wakeLock?.release();
    for (const tab of tabs) {
      tab.ws?.close();
      tab.terminal?.dispose();
    }
    resizeObserver?.disconnect();
    if (sessionPollTimer) clearInterval(sessionPollTimer);
  });
</script>

<svelte:head>
  <title>Terminal | Home Server</title>
  <link rel="stylesheet" href="/xterm.css" />
</svelte:head>

{#if pinRequired && !pinVerified}
  <div class="pin-gate">
    <div class="pin-card">
      <Icon name="lock" size={32} />
      <h3>Terminal PIN Required</h3>
      <p>Enter your PIN to access the terminal.</p>
      <input
        type="password"
        class="pin-input"
        bind:value={pinInput}
        placeholder="Enter PIN"
        onkeydown={(e) => e.key === 'Enter' && submitPin()}
        maxlength="20"
      />
      {#if pinError}
        <p class="pin-error">{pinError}</p>
      {/if}
      <Button variant="primary" onclick={submitPin}>Unlock</Button>
    </div>
  </div>
{:else}
  <div class="terminal-page">
    <div class="page-header">
      <h2 class="page-title">Terminal</h2>
      <p class="page-desc">Interactive shell sessions with tabbed terminals, font controls, and persistent sessions.</p>
    </div>

    <!-- Session summary bar -->
    {#if serverSessions.length > 0}
      <div class="session-bar">
        <span class="session-bar-label">Running:</span>
        {#each serverSessions as session}
          <!-- svelte-ignore a11y_click_events_have_key_events -->
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <div class="session-badge-group">
            <button
              class="session-badge"
              class:active={currentTab?.sessionId === session.id}
              onclick={() => attachToSession(session)}
              title="PID {session.pid} — {formatUptime(session.uptime)}"
            >
              <Badge variant={currentTab?.sessionId === session.id ? 'accent' : 'default'} size="sm" dot pulse>
                {session.label}:{session.id.slice(0, 4)}
                {#if session.clientCount > 1}
                  <span class="client-count-badge">{session.clientCount}</span>
                {/if}
              </Badge>
            </button>
            <button
              class="attach-copy-btn"
              onclick={() => copyAttachCommand(session)}
              title="Copy attach command for system terminal"
            >
              <Icon name="terminal" size={10} />
            </button>
          </div>
        {/each}
      </div>
    {/if}

    <!-- Attach help panel -->
    <div class="attach-help-bar">
      <button class="attach-help-toggle" onclick={() => (showAttachHelp = !showAttachHelp)}>
        <Icon name="terminal" size={12} />
        Connect from system terminal
        <Icon name={showAttachHelp ? 'chevron-up' : 'chevron-down'} size={12} />
      </button>
    </div>

    {#if showAttachHelp}
      <div class="attach-help-panel">
        <div class="attach-help-section">
          <div class="attach-help-title">Option A — Attach to an app session</div>
          <p class="attach-help-desc">
            Start a shell here, then join it from your system terminal. Both sides are fully interactive.
          </p>
          <div class="attach-help-steps">
            <div class="attach-step">
              <span class="step-num">1</span>
              <span>Open a new tab above → note the session ID in the status bar (e.g. <code>a3f2b1c4</code>)</span>
            </div>
            <div class="attach-step">
              <span class="step-num">2</span>
              <span>In your system terminal, from the project root:</span>
            </div>
          </div>
          <pre class="attach-code">node scripts/attach.mjs              # list active sessions
node scripts/attach.mjs &lt;session-id&gt;  # attach to one</pre>
          <div class="attach-help-hint">
            Detach with <code>Ctrl-Q</code> or <code>Ctrl-B d</code> — session stays alive.
          </div>
        </div>

        <div class="attach-help-divider"></div>

        <div class="attach-help-section">
          <div class="attach-help-title">Option B — Attach to an existing terminal (tmux)</div>
          <p class="attach-help-desc">
            If you have a session already running in iTerm/Terminal.app, wrap it in tmux so the app can join it.
          </p>
          <div class="attach-help-steps">
            <div class="attach-step">
              <span class="step-num">1</span>
              <span>In your system terminal, start or attach a named tmux session:</span>
            </div>
          </div>
          <pre class="attach-code">tmux new-session -s my-work     # new session
tmux attach -t my-work          # or resume existing</pre>
          <div class="attach-step" style="margin: 8px 0 6px;">
            <span class="step-num">2</span>
            <span>In the app, open a new tab and run:</span>
          </div>
          <pre class="attach-code">tmux attach -t my-work</pre>
          <div class="attach-help-hint">
            Now both your system terminal and the app see the same tmux session. Use <code>Ctrl-B d</code> to detach without
            killing it.
          </div>
        </div>
      </div>
    {/if}

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
              <span class="tab-label" ondblclick={() => startRenameTab(i)}>
                {tab.label}
                {#if tab.clientCount > 1}
                  <span class="tab-client-count" title="{tab.clientCount} clients connected">{tab.clientCount}</span>
                {/if}
              </span>
            {/if}
            <button
              class="tab-close"
              onclick={(e) => {
                e.stopPropagation();
                closeTab(i);
              }}>x</button
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
      <div class="empty-wrapper">
        <EmptyState
          icon=">"
          title="No terminal sessions"
          hint="Open a new shell to get started"
          actionLabel="New Terminal"
          onaction={() => addTab()}
        />
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
      <button class="mk" onclick={() => sendEscape('\x1b[D')}><Icon name="arrow-left" size={14} /></button>
      <button class="mk" onclick={() => sendEscape('\x1b[A')}><Icon name="arrow-up" size={14} /></button>
      <button class="mk" onclick={() => sendEscape('\x1b[B')}><Icon name="arrow-down" size={14} /></button>
      <button class="mk" onclick={() => sendEscape('\x1b[C')}><Icon name="arrow-right" size={14} /></button>
    </div>

    <!-- Bottom status bar -->
    {#if currentTab}
      <div class="status-bar">
        <span class="status-item">
          <span class="status-dot" class:connected={currentTab.connected} class:exited={currentTab.exited}></span>
          {connectionStatus}
        </span>
        <span class="status-sep">|</span>
        <span class="status-item">session: {shortSessionId}</span>
        <span class="status-sep">|</span>
        <span class="status-item">{currentTab.shellType || 'shell'}</span>
        <span class="status-sep">|</span>
        <span class="status-item">{currentTab.cols} x {currentTab.rows}</span>
        {#if currentTab.clientCount > 1}
          <span class="status-sep">|</span>
          <span class="status-item status-clients">
            <Icon name="users" size={10} />
            {currentTab.clientCount} clients
          </span>
        {/if}
      </div>
    {/if}
  </div>
{/if}

<style>
  .pin-gate {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 60vh;
  }

  .pin-card {
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    padding: 40px;
    border: 1px solid var(--border);
    border-radius: 12px;
    background: var(--bg-secondary);
    max-width: 320px;
    color: var(--text-faint);
  }

  .pin-card h3 {
    font-size: 1rem;
    color: var(--text-primary);
    margin: 0;
  }

  .pin-card p {
    font-size: 0.82rem;
    color: var(--text-muted);
    margin: 0;
  }

  .pin-input {
    width: 180px;
    padding: 10px 16px;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--input-bg);
    color: var(--text-primary);
    font-size: 1.1rem;
    font-family: 'JetBrains Mono', monospace;
    text-align: center;
    letter-spacing: 0.2em;
  }

  .pin-input:focus {
    border-color: var(--accent);
    outline: none;
  }

  .pin-error {
    font-size: 0.78rem;
    color: var(--danger);
    margin: 0;
  }
  .terminal-page {
    display: flex;
    flex-direction: column;
    height: calc(100vh - 73px);
    margin: -24px;
  }

  .page-header {
    padding: 24px 24px 12px;
    flex-shrink: 0;
  }

  @media (max-width: 640px) {
    .page-header {
      padding: 12px 12px 8px;
    }
  }

  .page-title {
    margin: 0;
  }

  .page-desc {
    margin: 4px 0 0;
    font-size: 0.8rem;
    color: var(--text-muted);
  }

  /* Session summary bar */
  .session-bar {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 24px;
    background: var(--bg-secondary);
    border-bottom: 1px solid var(--border);
    overflow-x: auto;
    flex-shrink: 0;
  }

  @media (max-width: 640px) {
    .session-bar {
      padding: 6px 12px;
    }
  }

  .session-bar-label {
    font-size: 0.65rem;
    color: var(--text-faint);
    text-transform: uppercase;
    letter-spacing: 0.04em;
    flex-shrink: 0;
  }

  .session-badge {
    background: none;
    border: none;
    padding: 0;
    cursor: pointer;
    transition: transform 0.1s;
  }

  .session-badge:hover {
    transform: scale(1.05);
  }

  .session-badge.active {
    transform: scale(1.05);
  }

  .attach-help-bar {
    display: flex;
    align-items: center;
    padding: 4px 0 0;
  }

  .attach-help-toggle {
    background: none;
    border: none;
    cursor: pointer;
    color: var(--text-faint);
    font-size: 0.75rem;
    display: flex;
    align-items: center;
    gap: 5px;
    padding: 4px 8px 4px 0;
    border-radius: 4px;
    transition: color 0.15s;
  }

  .attach-help-toggle:hover {
    color: var(--text-secondary);
  }

  .attach-help-panel {
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 16px;
    margin: 6px 0 8px;
    display: flex;
    gap: 24px;
    font-size: 0.8rem;
  }

  @media (max-width: 700px) {
    .attach-help-panel {
      flex-direction: column;
      gap: 16px;
    }
  }

  .attach-help-section {
    flex: 1;
  }

  .attach-help-title {
    font-weight: 600;
    font-size: 0.8rem;
    color: var(--text-primary);
    margin-bottom: 6px;
  }

  .attach-help-desc {
    color: var(--text-faint);
    margin: 0 0 8px;
    line-height: 1.5;
  }

  .attach-help-steps {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin-bottom: 6px;
  }

  .attach-step {
    display: flex;
    align-items: baseline;
    gap: 8px;
    color: var(--text-secondary);
    line-height: 1.4;
  }

  .step-num {
    background: var(--bg-tertiary, var(--bg-hover));
    color: var(--text-faint);
    border-radius: 50%;
    width: 16px;
    height: 16px;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.65rem;
    font-weight: 700;
  }

  .attach-code {
    background: var(--bg-tertiary, #1a1a1a);
    border: 1px solid var(--border);
    border-radius: 5px;
    padding: 8px 10px;
    font-family: 'JetBrains Mono', 'SF Mono', monospace;
    font-size: 0.72rem;
    color: var(--text-primary);
    white-space: pre;
    overflow-x: auto;
    margin: 6px 0;
    line-height: 1.6;
  }

  .attach-help-hint {
    color: var(--text-faint);
    font-size: 0.75rem;
    margin-top: 6px;
    line-height: 1.5;
  }

  .attach-help-hint code {
    background: var(--bg-tertiary, #1a1a1a);
    border-radius: 3px;
    padding: 1px 4px;
    font-size: 0.7rem;
  }

  .attach-help-divider {
    width: 1px;
    background: var(--border);
    align-self: stretch;
    flex-shrink: 0;
  }

  @media (max-width: 700px) {
    .attach-help-divider {
      width: auto;
      height: 1px;
    }
  }

  .session-badge-group {
    display: flex;
    align-items: center;
    gap: 2px;
  }

  .attach-copy-btn {
    background: none;
    border: none;
    padding: 2px 4px;
    cursor: pointer;
    color: var(--text-faint);
    border-radius: 4px;
    opacity: 0;
    transition:
      opacity 0.15s,
      color 0.15s;
    display: flex;
    align-items: center;
  }

  .session-badge-group:hover .attach-copy-btn {
    opacity: 1;
  }

  .attach-copy-btn:hover {
    color: var(--accent);
    background: var(--bg-hover);
  }

  .client-count-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: var(--accent);
    color: var(--bg-primary);
    border-radius: 8px;
    font-size: 0.6rem;
    font-weight: 700;
    min-width: 14px;
    height: 14px;
    padding: 0 3px;
    margin-left: 3px;
  }

  .tab-client-count {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: var(--accent);
    color: var(--bg-primary);
    border-radius: 8px;
    font-size: 0.55rem;
    font-weight: 700;
    min-width: 13px;
    height: 13px;
    padding: 0 3px;
    margin-left: 3px;
    vertical-align: middle;
  }

  .status-clients {
    display: flex;
    align-items: center;
    gap: 4px;
    color: var(--accent);
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

  .empty-wrapper {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--bg-inset);
  }

  /* Bottom status bar */
  .status-bar {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 3px 12px;
    background: #1a1e26;
    border-top: 1px solid var(--border);
    font-family: 'JetBrains Mono', 'SF Mono', 'Fira Code', monospace;
    font-size: 0.6rem;
    color: var(--text-faint);
    flex-shrink: 0;
    user-select: none;
  }

  .status-item {
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }

  .status-dot {
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background: var(--danger);
  }
  .status-dot.connected {
    background: var(--success);
  }
  .status-dot.exited {
    background: var(--text-faint);
  }

  .status-sep {
    color: var(--border);
    font-size: 0.55rem;
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
