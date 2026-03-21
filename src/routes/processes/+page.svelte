<script lang="ts">
	import type { PageData } from './$types';
	import type { ProcessInfo, ProcessDetail } from '$lib/server/processes';
	import { toast } from '$lib/toast';

	let { data } = $props<{ data: PageData }>();
	// svelte-ignore state_referenced_locally
	const { processes: initialProcesses } = data;
	let processes = $state<ProcessInfo[]>(initialProcesses);
	let filter = $state('');
	let autoRefresh = $state(false);
	let refreshRate = $state(5);
	let refreshInterval: ReturnType<typeof setInterval> | null = null;
	let viewMode = $state<'flat' | 'tree'>('flat');

	// Starred processes (persisted to localStorage)
	let starred = $state<Set<number>>(loadStarred());

	// Expandable row state
	let expandedPid = $state<number | null>(null);
	let activeDetail = $state<ProcessDetail | null>(null);
	let detailLoading = $state(false);

	// Signal + confirm state
	let confirmingSignal = $state<number | null>(null);
	let selectedSignal = $state<string>('TERM');
	let confirmTimer: ReturnType<typeof setTimeout> | null = null;

	const DISPLAY_LIMIT = 50;
	let showAll = $state(false);

	const SIGNAL_INFO: Record<string, string> = {
		TERM: 'Graceful shutdown — process can clean up',
		KILL: 'Force kill — immediate, no cleanup',
		HUP: 'Hangup — often used to reload config',
		INT: 'Interrupt — like pressing Ctrl+C',
		STOP: 'Pause — freeze process (resume with CONT)',
		CONT: 'Resume — continue a stopped process',
		USR1: 'User signal 1 — app-specific behavior',
		USR2: 'User signal 2 — app-specific behavior'
	};
	const SIGNALS = Object.keys(SIGNAL_INFO);

	// localStorage helpers
	function loadStarred(): Set<number> {
		if (typeof localStorage === 'undefined') return new Set();
		try {
			const raw = localStorage.getItem('hs:starred-pids');
			return raw ? new Set(JSON.parse(raw)) : new Set();
		} catch { return new Set(); }
	}

	function saveStarred() {
		if (typeof localStorage === 'undefined') return;
		localStorage.setItem('hs:starred-pids', JSON.stringify([...starred]));
	}

	function toggleStar(pid: number) {
		if (starred.has(pid)) {
			starred.delete(pid);
		} else {
			starred.add(pid);
		}
		starred = new Set(starred); // trigger reactivity
		saveStarred();
	}

	// Filter
	let filtered = $derived(
		processes.filter(p =>
			p.name.toLowerCase().includes(filter.toLowerCase()) ||
			p.command.toLowerCase().includes(filter.toLowerCase()) ||
			String(p.pid).includes(filter)
		)
	);

	// Sort starred to top, then by original order
	let sortedWithStars = $derived.by(() => {
		const starredProcs = filtered.filter(p => starred.has(p.pid));
		const rest = filtered.filter(p => !starred.has(p.pid));
		return [...starredProcs, ...rest];
	});

	// Tree view
	interface TreeNode extends ProcessInfo {
		children: TreeNode[];
		depth: number;
		isLast: boolean;
		/** Which ancestor levels have a continuing sibling (for vertical connector lines) */
		connectors: boolean[];
	}

	let treeList = $derived.by(() => {
		if (viewMode !== 'tree') return [];
		const byPid = new Map<number, ProcessInfo>();
		const childrenMap = new Map<number, ProcessInfo[]>();

		for (const p of sortedWithStars) {
			byPid.set(p.pid, p);
			if (!childrenMap.has(p.ppid)) childrenMap.set(p.ppid, []);
			childrenMap.get(p.ppid)!.push(p);
		}

		const roots = sortedWithStars.filter(p => !byPid.has(p.ppid));
		const flat: TreeNode[] = [];

		function walk(proc: ProcessInfo, depth: number, isLast: boolean, connectors: boolean[]) {
			flat.push({ ...proc, children: [], depth, isLast, connectors: [...connectors] });
			const kids = childrenMap.get(proc.pid) || [];
			kids.forEach((child, i) => {
				walk(child, depth + 1, i === kids.length - 1, [...connectors, !isLast]);
			});
		}

		roots.forEach((root, i) => walk(root, 0, i === roots.length - 1, []));
		return flat;
	});

	let displayList = $derived(viewMode === 'tree' ? treeList : sortedWithStars);
	let displayed = $derived(showAll ? displayList : displayList.slice(0, DISPLAY_LIMIT));

	// Refresh
	async function refresh() {
		const res = await fetch('/api/processes');
		processes = await res.json();
	}

	function toggleAutoRefresh() {
		autoRefresh = !autoRefresh;
		if (autoRefresh) {
			refreshInterval = setInterval(refresh, refreshRate * 1000);
		} else if (refreshInterval) {
			clearInterval(refreshInterval);
			refreshInterval = null;
		}
	}

	function updateRefreshRate(e: Event) {
		refreshRate = parseInt((e.target as HTMLInputElement).value) || 5;
		if (autoRefresh && refreshInterval) {
			clearInterval(refreshInterval);
			refreshInterval = setInterval(refresh, refreshRate * 1000);
		}
	}

	// Expand row + fetch active detail
	async function toggleExpand(pid: number) {
		if (expandedPid === pid) {
			expandedPid = null;
			activeDetail = null;
			return;
		}
		expandedPid = pid;
		activeDetail = null;
	}

	async function fetchDetail(pid: number) {
		detailLoading = true;
		const res = await fetch(`/api/processes/${pid}`);
		if (res.ok) activeDetail = await res.json();
		detailLoading = false;
	}

	// Signal
	function requestSignal(pid: number) {
		if (confirmTimer) clearTimeout(confirmTimer);
		confirmingSignal = pid;
		confirmTimer = setTimeout(() => { confirmingSignal = null; }, 3000);
	}

	async function confirmSignal(pid: number) {
		confirmingSignal = null;
		if (confirmTimer) clearTimeout(confirmTimer);
		try {
			const res = await fetch(`/api/processes/${pid}?signal=${selectedSignal}`, { method: 'DELETE' });
			if (!res.ok) throw new Error('Signal failed');
			toast.success(`Sent ${selectedSignal} to PID ${pid}`);
		} catch (e: any) {
			toast.error(e.message || `Failed to send signal to PID ${pid}`);
		}
		await refresh();
	}

	function formatMem(kb: number): string {
		if (kb < 1024) return `${kb} KB`;
		if (kb < 1024 * 1024) return `${(kb / 1024).toFixed(1)} MB`;
		return `${(kb / (1024 * 1024)).toFixed(1)} GB`;
	}
</script>

<svelte:head>
	<title>Processes | Home Server</title>
</svelte:head>

<div class="header">
	<h2>Process Manager</h2>
	<div class="controls">
		<input type="text" placeholder="Filter..." bind:value={filter} class="filter-input" />
		<div class="view-toggle">
			<button class="btn" class:active={viewMode === 'flat'} onclick={() => (viewMode = 'flat')}>List</button>
			<button class="btn" class:active={viewMode === 'tree'} onclick={() => (viewMode = 'tree')}>Tree</button>
		</div>
		<button class="btn" onclick={refresh}>Refresh</button>
		<div class="refresh-group">
			<button class="btn" class:active={autoRefresh} onclick={toggleAutoRefresh}>
				Auto {autoRefresh ? 'ON' : 'OFF'}
			</button>
			<select class="refresh-select" value={refreshRate} onchange={updateRefreshRate}>
				<option value={2}>2s</option>
				<option value={5}>5s</option>
				<option value={10}>10s</option>
				<option value={30}>30s</option>
				<option value={60}>60s</option>
			</select>
		</div>
	</div>
</div>

<div class="process-list">
	<div class="process-header">
		<span class="col-star"></span>
		<span class="col-pid">PID</span>
		<span class="col-name">Name</span>
		<span class="col-cpu">CPU%</span>
		<span class="col-mem">MEM%</span>
		<span class="col-rss">RSS</span>
		<span class="col-state">State</span>
		<span class="col-user">User</span>
		<span class="col-actions"></span>
	</div>
	{#each displayed as proc}
		{@const node = viewMode === 'tree' && 'depth' in proc ? proc as TreeNode : null}
		{@const depth = node?.depth ?? 0}
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div class="process-row" class:starred={starred.has(proc.pid)} class:expanded={expandedPid === proc.pid} onclick={() => toggleExpand(proc.pid)}>
			<span class="col-star">
				<button class="star-btn" class:active={starred.has(proc.pid)} onclick={(e) => { e.stopPropagation(); toggleStar(proc.pid); }} title="Star">
					{starred.has(proc.pid) ? '★' : '☆'}
				</button>
			</span>
			<span class="col-pid">{proc.pid}</span>
			<span class="col-name" title={proc.command}>
				{#if node && depth > 0}
					<span class="tree-connectors">
						{#each node.connectors.slice(0, -1) as hasSibling}
							<span class="tree-line">{hasSibling ? '│' : ' '}</span>
						{/each}
						<span class="tree-branch">{node.isLast ? '└' : '├'}─</span>
					</span>
				{/if}
				<span class="expand-indicator">{expandedPid === proc.pid ? '▼' : '▸'}</span>
				{proc.name}
			</span>
			<span class="col-cpu" class:hot={proc.cpu > 50}>{proc.cpu.toFixed(1)}</span>
			<span class="col-mem" class:hot={proc.mem > 50}>{proc.mem.toFixed(1)}</span>
			<span class="col-rss">{formatMem(proc.rss)}</span>
			<span class="col-state">{proc.state}</span>
			<span class="col-user">{proc.user}</span>
			<span class="col-actions" onclick={(e) => e.stopPropagation()}>
				<select class="signal-select" bind:value={selectedSignal} title={SIGNAL_INFO[selectedSignal]}>
					{#each SIGNALS as sig}
						<option value={sig}>{sig}</option>
					{/each}
				</select>
				{#if confirmingSignal === proc.pid}
					<button class="btn btn-sm btn-confirm" onclick={() => confirmSignal(proc.pid)}>sure?</button>
				{:else}
					<button class="btn btn-sm btn-danger" onclick={() => requestSignal(proc.pid)} title={SIGNAL_INFO[selectedSignal]}>send</button>
				{/if}
			</span>
		</div>
		{#if expandedPid === proc.pid}
			<div class="signal-hint">{SIGNAL_INFO[selectedSignal]}</div>
		{/if}
		{#if expandedPid === proc.pid}
			<div class="detail-panel">
				<div class="detail-passive">
					<div class="detail-grid">
						<span class="detail-label">PPID</span><span>{proc.ppid}</span>
						<span class="detail-label">VSZ</span><span>{formatMem(proc.vsz)}</span>
						<span class="detail-label">RSS</span><span>{formatMem(proc.rss)}</span>
						<span class="detail-label">State</span><span>{proc.state}</span>
						<span class="detail-label">Started</span><span>{proc.startTime}</span>
					</div>
					<div class="detail-command">
						<span class="detail-label">Command</span>
						<code>{proc.command}</code>
					</div>
				</div>

				<div class="detail-active">
					{#if activeDetail && activeDetail.pid === proc.pid}
						<div class="detail-grid">
							<span class="detail-label">Threads</span><span>{activeDetail.threads}</span>
							{#if activeDetail.connections.length > 0}
								<span class="detail-label">Ports</span>
								<span>{activeDetail.connections.map(c => { const m = c.match(/:(\d+)$/); return m ? m[1] : null; }).filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).join(', ') || 'N/A'}</span>
							{/if}
						</div>
						{#if activeDetail.openFiles.length > 0}
							<details class="detail-section">
								<summary>Open Files ({activeDetail.openFiles.length})</summary>
								<ul class="file-list-detail">
									{#each activeDetail.openFiles as f}
										<li>{f}</li>
									{/each}
								</ul>
							</details>
						{/if}
						{#if activeDetail.connections && activeDetail.connections.length > 0}
							<details class="detail-section">
								<summary>Network Connections ({activeDetail.connections.length})</summary>
								<ul class="file-list-detail">
									{#each activeDetail.connections as c}
										<li>{c}</li>
									{/each}
								</ul>
							</details>
						{/if}
						{#if Object.keys(activeDetail.env).length > 0}
							<details class="detail-section">
								<summary>Environment ({Object.keys(activeDetail.env).length} vars)</summary>
								<div class="env-list">
									{#each Object.entries(activeDetail.env) as [k, v]}
										<div><strong>{k}</strong>={v}</div>
									{/each}
								</div>
							</details>
						{/if}
					{:else}
						<button class="btn inspect-btn" onclick={() => fetchDetail(proc.pid)} disabled={detailLoading}>
							{detailLoading ? 'Loading...' : 'Inspect (open files, threads, env)'}
						</button>
					{/if}
				</div>
			</div>
		{/if}
	{/each}
</div>

{#if displayList.length > DISPLAY_LIMIT && !showAll}
	<button class="btn show-all" onclick={() => (showAll = true)}>
		Show all {displayList.length} processes
	</button>
{/if}

<style>
	.header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 16px;
		flex-wrap: wrap;
		gap: 10px;
	}

	h2 { font-size: 1.3rem; }

	.controls {
		display: flex;
		gap: 8px;
		align-items: center;
		flex-wrap: wrap;
	}

	.filter-input {
		padding: 6px 12px;
		font-size: 0.8rem;
		border-radius: 6px;
		border: 1px solid var(--border);
		background: var(--input-bg);
		color: var(--text-primary);
		width: 160px;
		font-family: inherit;
	}

	.filter-input:focus { outline: none; border-color: var(--accent); }

	.view-toggle {
		display: flex;
		gap: 0;
	}

	.view-toggle .btn {
		border-radius: 0;
	}

	.view-toggle .btn:first-child { border-radius: 6px 0 0 6px; }
	.view-toggle .btn:last-child { border-radius: 0 6px 6px 0; }

	.btn {
		padding: 6px 14px;
		font-size: 0.8rem;
		border-radius: 6px;
		border: 1px solid var(--border);
		background: var(--btn-bg);
		color: var(--text-secondary);
		cursor: pointer;
		font-family: inherit;
	}

	.btn:hover { border-color: var(--accent); }

	.btn.active {
		border-color: var(--accent);
		color: var(--accent);
	}

	.refresh-group { display: flex; gap: 4px; align-items: center; }

	.refresh-select {
		padding: 5px 8px;
		font-size: 0.8rem;
		border-radius: 6px;
		border: 1px solid var(--border);
		background: var(--btn-bg);
		color: var(--text-secondary);
		cursor: pointer;
		font-family: inherit;
	}

	.process-list {
		border: 1px solid var(--border);
		border-radius: 8px;
		overflow: hidden;
	}

	.process-header, .process-row {
		display: grid;
		grid-template-columns: 30px 70px 1fr 60px 60px 80px 50px 80px 120px;
		padding: 10px 16px;
		align-items: center;
		gap: 6px;
	}

	.process-header {
		background: var(--bg-secondary);
		font-size: 0.75rem;
		color: var(--text-muted);
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.process-row {
		border-top: 1px solid var(--border-subtle);
		font-size: 0.85rem;
	}

	.process-row:hover { background: var(--bg-secondary); }
	.process-row.starred { background: var(--purple-bg); }
	.process-row.expanded { background: var(--bg-inset); }

	.star-btn {
		background: none;
		border: none;
		cursor: pointer;
		font-size: 0.9rem;
		color: var(--text-faint);
		padding: 0;
	}

	.star-btn.active { color: var(--purple); }
	.star-btn:hover { color: var(--purple); }

	.process-row { cursor: pointer; }

	.expand-indicator {
		color: var(--text-faint);
		font-size: 0.7rem;
		margin-right: 4px;
		flex-shrink: 0;
	}

	.signal-hint {
		padding: 4px 16px 4px 110px;
		font-size: 0.65rem;
		color: var(--text-faint);
		font-style: italic;
		border-top: 1px dashed var(--border-subtle);
		background: var(--bg-inset);
	}

	.tree-connectors {
		display: inline-flex;
		align-items: center;
		font-family: monospace;
		color: var(--text-faint);
		font-size: 0.75rem;
		line-height: 1;
		user-select: none;
	}

	.tree-line {
		display: inline-block;
		width: 14px;
		text-align: center;
	}

	.tree-branch {
		display: inline-block;
		width: 20px;
	}

	.col-pid { font-family: monospace; font-size: 0.8rem; color: var(--text-muted); }

	.col-name {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		display: flex;
		align-items: center;
	}

	.col-cpu, .col-mem { font-family: monospace; font-size: 0.8rem; color: var(--text-muted); text-align: right; }
	.col-cpu.hot, .col-mem.hot { color: var(--danger); font-weight: 600; }
	.col-rss { font-family: monospace; font-size: 0.75rem; color: var(--text-muted); }
	.col-state { font-family: monospace; font-size: 0.75rem; color: var(--text-muted); text-align: center; }
	.col-user { font-size: 0.75rem; color: var(--text-muted); overflow: hidden; text-overflow: ellipsis; }
	.col-actions { display: flex; gap: 4px; justify-content: flex-end; align-items: center; }

	.signal-select {
		padding: 2px 4px;
		font-size: 0.7rem;
		border-radius: 4px;
		border: 1px solid var(--border);
		background: var(--btn-bg);
		color: var(--text-secondary);
		font-family: monospace;
	}

	.btn-sm { padding: 3px 8px; font-size: 0.75rem; border-radius: 4px; font-family: monospace; }
	.btn-danger:hover { border-color: var(--danger); color: var(--danger); }
	.btn-confirm { border-color: var(--danger); background: var(--danger-bg); color: var(--danger); animation: pulse 0.6s ease-in-out infinite alternate; }

	/* Expandable detail panel */
	.detail-panel {
		padding: 12px 16px 12px 48px;
		border-top: 1px solid var(--border-subtle);
		background: var(--bg-inset);
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.detail-grid {
		display: grid;
		grid-template-columns: 80px 1fr;
		gap: 3px 12px;
		font-size: 0.8rem;
	}

	.detail-label {
		color: var(--text-muted);
		text-transform: uppercase;
		font-size: 0.7rem;
		letter-spacing: 0.03em;
	}

	.detail-command {
		margin-top: 6px;
	}

	.detail-command code {
		display: block;
		margin-top: 4px;
		padding: 6px 10px;
		background: var(--bg-secondary);
		border-radius: 4px;
		font-size: 0.75rem;
		word-break: break-all;
		white-space: pre-wrap;
	}

	.detail-active {
		padding-top: 8px;
		border-top: 1px dashed var(--border-subtle);
	}

	.inspect-btn {
		font-size: 0.75rem;
		color: var(--accent);
		border-color: var(--accent-bg);
	}

	.detail-section {
		margin-top: 8px;
		font-size: 0.8rem;
	}

	.detail-section summary {
		cursor: pointer;
		color: var(--text-muted);
		font-size: 0.75rem;
		text-transform: uppercase;
		letter-spacing: 0.03em;
	}

	.file-list-detail {
		list-style: none;
		padding: 4px 0;
		max-height: 200px;
		overflow-y: auto;
	}

	.file-list-detail li {
		font-size: 0.75rem;
		font-family: monospace;
		color: var(--text-muted);
		padding: 1px 0;
	}

	.env-list {
		max-height: 200px;
		overflow-y: auto;
		font-size: 0.75rem;
		font-family: monospace;
		padding: 4px 0;
	}

	.env-list div { padding: 1px 0; word-break: break-all; }

	.show-all { display: block; margin: 12px auto; }

	@keyframes pulse {
		from { opacity: 0.7; }
		to { opacity: 1; }
	}

	@media (max-width: 640px) {
		.process-header, .process-row {
			grid-template-columns: 28px 55px 1fr 50px 50px 80px;
		}
		.col-rss, .col-state, .col-user { display: none; }
	}
</style>
