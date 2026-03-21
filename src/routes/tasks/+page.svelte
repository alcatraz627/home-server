<script lang="ts">
	import type { PageData } from './$types';
	import type { TaskStatus } from '$lib/server/operator';

	let { data } = $props<{ data: PageData }>();
	// svelte-ignore state_referenced_locally
	const { statuses: initialStatuses, disk: initialDisk } = data;
	let statuses = $state<TaskStatus[]>(initialStatuses);
	let disk = $state(initialDisk);

	let showForm = $state(false);
	let showTemplates = $state(false);
	let formName = $state('');
	let formCommand = $state('');
	let formTimeout = $state(300);
	let formRetries = $state(3);
	let formSchedule = $state('');

	interface Template {
		name: string;
		command: string;
		timeout: number;
		retries: number;
		schedule: string | null;
		desc: string;
		tags: string[];
	}

	const TEMPLATES: Template[] = [
		// Observability — Disk
		{ name: 'Disk Space Alert', command: "df -h / | awk 'NR==2 {if ($5+0 > 90) {echo \"ALERT: disk at $5\"; exit 1} else {echo \"OK: $5 used\"}}'", timeout: 15, retries: 0, schedule: '0 */6 * * *', desc: 'Alert if root disk exceeds 90%', tags: ['observability', 'disk'] },
		{ name: 'Disk I/O Stats', command: 'iostat -d 1 3 2>/dev/null || echo "iostat not available"', timeout: 15, retries: 0, schedule: null, desc: 'Snapshot of disk I/O throughput and latency', tags: ['observability', 'disk'] },
		{ name: 'Large Files Finder', command: 'find / -xdev -type f -size +500M -exec ls -lh {} \\; 2>/dev/null | sort -k5 -rh | head -20', timeout: 60, retries: 0, schedule: '0 4 * * 0', desc: 'Find files larger than 500MB', tags: ['observability', 'disk'] },
		{ name: 'Inode Usage', command: "df -i / | awk 'NR==2 {print \"Inodes: \" $5 \" used (\" $3 \"/\" $2 \")\"}'", timeout: 10, retries: 0, schedule: '0 */12 * * *', desc: 'Check inode usage — running out causes failures even with free space', tags: ['observability', 'disk'] },

		// Observability — Memory
		{ name: 'Memory Check', command: "vm_stat | awk '/Pages free/ {free=$3} /Pages active/ {active=$3} END {printf \"Free: %.0f MB, Active: %.0f MB\\n\", free*4096/1048576, active*4096/1048576}'", timeout: 10, retries: 0, schedule: '*/30 * * * *', desc: 'Report free and active memory', tags: ['observability', 'memory'] },
		{ name: 'Swap Usage', command: 'sysctl vm.swapusage 2>/dev/null || free -h 2>/dev/null | grep -i swap', timeout: 10, retries: 0, schedule: '0 */4 * * *', desc: 'Check swap memory usage — high swap indicates memory pressure', tags: ['observability', 'memory'] },
		{ name: 'Top Memory Consumers', command: 'ps aux --sort=-%mem 2>/dev/null | head -11 || ps aux -m | head -11', timeout: 15, retries: 0, schedule: null, desc: 'Top 10 processes by memory usage', tags: ['observability', 'memory', 'process'] },

		// Observability — CPU / Load
		{ name: 'CPU Load Average', command: 'uptime', timeout: 5, retries: 0, schedule: '*/15 * * * *', desc: 'System load averages (1, 5, 15 min)', tags: ['observability', 'cpu'] },
		{ name: 'Top CPU Consumers', command: 'ps aux --sort=-%cpu 2>/dev/null | head -11 || ps aux -r | head -11', timeout: 15, retries: 0, schedule: null, desc: 'Top 10 processes by CPU usage', tags: ['observability', 'cpu', 'process'] },
		{ name: 'CPU Temperature', command: 'sudo powermetrics --samplers smc -i 1 -n 1 2>/dev/null | grep -i "CPU die" || sensors 2>/dev/null | grep -i temp || echo "Not available"', timeout: 15, retries: 0, schedule: null, desc: 'Read CPU temperature (macOS powermetrics or Linux sensors)', tags: ['observability', 'cpu'] },

		// Observability — Network
		{ name: 'Open Ports', command: 'lsof -i -P -n | grep LISTEN | sort -k9', timeout: 15, retries: 0, schedule: null, desc: 'List all processes listening on network ports', tags: ['observability', 'network'] },
		{ name: 'Network Connections', command: 'netstat -an 2>/dev/null | grep ESTABLISHED | wc -l | xargs -I{} echo "{} active connections"', timeout: 10, retries: 0, schedule: '*/30 * * * *', desc: 'Count active network connections', tags: ['observability', 'network'] },
		{ name: 'DNS Resolution Test', command: 'time nslookup google.com 2>&1 | tail -4', timeout: 10, retries: 2, schedule: '*/10 * * * *', desc: 'Test DNS resolution speed', tags: ['observability', 'network'] },
		{ name: 'Tailscale Status', command: '/Applications/Tailscale.app/Contents/MacOS/Tailscale status', timeout: 10, retries: 0, schedule: null, desc: 'Show all connected tailnet devices', tags: ['observability', 'network'] },
		{ name: 'Bandwidth Test', command: 'curl -s -o /dev/null -w "Speed: %{speed_download} bytes/sec\\nTime: %{time_total}s\\n" https://speed.cloudflare.com/__down?bytes=10000000', timeout: 30, retries: 0, schedule: null, desc: 'Quick download speed test via Cloudflare', tags: ['observability', 'network'] },

		// Process Control
		{ name: 'Zombie Processes', command: 'ps aux | awk \'$8 ~ /Z/ {print $2, $11}\' | head -20; echo "---"; ps aux | awk \'$8 ~ /Z/\' | wc -l | xargs -I{} echo "{} zombie processes"', timeout: 15, retries: 0, schedule: '0 */2 * * *', desc: 'Find zombie processes that need cleanup', tags: ['process', 'recovery'] },
		{ name: 'Runaway Process Killer', command: 'ps aux | awk \'$3 > 95 && $11 !~ /kernel/ {print "HIGH CPU:", $2, $11, $3"%"}\'', timeout: 15, retries: 0, schedule: '*/10 * * * *', desc: 'Detect processes using >95% CPU', tags: ['process', 'recovery'] },
		{ name: 'Process Count by User', command: 'ps aux | awk \'{print $1}\' | sort | uniq -c | sort -rn | head -10', timeout: 10, retries: 0, schedule: null, desc: 'Count processes grouped by user', tags: ['process', 'observability'] },
		{ name: 'Long-Running Processes', command: 'ps -eo pid,etime,comm | awk \'$2 ~ /-/ {print}\' | sort -k2 -r | head -15', timeout: 15, retries: 0, schedule: null, desc: 'Processes running for more than a day', tags: ['process', 'observability'] },

		// Recovery
		{ name: 'Service Health Check', command: 'curl -sf http://localhost:5555/api/tailscale > /dev/null && echo "OK" || echo "FAILED"', timeout: 10, retries: 3, schedule: '*/5 * * * *', desc: 'Verify the Home Server API is responding', tags: ['recovery', 'network'] },
		{ name: 'Restart Home Server', command: 'cd ~/Code/Personal/home-server && npm run dev &', timeout: 15, retries: 0, schedule: null, desc: 'Restart the dev server if it crashed', tags: ['recovery'] },
		{ name: 'Clear System Cache', command: 'sudo purge 2>/dev/null && echo "Memory cache purged" || echo "Requires sudo"', timeout: 15, retries: 0, schedule: null, desc: 'Free inactive memory (macOS purge)', tags: ['recovery', 'memory'] },
		{ name: 'Kill Port 5555', command: 'lsof -ti:5555 | xargs kill -9 2>/dev/null && echo "Killed processes on port 5555" || echo "No process on port 5555"', timeout: 10, retries: 0, schedule: null, desc: 'Force kill any process holding port 5555', tags: ['recovery', 'process'] },
		{ name: 'Flush DNS Cache', command: 'sudo dscacheutil -flushcache 2>/dev/null && sudo killall -HUP mDNSResponder 2>/dev/null && echo "DNS flushed" || systemd-resolve --flush-caches 2>/dev/null && echo "DNS flushed"', timeout: 10, retries: 0, schedule: null, desc: 'Flush DNS resolver cache', tags: ['recovery', 'network'] },

		// Maintenance
		{ name: 'Log Rotation', command: 'find /tmp -name "*.log" -mtime +7 -delete && echo "Cleaned old logs"', timeout: 30, retries: 0, schedule: '0 3 * * 0', desc: 'Delete log files older than 7 days', tags: ['maintenance'] },
		{ name: 'Temp File Cleanup', command: 'find /tmp -type f -atime +3 -delete 2>/dev/null; echo "Cleaned tmp files older than 3 days"', timeout: 30, retries: 0, schedule: '0 4 * * *', desc: 'Remove stale temp files', tags: ['maintenance', 'disk'] },
		{ name: 'npm Cache Clean', command: 'npm cache clean --force 2>&1 && echo "npm cache cleared"', timeout: 30, retries: 0, schedule: null, desc: 'Free disk space from npm cache', tags: ['maintenance', 'disk'] },
		{ name: 'Git Repo Status', command: 'cd ~/Code && for d in */; do echo "=== $d ===" && git -C "$d" status -s 2>/dev/null; done', timeout: 30, retries: 0, schedule: null, desc: 'Check git status across all repos in ~/Code', tags: ['maintenance'] },
		{ name: 'System Uptime Report', command: 'echo "Uptime: $(uptime)"; echo "Boot: $(who -b 2>/dev/null || last reboot | head -1)"; echo "Users: $(who | wc -l | tr -d \" \") logged in"', timeout: 10, retries: 0, schedule: '0 8 * * *', desc: 'Daily system uptime and login summary', tags: ['observability'] },
		{ name: 'Backup Disk Health', command: 'diskutil info /Volumes/* 2>/dev/null | grep -E "Name|Total|Free|SMART" || lsblk -o NAME,SIZE,FSAVAIL,FSUSE% 2>/dev/null', timeout: 15, retries: 0, schedule: '0 6 * * *', desc: 'Check health of mounted volumes', tags: ['observability', 'disk', 'recovery'] },
	];

	// Template search/filter/pagination
	let templateSearch = $state('');
	let templateTag = $state('');
	let templatePage = $state(0);
	const TEMPLATES_PER_PAGE = 9;

	let allTags = $derived([...new Set(TEMPLATES.flatMap(t => t.tags))].sort());

	let filteredTemplates = $derived.by(() => {
		let result = TEMPLATES;
		if (templateSearch) {
			const q = templateSearch.toLowerCase();
			result = result.filter(t =>
				t.name.toLowerCase().includes(q) || t.desc.toLowerCase().includes(q) || t.command.toLowerCase().includes(q)
			);
		}
		if (templateTag) {
			result = result.filter(t => t.tags.includes(templateTag));
		}
		return result;
	});

	let templateTotalPages = $derived(Math.max(1, Math.ceil(filteredTemplates.length / TEMPLATES_PER_PAGE)));
	let pagedTemplates = $derived(filteredTemplates.slice(templatePage * TEMPLATES_PER_PAGE, (templatePage + 1) * TEMPLATES_PER_PAGE));

	// Reset page when filter changes
	$effect(() => { filteredTemplates.length; templatePage = 0; });

	function applyTemplate(t: Template) {
		formName = t.name;
		formCommand = t.command;
		formTimeout = t.timeout;
		formRetries = t.retries;
		formSchedule = t.schedule || '';
		showTemplates = false;
		showForm = true;
	}

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
		expandedTask = taskId; // Auto-expand log
		await fetch('/api/tasks', {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ taskId })
		});
		const poll = setInterval(async () => {
			await refresh();
			const s = statuses.find(s => s.config.id === taskId);
			if (!s?.isRunning) clearInterval(poll);
		}, 1000);
	}

	let copied = $state<string | null>(null);
	async function copyOutput(taskId: string, text: string) {
		await navigator.clipboard.writeText(text);
		copied = taskId;
		setTimeout(() => { copied = null; }, 2000);
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
		<button class="btn" onclick={() => { showTemplates = !showTemplates; if (showTemplates) showForm = false; }}>
			Templates
		</button>
		<button class="btn" onclick={() => { showForm = !showForm; if (showForm) showTemplates = false; }}>
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

{#if showTemplates}
	<div class="template-section">
		<div class="template-filters">
			<input type="text" class="template-search" placeholder="Search templates..." bind:value={templateSearch} />
			<div class="tag-bar">
				<button class="tag-btn" class:active={templateTag === ''} onclick={() => (templateTag = '')}>All ({TEMPLATES.length})</button>
				{#each allTags as tag}
					<button class="tag-btn" class:active={templateTag === tag} onclick={() => (templateTag = templateTag === tag ? '' : tag)}>{tag}</button>
				{/each}
			</div>
		</div>
		<div class="template-grid">
			{#each pagedTemplates as t}
				<button class="template-card" onclick={() => applyTemplate(t)}>
					<strong>{t.name}</strong>
					<span class="template-desc">{t.desc}</span>
					<code class="template-cmd">{t.command.slice(0, 70)}{t.command.length > 70 ? '...' : ''}</code>
					<div class="template-footer">
						<div class="template-tags">
							{#each t.tags as tag}
								<span class="template-tag">{tag}</span>
							{/each}
						</div>
						{#if t.schedule}<span class="template-schedule">{t.schedule}</span>{/if}
					</div>
				</button>
			{/each}
		</div>
		{#if filteredTemplates.length === 0}
			<p class="template-empty">No templates match your search.</p>
		{/if}
		{#if templateTotalPages > 1}
			<div class="template-pagination">
				<button class="tool-btn" disabled={templatePage === 0} onclick={() => (templatePage--)}>‹ Prev</button>
				<span class="page-info">{templatePage + 1} / {templateTotalPages}</span>
				<button class="tool-btn" disabled={templatePage >= templateTotalPages - 1} onclick={() => (templatePage++)}>Next ›</button>
			</div>
		{/if}
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
						<div class="output-header">
							<span class="output-label">
								{status.isRunning ? 'Running...' : 'Output'}
								{#if status.isRunning}<span class="output-spinner"></span>{/if}
							</span>
							{#if status.lastRun.output}
								<button class="copy-btn" onclick={() => copyOutput(status.config.id, status.lastRun?.output || '')}>
									{copied === status.config.id ? 'Copied!' : 'Copy'}
								</button>
							{/if}
						</div>
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

	.template-section { margin-bottom: 16px; }
	.template-filters { display: flex; flex-direction: column; gap: 8px; margin-bottom: 12px; }
	.template-search { padding: 7px 12px; font-size: 0.8rem; border-radius: 6px; border: 1px solid var(--border, #30363d); background: var(--input-bg, #0d1117); color: var(--text-primary, #e1e4e8); font-family: inherit; }
	.template-search:focus { outline: none; border-color: var(--accent, #58a6ff); }

	.tag-bar { display: flex; flex-wrap: wrap; gap: 4px; }
	.tag-btn { padding: 3px 10px; font-size: 0.7rem; border-radius: 12px; border: 1px solid var(--border, #30363d); background: var(--btn-bg, #21262d); color: var(--text-muted, #8b949e); cursor: pointer; font-family: inherit; transition: all 0.15s; }
	.tag-btn:hover { border-color: var(--accent, #58a6ff); color: var(--text-primary, #e1e4e8); }
	.tag-btn.active { background: var(--accent-bg); border-color: var(--accent, #58a6ff); color: var(--accent, #58a6ff); }

	.template-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 10px; }
	.template-card { background: var(--bg-secondary, #161b22); border: 1px solid var(--border, #30363d); border-radius: 8px; padding: 12px 14px; text-align: left; cursor: pointer; display: flex; flex-direction: column; gap: 4px; font-family: inherit; color: var(--text-primary, #e1e4e8); transition: border-color 0.15s; }
	.template-card:hover { border-color: var(--accent, #58a6ff); }
	.template-card strong { font-size: 0.85rem; }
	.template-desc { font-size: 0.75rem; color: var(--text-muted, #8b949e); line-height: 1.4; }
	.template-cmd { font-size: 0.65rem; color: var(--text-faint, #484f58); display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; background: var(--code-bg, #0d1117); padding: 4px 6px; border-radius: 3px; margin-top: 2px; }
	.template-footer { display: flex; justify-content: space-between; align-items: center; margin-top: 4px; }
	.template-tags { display: flex; gap: 4px; flex-wrap: wrap; }
	.template-tag { font-size: 0.6rem; padding: 1px 6px; border-radius: 8px; background: var(--bg-hover, #1f2937); color: var(--text-muted, #8b949e); }
	.template-schedule { font-size: 0.6rem; color: var(--accent, #58a6ff); font-family: 'JetBrains Mono', monospace; }
	.template-empty { text-align: center; color: var(--text-muted, #8b949e); padding: 20px; font-size: 0.85rem; }

	.template-pagination { display: flex; justify-content: center; align-items: center; gap: 12px; margin-top: 12px; }
	.tool-btn { padding: 4px 12px; font-size: 0.75rem; border-radius: 6px; border: 1px solid var(--border, #30363d); background: var(--btn-bg, #21262d); color: var(--text-muted, #8b949e); cursor: pointer; font-family: inherit; }
	.tool-btn:hover:not(:disabled) { border-color: var(--accent, #58a6ff); }
	.tool-btn:disabled { opacity: 0.4; cursor: default; }
	.page-info { font-size: 0.7rem; color: var(--text-faint, #484f58); }
	.task-actions { display: flex; gap: 6px; }

	.last-run { display: flex; align-items: center; gap: 8px; margin-top: 10px; padding-top: 8px; border-top: 1px solid #21262d; }
	.run-dot { font-size: 0.6rem; }
	.run-status { font-size: 0.8rem; }
	.run-duration { font-size: 0.75rem; color: #8b949e; }
	.run-attempt { font-size: 0.7rem; color: #484f58; }

	.task-output { margin-top: 8px; }
	.output-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; }
	.output-label { font-size: 0.7rem; color: var(--text-muted, #8b949e); text-transform: uppercase; letter-spacing: 0.03em; display: flex; align-items: center; gap: 6px; }
	.output-spinner { display: inline-block; width: 8px; height: 8px; border: 2px solid var(--border, #30363d); border-top-color: var(--accent, #58a6ff); border-radius: 50%; animation: spin 0.8s linear infinite; }
	@keyframes spin { to { transform: rotate(360deg); } }
	.copy-btn { padding: 2px 8px; font-size: 0.65rem; border-radius: 4px; border: 1px solid var(--border, #30363d); background: var(--btn-bg, #21262d); color: var(--text-muted, #8b949e); cursor: pointer; font-family: inherit; }
	.copy-btn:hover { border-color: var(--accent, #58a6ff); color: var(--text-primary, #e1e4e8); }
	.task-output pre { background: var(--code-bg, #0d1117); padding: 10px; border-radius: 6px; font-size: 0.7rem; max-height: 300px; overflow: auto; color: var(--text-muted, #8b949e); white-space: pre-wrap; word-break: break-all; }
</style>
