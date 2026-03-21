<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { browser } from '$app/environment';

	let terminalEl: HTMLDivElement;
	let ws: WebSocket | null = null;
	let terminal: any = null;
	let fitAddon: any = null;
	let sessionId = $state<string | null>(null);
	let connected = $state(false);

	onMount(async () => {
		if (!browser) return;

		const { Terminal } = await import('@xterm/xterm');
		const { FitAddon } = await import('@xterm/addon-fit');

		terminal = new Terminal({
			cursorBlink: true,
			fontSize: 14,
			fontFamily: "'SF Mono', 'Fira Code', 'Cascadia Code', monospace",
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
				brightWhite: '#f0f6fc'
			}
		});

		fitAddon = new FitAddon();
		terminal.loadAddon(fitAddon);
		terminal.open(terminalEl);
		fitAddon.fit();

		connect();

		// Handle resize
		const resizeObserver = new ResizeObserver(() => {
			fitAddon?.fit();
			if (ws?.readyState === WebSocket.OPEN && terminal) {
				ws.send(JSON.stringify({
					type: 'resize',
					cols: terminal.cols,
					rows: terminal.rows
				}));
			}
		});
		resizeObserver.observe(terminalEl);

		// Terminal input → WebSocket
		terminal.onData((data: string) => {
			if (ws?.readyState === WebSocket.OPEN) {
				ws.send(JSON.stringify({ type: 'input', data }));
			}
		});
	});

	function connect() {
		const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
		const cols = terminal?.cols || 80;
		const rows = terminal?.rows || 24;
		const sessionParam = sessionId ? `&session=${sessionId}` : '';
		const url = `${protocol}//${location.host}/ws/terminal?cols=${cols}&rows=${rows}${sessionParam}`;

		ws = new WebSocket(url);

		ws.onopen = () => {
			connected = true;
			terminal?.focus();
		};

		ws.onmessage = (event) => {
			try {
				const msg = JSON.parse(event.data);
				if (msg.type === 'output') {
					terminal?.write(msg.data);
				} else if (msg.type === 'session') {
					sessionId = msg.id;
				}
			} catch { /* ignore */ }
		};

		ws.onclose = () => {
			connected = false;
			terminal?.write('\r\n\x1b[31m[Disconnected]\x1b[0m\r\n');
		};
	}

	function reconnect() {
		if (ws) {
			ws.close();
		}
		terminal?.clear();
		connect();
	}

	function newSession() {
		if (ws) ws.close();
		sessionId = null;
		terminal?.clear();
		connect();
	}

	onDestroy(() => {
		ws?.close();
		terminal?.dispose();
	});
</script>

<svelte:head>
	<title>Terminal | Home Server</title>
	<link rel="stylesheet" href="/xterm.css" />
</svelte:head>

<div class="terminal-page">
	<div class="terminal-header">
		<h2>Terminal</h2>
		<div class="terminal-controls">
			<span class="status" class:connected>
				{connected ? 'Connected' : 'Disconnected'}
			</span>
			{#if sessionId}
				<span class="session-id">session: {sessionId}</span>
			{/if}
			<button class="btn" onclick={reconnect}>Reconnect</button>
			<button class="btn" onclick={newSession}>New Session</button>
		</div>
	</div>
	<div class="terminal-container" bind:this={terminalEl}></div>
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
		padding: 10px 16px;
		border-bottom: 1px solid #30363d;
		flex-shrink: 0;
	}

	h2 { font-size: 1.1rem; }

	.terminal-controls {
		display: flex;
		gap: 8px;
		align-items: center;
	}

	.status {
		font-size: 0.75rem;
		color: #f85149;
		font-family: monospace;
	}

	.status.connected {
		color: #3fb950;
	}

	.session-id {
		font-size: 0.65rem;
		color: #484f58;
		font-family: monospace;
	}

	.btn {
		padding: 4px 12px;
		font-size: 0.75rem;
		border-radius: 6px;
		border: 1px solid #30363d;
		background: #21262d;
		color: #c9d1d9;
		cursor: pointer;
		font-family: inherit;
	}

	.btn:hover { border-color: #58a6ff; }

	.terminal-container {
		flex: 1;
		background: #0d1117;
		padding: 8px;
		overflow: hidden;
	}

	.terminal-container :global(.xterm) {
		height: 100%;
	}

	.terminal-container :global(.xterm-viewport) {
		overflow-y: auto !important;
	}
</style>
