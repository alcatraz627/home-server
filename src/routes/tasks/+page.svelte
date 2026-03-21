<script lang="ts">
	import type { PageData } from './$types';
	import type { TaskStatus } from '$lib/server/operator';

	let { data } = $props<{ data: PageData }>();
	// svelte-ignore state_referenced_locally
	const { statuses: initialStatuses, disk: initialDisk } = data;
	let statuses = $state<TaskStatus[]>(initialStatuses);
	let disk = $state(initialDisk);

	let showForm = $state(false);
	let formName = $state('');
	let formCommand = $state('');
	let formTimeout = $state(300);
	let formRetries = $state(3);
	let formSchedule = $state('');

	let expandedTask = $state<string | null>(null);

	async function refresh() {
		const res = await fetch('/api/tasks');
		const result = await res.json();
		statuses = result.statuses;
		disk = result.disk;
	}

	async function createTask() {
		await fetch('/api/tasks', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				name: formName,
				command: formCommand,
				timeout: formTimeout,
				maxRetries: formRetries,
				schedule: formSchedule || null
			})
		});
		showForm = false;
		formName = ''; formCommand = ''; formTimeout = 300; formRetries = 3; formSchedule = '';
		await refresh();
	}

	async function runTask(taskId: string) {
		await fetch('/api/tasks', {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ taskId })
		});
		// Poll
		const poll = setInterval(async () => {
			await refresh();
			const s = statuses.find(s => s.config.id === taskId);
			if (!s?.isRunning) clearInterval(poll);
		}, 1000);
	}

	async function deleteTask(id: string) {
		await fetch('/api/tasks', {
			method: 'DELETE',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ id })
		});
		await refresh();
	}

	function formatDuration(ms: number): string {
		if (ms < 1000) return `${ms}ms`;
		if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
		return `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`;
	}

	function statusColor(status: string): string {
		if (status === 'success') return '#3fb950';
		if (status === 'failed' || status === 'timeout') return '#f85149';
		return '#d29922';
	}
</script>

<svelte:head>
	<title>Tasks | Home Server</title>
</svelte:head>

<div class="header">
	<h2>Operator Tasks</h2>
	<div class="controls">
		<button class="btn" onclick={refresh}>Refresh</button>
		<button class="btn" onclick={() => (showForm = !showForm)}>
			{showForm ? 'Cancel' : 'New Task'}
		</button>
	</div>
</div>

<!-- Disk usage -->
{#if disk.length > 0}
	<div class="disk-section">
		<h3>Disk Usage</h3>
		<div class="disk-grid">
			{#each disk as d}
				<div class="disk-item">
					<span class="disk-mount">{d.mount}</span>
					<div class="disk-bar">
						<div class="disk-fill" style="width: {d.usePercent}; background: {parseInt(d.usePercent) > 90 ? '#f85149' : parseInt(d.usePercent) > 70 ? '#d29922' : '#3fb950'}"></div>
					</div>
					<span class="disk-info">{d.used} / {d.total} ({d.usePercent})</span>
				</div>
			{/each}
		</div>
	</div>
{/if}

{#if showForm}
	<div class="form-card">
		<h3>New Task</h3>
		<div class="form-grid">
			<label><span>Name</span><input type="text" bind:value={formName} placeholder="Disk space check" /></label>
			<label><span>Command</span><input type="text" bind:value={formCommand} placeholder="df -h | grep /dev" /></label>
			<label><span>Schedule (cron, optional)</span><input type="text" bind:value={formSchedule} placeholder="*/5 * * * * (every 5 min)" /></label>
			<div class="form-row">
				<label><span>Timeout (s)</span><input type="number" bind:value={formTimeout} min="5" /></label>
				<label><span>Max Retries</span><input type="number" bind:value={formRetries} min="0" max="10" /></label>
			</div>
		</div>
		<button class="btn btn-primary" onclick={createTask} disabled={!formName || !formCommand}>Create</button>
	</div>
{/if}

{#if statuses.length === 0 && !showForm}
	<p class="empty">No tasks configured. Click "New Task" to create one.</p>
{:else}
	<div class="task-list">
		{#each statuses as status}
			<div class="task-card">
				<div class="task-top">
					<div class="task-info">
						<h3>{status.config.name}</h3>
						<code class="task-command">{status.config.command}</code>
						<div class="task-meta">
							timeout: {status.config.timeout}s · retries: {status.config.maxRetries}
							{#if status.config.schedule}
								· <span class="task-schedule">cron: {status.config.schedule}</span>
							{/if}
						</div>
					</div>
					<div class="task-actions">
						<button class="btn btn-sm" onclick={() => runTask(status.config.id)} disabled={status.isRunning}>
							{status.isRunning ? 'Running...' : 'Run'}
						</button>
						<button class="btn btn-sm" onclick={() => (expandedTask = expandedTask === status.config.id ? null : status.config.id)}>
							{expandedTask === status.config.id ? '▲' : '▼'}
						</button>
						<button class="btn btn-sm btn-danger" onclick={() => deleteTask(status.config.id)}>✕</button>
					</div>
				</div>

				{#if status.lastRun}
					<div class="last-run">
						<span class="run-dot" style="color: {statusColor(status.lastRun.status)}">●</span>
						<span class="run-status">{status.lastRun.status}</span>
						{#if status.lastRun.duration}
							<span class="run-duration">{formatDuration(status.lastRun.duration)}</span>
						{/if}
						<span class="run-attempt">attempt {status.lastRun.attempt}</span>
					</div>
				{/if}

				{#if expandedTask === status.config.id && status.lastRun}
					<div class="task-output">
						<pre>{status.lastRun.output || '(no output)'}</pre>
					</div>
				{/if}
			</div>
		{/each}
	</div>
{/if}

<style>
	.header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
	h2 { font-size: 1.3rem; }
	.controls { display: flex; gap: 8px; }
	.btn { padding: 6px 14px; font-size: 0.8rem; border-radius: 6px; border: 1px solid #30363d; background: #21262d; color: #c9d1d9; cursor: pointer; font-family: inherit; }
	.btn:hover:not(:disabled) { border-color: #58a6ff; }
	.btn:disabled { opacity: 0.5; cursor: default; }
	.btn-sm { padding: 4px 10px; font-size: 0.75rem; }
	.btn-primary { background: #238636; border-color: #2ea043; color: #fff; margin-top: 12px; }
	.btn-primary:hover:not(:disabled) { background: #2ea043; }
	.btn-danger:hover { border-color: #f85149; color: #f85149; }

	.disk-section { margin-bottom: 20px; padding: 14px; background: #161b22; border: 1px solid #30363d; border-radius: 8px; }
	.disk-section h3 { font-size: 0.85rem; color: #8b949e; margin-bottom: 10px; text-transform: uppercase; letter-spacing: 0.03em; }
	.disk-grid { display: flex; flex-direction: column; gap: 8px; }
	.disk-item { display: flex; align-items: center; gap: 10px; font-size: 0.8rem; }
	.disk-mount { width: 120px; font-family: monospace; font-size: 0.75rem; color: #c9d1d9; overflow: hidden; text-overflow: ellipsis; }
	.disk-bar { flex: 1; height: 8px; background: #21262d; border-radius: 4px; overflow: hidden; }
	.disk-fill { height: 100%; border-radius: 4px; transition: width 0.3s; }
	.disk-info { font-size: 0.7rem; color: #8b949e; width: 140px; text-align: right; }

	.form-card { background: #161b22; border: 1px solid #30363d; border-radius: 8px; padding: 20px; margin-bottom: 16px; }
	.form-card h3 { font-size: 1rem; margin-bottom: 14px; }
	.form-grid { display: flex; flex-direction: column; gap: 12px; }
	.form-grid label { display: flex; flex-direction: column; gap: 4px; }
	.form-grid label span { font-size: 0.75rem; color: #8b949e; text-transform: uppercase; }
	.form-grid input { padding: 8px 12px; font-size: 0.85rem; border-radius: 6px; border: 1px solid #30363d; background: #0d1117; color: #e1e4e8; font-family: inherit; }
	.form-grid input:focus { outline: none; border-color: #58a6ff; }
	.form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }

	.empty { color: #8b949e; text-align: center; padding: 40px; }
	.task-list { display: flex; flex-direction: column; gap: 10px; }
	.task-card { background: #161b22; border: 1px solid #30363d; border-radius: 8px; padding: 14px 16px; }
	.task-top { display: flex; justify-content: space-between; align-items: flex-start; }
	.task-info h3 { font-size: 0.95rem; margin-bottom: 4px; }
	.task-command { font-size: 0.75rem; color: #8b949e; display: block; margin-bottom: 4px; }
	.task-meta { font-size: 0.7rem; color: #484f58; }
	.task-schedule { color: var(--accent, #58a6ff); }
	.task-actions { display: flex; gap: 6px; }

	.last-run { display: flex; align-items: center; gap: 8px; margin-top: 10px; padding-top: 8px; border-top: 1px solid #21262d; }
	.run-dot { font-size: 0.6rem; }
	.run-status { font-size: 0.8rem; }
	.run-duration { font-size: 0.75rem; color: #8b949e; }
	.run-attempt { font-size: 0.7rem; color: #484f58; }

	.task-output { margin-top: 8px; }
	.task-output pre { background: #0d1117; padding: 10px; border-radius: 6px; font-size: 0.7rem; max-height: 300px; overflow: auto; color: #8b949e; white-space: pre-wrap; word-break: break-all; }
</style>
