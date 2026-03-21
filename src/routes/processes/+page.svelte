<script lang="ts">
	import type { PageData } from './$types';
	import type { ProcessInfo, ProcessDetail } from '$lib/server/processes';

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

	const SIGNALS = ['TERM', 'KILL', 'HUP', 'INT', 'STOP', 'CONT', 'USR1', 'USR2'];

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

		// Find roots (processes whose parent isn't in our filtered list)
		const roots = sortedWithStars.filter(p => !byPid.has(p.ppid));
		const flat: TreeNode[] = [];

		function walk(proc: ProcessInfo, depth: number) {
			flat.push({ ...proc, children: [], depth });
			const kids = childrenMap.get(proc.pid) || [];
			for (const child of kids) {
				walk(child, depth + 1);
			}
		}

		for (const root of roots) walk(root, 0);
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
		await fetch(`/api/processes/${pid}?signal=${selectedSignal}`, { method: 'DELETE' });
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
		{@const indent = viewMode === 'tree' && 'depth' in proc ? (proc as any).depth : 0}
		<div class="process-row" class:starred={starred.has(proc.pid)} class:expanded={expandedPid === proc.pid}>
			<span class="col-star">
				<button class="star-btn" class:active={starred.has(proc.pid)} onclick={() => toggleStar(proc.pid)} title="Star">
					{starred.has(proc.pid) ? '★' : '☆'}
				</button>
			</span>
			<span class="col-pid">{proc.pid}</span>
			<span class="col-name" title={proc.command} style="padding-left: {indent * 16}px">
				<button class="expand-btn" onclick={() => toggleExpand(proc.pid)}>
					{expandedPid === proc.pid ? '▼' : '▸'}
				</button>
				{proc.name}
			</span>
			<span class="col-cpu" class:hot={proc.cpu > 50}>{proc.cpu.toFixed(1)}</span>
			<span class="col-mem" class:hot={proc.mem > 50}>{proc.mem.toFixed(1)}</span>
			<span class="col-rss">{formatMem(proc.rss)}</span>
			<span class="col-state">{proc.state}</span>
			<span class="col-user">{proc.user}</span>
			<span class="col-actions">
				<select class="signal-select" bind:value={selectedSignal}>
					{#each SIGNALS as sig}
						<option value={sig}>{sig}</option>
					{/each}
				</select>
				{#if confirmingSignal === proc.pid}
					<button class="btn btn-sm btn-confirm" onclick={() => confirmSignal(proc.pid)}>sure?</button>
				{:else}
					<button class="btn btn-sm btn-danger" onclick={() => requestSignal(proc.pid)}>send</button>
				{/if}
			</span>
		</div>
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
		border: 1px solid #30363d;
		background: #0d1117;
		color: #e1e4e8;
		width: 160px;
		font-family: inherit;
	}

	.filter-input:focus { outline: none; border-color: #58a6ff; }

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
		border: 1px solid #30363d;
		background: #21262d;
		color: #c9d1d9;
		cursor: pointer;
		font-family: inherit;
	}

	.btn:hover { border-color: #58a6ff; }

	.btn.active {
		border-color: #58a6ff;
		color: #58a6ff;
	}

	.refresh-group { display: flex; gap: 4px; align-items: center; }

	.refresh-select {
		padding: 5px 8px;
		font-size: 0.8rem;
		border-radius: 6px;
		border: 1px solid #30363d;
		background: #21262d;
		color: #c9d1d9;
		cursor: pointer;
		font-family: inherit;
	}

	.process-list {
		border: 1px solid #30363d;
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
		background: #161b22;
		font-size: 0.75rem;
		color: #8b949e;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.process-row {
		border-top: 1px solid #21262d;
		font-size: 0.85rem;
	}

	.process-row:hover { background: #161b22; }
	.process-row.starred { background: rgba(210, 168, 255, 0.03); }
	.process-row.expanded { background: #0d1117; }

	.star-btn {
		background: none;
		border: none;
		cursor: pointer;
		font-size: 0.9rem;
		color: #484f58;
		padding: 0;
	}

	.star-btn.active { color: #d2a8ff; }
	.star-btn:hover { color: #d2a8ff; }

	.expand-btn {
		background: none;
		border: none;
		cursor: pointer;
		color: #484f58;
		font-size: 0.7rem;
		padding: 0 4px 0 0;
	}

	.expand-btn:hover { color: #e1e4e8; }

	.col-pid { font-family: monospace; font-size: 0.8rem; color: #8b949e; }

	.col-name {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		display: flex;
		align-items: center;
	}

	.col-cpu, .col-mem { font-family: monospace; font-size: 0.8rem; color: #8b949e; text-align: right; }
	.col-cpu.hot, .col-mem.hot { color: #f85149; font-weight: 600; }
	.col-rss { font-family: monospace; font-size: 0.75rem; color: #8b949e; }
	.col-state { font-family: monospace; font-size: 0.75rem; color: #8b949e; text-align: center; }
	.col-user { font-size: 0.75rem; color: #8b949e; overflow: hidden; text-overflow: ellipsis; }
	.col-actions { display: flex; gap: 4px; justify-content: flex-end; align-items: center; }

	.signal-select {
		padding: 2px 4px;
		font-size: 0.7rem;
		border-radius: 4px;
		border: 1px solid #30363d;
		background: #21262d;
		color: #c9d1d9;
		font-family: monospace;
	}

	.btn-sm { padding: 3px 8px; font-size: 0.75rem; border-radius: 4px; font-family: monospace; }
	.btn-danger:hover { border-color: #f85149; color: #f85149; }
	.btn-confirm { border-color: #f85149; background: #f8514922; color: #f85149; animation: pulse 0.6s ease-in-out infinite alternate; }

	/* Expandable detail panel */
	.detail-panel {
		padding: 12px 16px 12px 48px;
		border-top: 1px solid #21262d;
		background: #0d1117;
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
		color: #8b949e;
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
		background: #161b22;
		border-radius: 4px;
		font-size: 0.75rem;
		word-break: break-all;
		white-space: pre-wrap;
	}

	.detail-active {
		padding-top: 8px;
		border-top: 1px dashed #21262d;
	}

	.inspect-btn {
		font-size: 0.75rem;
		color: #58a6ff;
		border-color: #1f6feb33;
	}

	.detail-section {
		margin-top: 8px;
		font-size: 0.8rem;
	}

	.detail-section summary {
		cursor: pointer;
		color: #8b949e;
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
		color: #8b949e;
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
