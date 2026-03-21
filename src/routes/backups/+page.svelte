<script lang="ts">
	import type { PageData } from './$types';
	import type { BackupStatus, BackupConfig } from '$lib/server/backups';

	let { data } = $props<{ data: PageData }>();
	// svelte-ignore state_referenced_locally
	let statuses = $state<BackupStatus[]>(data.statuses);
	// svelte-ignore state_referenced_locally
	const rsyncAvailable = data.rsyncAvailable;

	// New backup form
	let showForm = $state(false);
	let formName = $state('');
	let formSource = $state('');
	let formDest = $state('');
	let formExcludes = $state('');
	let formSchedule = $state('');

	// Running state
	let runningIds = $state<Set<string>>(new Set());

	async function refresh() {
		const res = await fetch('/api/backups');
		const result = await res.json();
		statuses = result.statuses;
	}

	async function createBackup() {
		const config = {
			name: formName,
			sourcePath: formSource,
			destPath: formDest,
			excludes: formExcludes.split('\n').map(s => s.trim()).filter(Boolean),
			schedule: formSchedule || null
		};
		await fetch('/api/backups', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(config)
		});
		showForm = false;
		formName = ''; formSource = ''; formDest = ''; formExcludes = ''; formSchedule = '';
		await refresh();
	}

	async function triggerBackup(configId: string) {
		runningIds.add(configId);
		runningIds = new Set(runningIds);
		await fetch('/api/backups', {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ configId })
		});
		// Poll for completion
		const poll = setInterval(async () => {
			await refresh();
			const status = statuses.find(s => s.config.id === configId);
			if (status?.lastRun?.status !== 'running') {
				clearInterval(poll);
				runningIds.delete(configId);
				runningIds = new Set(runningIds);
			}
		}, 2000);
	}

	function formatSize(bytes: number): string {
		if (bytes === 0) return '0 B';
		const units = ['B', 'KB', 'MB', 'GB'];
		const i = Math.floor(Math.log(bytes) / Math.log(1024));
		return `${(bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0)} ${units[i]}`;
	}

	function formatDate(iso: string): string {
		return new Date(iso).toLocaleString();
	}

	function statusColor(status: string): string {
		if (status === 'success') return '#3fb950';
		if (status === 'failed') return '#f85149';
		return '#d29922';
	}
</script>

<svelte:head>
	<title>Backups | Home Server</title>
</svelte:head>

<div class="header">
	<h2>Backups</h2>
	<div class="controls">
		<button class="btn" onclick={refresh}>Refresh</button>
		<button class="btn" onclick={() => (showForm = !showForm)}>
			{showForm ? 'Cancel' : 'New Backup'}
		</button>
	</div>
</div>

{#if !rsyncAvailable}
	<div class="warning">rsync is not installed. Backups require rsync to be available on this machine.</div>
{/if}

{#if showForm}
	<div class="form-card">
		<h3>New Backup Configuration</h3>
		<div class="form-grid">
			<label>
				<span>Name</span>
				<input type="text" bind:value={formName} placeholder="Phone Photos" />
			</label>
			<label>
				<span>Source Path</span>
				<input type="text" bind:value={formSource} placeholder="/path/to/source/" />
			</label>
			<label>
				<span>Destination Path</span>
				<input type="text" bind:value={formDest} placeholder="/path/to/backup/" />
			</label>
			<label>
				<span>Schedule (cron expression, optional)</span>
				<input type="text" bind:value={formSchedule} placeholder="0 2 * * * (daily at 2am)" />
			</label>
			<label>
				<span>Excludes (one per line)</span>
				<textarea bind:value={formExcludes} rows="3" placeholder=".thumbnails&#10;.cache"></textarea>
			</label>
		</div>
		<button class="btn btn-primary" onclick={createBackup} disabled={!formName || !formSource || !formDest}>
			Create
		</button>
	</div>
{/if}

{#if statuses.length === 0 && !showForm}
	<p class="empty">No backup configurations yet. Click "New Backup" to set one up.</p>
{:else}
	<div class="backup-list">
		{#each statuses as status}
			<div class="backup-card">
				<div class="backup-top">
					<div>
						<h3>{status.config.name}</h3>
						<div class="backup-paths">
							<span class="path-label">From:</span> <code>{status.config.sourcePath}</code>
						</div>
						<div class="backup-paths">
							<span class="path-label">To:</span> <code>{status.config.destPath}</code>
						</div>
						{#if status.config.schedule}
							<div class="backup-schedule">Schedule: <code>{status.config.schedule}</code></div>
						{/if}
						{#if status.config.excludes.length > 0}
							<div class="backup-excludes">
								Excludes: {status.config.excludes.join(', ')}
							</div>
						{/if}
					</div>
					<button
						class="btn"
						onclick={() => triggerBackup(status.config.id)}
						disabled={runningIds.has(status.config.id)}
					>
						{runningIds.has(status.config.id) ? 'Running...' : 'Run Now'}
					</button>
				</div>

				{#if status.lastRun}
					<div class="last-run">
						<span class="run-status" style="color: {statusColor(status.lastRun.status)}">
							● {status.lastRun.status}
						</span>
						<span class="run-time">{formatDate(status.lastRun.startedAt)}</span>
						{#if status.lastRun.status === 'success'}
							<span class="run-stats">
								{status.lastRun.filesTransferred} files, {formatSize(status.lastRun.bytesTransferred)}
							</span>
						{/if}
						{#if status.lastRun.error}
							<details class="run-error">
								<summary>Error details</summary>
								<pre>{status.lastRun.error}</pre>
							</details>
						{/if}
					</div>
				{:else}
					<div class="last-run">
						<span class="run-status" style="color: #8b949e">Never run</span>
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
	.btn-primary { background: #238636; border-color: #2ea043; color: #fff; margin-top: 12px; }
	.btn-primary:hover:not(:disabled) { background: #2ea043; border-color: #3fb950; }

	.warning { background: #d299221a; border: 1px solid #d29922; border-radius: 8px; padding: 12px 16px; color: #d29922; font-size: 0.85rem; margin-bottom: 16px; }

	.form-card { background: #161b22; border: 1px solid #30363d; border-radius: 8px; padding: 20px; margin-bottom: 16px; }
	.form-card h3 { font-size: 1rem; margin-bottom: 14px; }
	.form-grid { display: flex; flex-direction: column; gap: 12px; }
	.form-grid label { display: flex; flex-direction: column; gap: 4px; }
	.form-grid label span { font-size: 0.75rem; color: #8b949e; text-transform: uppercase; letter-spacing: 0.03em; }
	.form-grid input, .form-grid textarea { padding: 8px 12px; font-size: 0.85rem; border-radius: 6px; border: 1px solid #30363d; background: #0d1117; color: #e1e4e8; font-family: inherit; }
	.form-grid input:focus, .form-grid textarea:focus { outline: none; border-color: #58a6ff; }

	.empty { color: #8b949e; text-align: center; padding: 40px; }

	.backup-list { display: flex; flex-direction: column; gap: 12px; }
	.backup-card { background: #161b22; border: 1px solid #30363d; border-radius: 8px; padding: 16px; }
	.backup-top { display: flex; justify-content: space-between; align-items: flex-start; }
	.backup-top h3 { font-size: 1rem; margin-bottom: 6px; }
	.backup-paths { font-size: 0.8rem; color: #8b949e; margin-bottom: 2px; }
	.backup-paths code { font-size: 0.8rem; color: #c9d1d9; }
	.path-label { display: inline-block; width: 36px; }
	.backup-schedule { font-size: 0.75rem; color: var(--accent, #58a6ff); margin-bottom: 2px; }
	.backup-schedule code { font-size: 0.75rem; }
	.backup-excludes { font-size: 0.7rem; color: #484f58; margin-top: 4px; }

	.last-run { margin-top: 12px; padding-top: 10px; border-top: 1px solid #21262d; display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
	.run-status { font-size: 0.8rem; font-weight: 500; }
	.run-time { font-size: 0.75rem; color: #8b949e; }
	.run-stats { font-size: 0.75rem; color: #8b949e; }
	.run-error { margin-top: 8px; width: 100%; }
	.run-error summary { font-size: 0.75rem; color: #f85149; cursor: pointer; }
	.run-error pre { font-size: 0.7rem; color: #8b949e; background: #0d1117; padding: 8px; border-radius: 4px; overflow-x: auto; margin-top: 4px; }
</style>
