<script lang="ts">
	import type { PageData } from './$types';
	import type { ProcessInfo } from '$lib/server/processes';

	let { data } = $props<{ data: PageData }>();
	let processes = $state<ProcessInfo[]>(data.processes);
	let filter = $state('');
	let autoRefresh = $state(false);
	let refreshRate = $state(5);
	let refreshInterval: ReturnType<typeof setInterval> | null = null;
	let confirmingKill = $state<number | null>(null);
	let confirmTimer: ReturnType<typeof setTimeout> | null = null;
	let showAll = $state(false);

	const DISPLAY_LIMIT = 50;

	let filtered = $derived(
		processes.filter(
			(p) =>
				p.name.toLowerCase().includes(filter.toLowerCase()) ||
				p.command.toLowerCase().includes(filter.toLowerCase()) ||
				String(p.pid).includes(filter)
		)
	);

	let displayed = $derived(showAll ? filtered : filtered.slice(0, DISPLAY_LIMIT));

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

	function requestKill(pid: number) {
		if (confirmTimer) clearTimeout(confirmTimer);
		confirmingKill = pid;
		confirmTimer = setTimeout(() => { confirmingKill = null; }, 3000);
	}

	async function killProc(pid: number) {
		confirmingKill = null;
		if (confirmTimer) clearTimeout(confirmTimer);
		await fetch(`/api/processes/${pid}`, { method: 'DELETE' });
		await refresh();
	}
</script>

<svelte:head>
	<title>Processes | Home Server</title>
</svelte:head>

<div class="header">
	<h2>Process Manager</h2>
	<div class="controls">
		<input type="text" placeholder="Filter..." bind:value={filter} class="filter-input" />
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
		<span class="col-pid">PID</span>
		<span class="col-name">Name</span>
		<span class="col-cpu">CPU%</span>
		<span class="col-mem">MEM%</span>
		<span class="col-user">User</span>
		<span class="col-actions"></span>
	</div>
	{#each displayed as proc}
		<div class="process-row">
			<span class="col-pid">{proc.pid}</span>
			<span class="col-name" title={proc.command}>{proc.name}</span>
			<span class="col-cpu" class:hot={proc.cpu > 50}>{proc.cpu.toFixed(1)}</span>
			<span class="col-mem" class:hot={proc.mem > 50}>{proc.mem.toFixed(1)}</span>
			<span class="col-user">{proc.user}</span>
			<span class="col-actions">
				{#if confirmingKill === proc.pid}
					<button class="btn btn-sm btn-confirm" onclick={() => killProc(proc.pid)}>sure?</button>
				{:else}
					<button class="btn btn-sm btn-danger" onclick={() => requestKill(proc.pid)}>kill</button>
				{/if}
			</span>
		</div>
	{/each}
</div>

{#if filtered.length > DISPLAY_LIMIT && !showAll}
	<button class="btn show-all" onclick={() => (showAll = true)}>
		Show all {filtered.length} processes
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

	h2 {
		font-size: 1.3rem;
	}

	.controls {
		display: flex;
		gap: 8px;
		align-items: center;
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

	.filter-input:focus {
		outline: none;
		border-color: #58a6ff;
	}

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

	.btn:hover {
		border-color: #58a6ff;
	}

	.btn.active {
		border-color: #3fb950;
		color: #3fb950;
	}

	.refresh-group {
		display: flex;
		gap: 4px;
		align-items: center;
	}

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

	.process-header,
	.process-row {
		display: grid;
		grid-template-columns: 70px 1fr 65px 65px 100px 60px;
		padding: 10px 16px;
		align-items: center;
		gap: 8px;
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

	.process-row:hover {
		background: #161b22;
	}

	.col-pid {
		font-family: monospace;
		font-size: 0.8rem;
		color: #8b949e;
	}

	.col-name {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.col-cpu,
	.col-mem {
		font-family: monospace;
		font-size: 0.8rem;
		color: #8b949e;
		text-align: right;
	}

	.col-cpu.hot,
	.col-mem.hot {
		color: #f85149;
		font-weight: 600;
	}

	.col-user {
		font-size: 0.75rem;
		color: #8b949e;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.col-actions {
		display: flex;
		justify-content: flex-end;
	}

	.btn-sm {
		padding: 3px 8px;
		font-size: 0.75rem;
		border-radius: 4px;
		font-family: monospace;
	}

	.btn-danger:hover {
		border-color: #f85149;
		color: #f85149;
	}

	.btn-confirm {
		border-color: #f85149;
		background: #f8514922;
		color: #f85149;
		animation: pulse 0.6s ease-in-out infinite alternate;
	}

	.show-all {
		display: block;
		margin: 12px auto;
	}

	@keyframes pulse {
		from { opacity: 0.7; }
		to { opacity: 1; }
	}

	@media (max-width: 640px) {
		.process-header,
		.process-row {
			grid-template-columns: 60px 1fr 55px 55px 50px;
		}
		.col-user {
			display: none;
		}
	}
</style>
