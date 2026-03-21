<script lang="ts">
	import type { PageData } from './$types';
	import type { FeatureRequest, FeatureScope, FeatureStatus } from '$lib/server/keeper';

	let { data } = $props<{ data: PageData }>();
	// svelte-ignore state_referenced_locally
	const { requests: initialRequests, stats: initialStats } = data;
	let requests = $state<FeatureRequest[]>(initialRequests);
	let stats = $state(initialStats);

	// UI state
	let showForm = $state(false);
	let editingId = $state<string | null>(null);
	let filterStatus = $state<FeatureStatus | ''>('');
	let filterScope = $state<FeatureScope | ''>('');
	let search = $state('');

	// Form state
	let formTitle = $state('');
	let formGoal = $state('');
	let formScope = $state<FeatureScope>('feature');
	let formDetails = $state('');

	const SCOPES: { value: FeatureScope; label: string; desc: string }[] = [
		{ value: 'bug-fix', label: 'Bug Fix', desc: 'Small fix, < 30 min' },
		{ value: 'tweak', label: 'Tweak', desc: 'UI adjustment, config change' },
		{ value: 'feature', label: 'Feature', desc: 'New capability, 1-2 hours' },
		{ value: 'enhancement', label: 'Enhancement', desc: 'Improve existing feature' },
		{ value: 'refactor', label: 'Refactor', desc: 'Code quality, no behavior change' },
		{ value: 'research', label: 'Research', desc: 'Investigate, produce a doc' },
		{ value: 'epic', label: 'Epic', desc: 'Large, may need multiple sessions' }
	];

	const STATUS_FLOW: { value: FeatureStatus; label: string; color: string }[] = [
		{ value: 'backlog', label: 'Backlog', color: 'var(--text-faint)' },
		{ value: 'ready', label: 'Ready', color: 'var(--accent)' },
		{ value: 'in-progress', label: 'In Progress', color: 'var(--warning)' },
		{ value: 'review', label: 'Review', color: 'var(--purple)' },
		{ value: 'done', label: 'Done', color: 'var(--success)' },
		{ value: 'rejected', label: 'Rejected', color: 'var(--danger)' }
	];

	function statusColor(status: FeatureStatus): string {
		return STATUS_FLOW.find(s => s.value === status)?.color || 'var(--text-muted)';
	}

	function scopeLabel(scope: FeatureScope): string {
		return SCOPES.find(s => s.value === scope)?.label || scope;
	}

	let filtered = $derived.by(() => {
		let result = requests;
		if (filterStatus) result = result.filter(r => r.status === filterStatus);
		if (filterScope) result = result.filter(r => r.scope === filterScope);
		if (search) {
			const q = search.toLowerCase();
			result = result.filter(r =>
				r.title.toLowerCase().includes(q) || r.goal.toLowerCase().includes(q) || r.details.toLowerCase().includes(q)
			);
		}
		return result.sort((a, b) => a.priority - b.priority);
	});

	async function refresh() {
		const res = await fetch('/api/keeper');
		const result = await res.json();
		requests = result.requests;
		stats = result.stats;
	}

	async function createRequest() {
		await fetch('/api/keeper', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ title: formTitle, goal: formGoal, scope: formScope, details: formDetails })
		});
		clearForm();
		await refresh();
	}

	async function updateStatus(id: string, status: FeatureStatus) {
		await fetch('/api/keeper', {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ id, status })
		});
		await refresh();
	}

	async function deleteReq(id: string) {
		await fetch('/api/keeper', {
			method: 'DELETE',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ id })
		});
		await refresh();
	}

	function clearForm() {
		showForm = false;
		editingId = null;
		formTitle = ''; formGoal = ''; formScope = 'feature'; formDetails = '';
	}

	function startEdit(r: FeatureRequest) {
		editingId = r.id;
		formTitle = r.title;
		formGoal = r.goal;
		formScope = r.scope;
		formDetails = r.details;
		showForm = true;
	}

	async function saveEdit() {
		if (!editingId) return;
		await fetch('/api/keeper', {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ id: editingId, title: formTitle, goal: formGoal, scope: formScope, details: formDetails })
		});
		clearForm();
		await refresh();
	}

	function formatDate(iso: string): string {
		return new Date(iso).toLocaleDateString();
	}

	// Confirm delete
	let confirmingDelete = $state<string | null>(null);
	let confirmTimer: ReturnType<typeof setTimeout> | null = null;

	function requestDelete(id: string) {
		if (confirmTimer) clearTimeout(confirmTimer);
		confirmingDelete = id;
		confirmTimer = setTimeout(() => { confirmingDelete = null; }, 3000);
	}

	async function confirmDelete(id: string) {
		confirmingDelete = null;
		await deleteReq(id);
	}
</script>

<svelte:head>
	<title>Keeper | Home Server</title>
</svelte:head>

<div class="header">
	<h2>Claude Keeper</h2>
	<div class="controls">
		<button class="btn" onclick={refresh}>Refresh</button>
		<button class="btn btn-accent" onclick={() => { showForm = !showForm; if (!showForm) clearForm(); }}>
			{showForm ? 'Cancel' : '+ New Request'}
		</button>
	</div>
</div>

<!-- Stats bar -->
<div class="stats-bar">
	{#each STATUS_FLOW as s}
		<button
			class="stat-chip"
			class:active={filterStatus === s.value}
			style="--chip-color: {s.color}"
			onclick={() => (filterStatus = filterStatus === s.value ? '' : s.value)}
		>
			<span class="stat-dot" style="background: {s.color}"></span>
			{s.label}
			<span class="stat-count">{stats[s.value] || 0}</span>
		</button>
	{/each}
</div>

<!-- Search + scope filter -->
{#if requests.length > 0}
	<div class="filter-bar">
		<input type="text" class="search-input" placeholder="Search requests..." bind:value={search} />
		<select class="scope-filter" bind:value={filterScope}>
			<option value="">All scopes</option>
			{#each SCOPES as s}
				<option value={s.value}>{s.label}</option>
			{/each}
		</select>
	</div>
{/if}

<!-- Create / Edit form -->
{#if showForm}
	<div class="form-card">
		<h3>{editingId ? 'Edit Request' : 'New Feature Request'}</h3>

		<div class="form-grid">
			<label>
				<span>Title</span>
				<input type="text" bind:value={formTitle} placeholder="Short description of what you want" />
			</label>

			<label>
				<span>Goal</span>
				<textarea bind:value={formGoal} rows="2" placeholder="What should be achieved? What's the end state?"></textarea>
			</label>

			<div class="scope-section">
				<span class="form-label">Scope</span>
				<div class="scope-grid">
					{#each SCOPES as s}
						<button
							class="scope-btn"
							class:active={formScope === s.value}
							onclick={() => (formScope = s.value)}
						>
							<strong>{s.label}</strong>
							<span>{s.desc}</span>
						</button>
					{/each}
				</div>
			</div>

			<label>
				<span>Details (optional)</span>
				<textarea bind:value={formDetails} rows="3" placeholder="Constraints, references, file paths, technical notes..."></textarea>
			</label>
		</div>

		<div class="form-actions">
			{#if editingId}
				<button class="btn btn-primary" onclick={saveEdit} disabled={!formTitle || !formGoal}>Save Changes</button>
			{:else}
				<button class="btn btn-primary" onclick={createRequest} disabled={!formTitle || !formGoal}>Create Request</button>
			{/if}
			<button class="btn" onclick={clearForm}>Cancel</button>
		</div>
	</div>
{/if}

<!-- Request list -->
{#if filtered.length === 0 && !showForm}
	<p class="empty">
		{requests.length === 0
			? 'No feature requests yet. Click "+ New Request" to submit one.'
			: 'No requests match your filters.'}
	</p>
{:else}
	<div class="request-list">
		{#each filtered as req}
			<div class="request-card" class:done={req.status === 'done'} class:rejected={req.status === 'rejected'}>
				<div class="request-top">
					<div class="request-info">
						<div class="request-title-row">
							<span class="request-status-dot" style="background: {statusColor(req.status)}"></span>
							<h3>{req.title}</h3>
							<span class="scope-badge">{scopeLabel(req.scope)}</span>
						</div>
						<p class="request-goal">{req.goal}</p>
						{#if req.details}
							<p class="request-details">{req.details}</p>
						{/if}
						<div class="request-meta">
							<span>Created {formatDate(req.createdAt)}</span>
							{#if req.completedAt}
								<span>Completed {formatDate(req.completedAt)}</span>
							{/if}
						</div>
					</div>
					<div class="request-actions">
						<!-- Status workflow buttons -->
						{#if req.status === 'backlog'}
							<button class="btn btn-sm" onclick={() => updateStatus(req.id, 'ready')}>Mark Ready</button>
						{:else if req.status === 'ready'}
							<button class="btn btn-sm" onclick={() => updateStatus(req.id, 'in-progress')}>Start</button>
						{:else if req.status === 'in-progress'}
							<button class="btn btn-sm" onclick={() => updateStatus(req.id, 'review')}>To Review</button>
						{:else if req.status === 'review'}
							<button class="btn btn-sm btn-success" onclick={() => updateStatus(req.id, 'done')}>Accept</button>
							<button class="btn btn-sm" onclick={() => updateStatus(req.id, 'ready')}>Reject</button>
						{/if}
						<button class="btn btn-sm" onclick={() => startEdit(req)} title="Edit">Edit</button>
						{#if confirmingDelete === req.id}
							<button class="btn btn-sm btn-confirm" onclick={() => confirmDelete(req.id)}>sure?</button>
						{:else}
							<button class="btn btn-sm btn-danger" onclick={() => requestDelete(req.id)}>✕</button>
						{/if}
					</div>
				</div>
				{#if req.result}
					<div class="request-result">
						<span class="result-label">Result</span>
						<p>{req.result}</p>
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
	.btn { padding: 6px 14px; font-size: 0.8rem; border-radius: 6px; border: 1px solid var(--border, #30363d); background: var(--btn-bg, #21262d); color: var(--text-secondary, #c9d1d9); cursor: pointer; font-family: inherit; }
	.btn:hover:not(:disabled) { border-color: var(--accent, #58a6ff); }
	.btn:disabled { opacity: 0.5; cursor: default; }
	.btn-sm { padding: 4px 10px; font-size: 0.75rem; }
	.btn-accent { border-color: var(--accent, #58a6ff); color: var(--accent, #58a6ff); }
	.btn-primary { background: var(--success, #238636); border-color: var(--success, #2ea043); color: #fff; }
	.btn-primary:hover:not(:disabled) { filter: brightness(1.15); }
	.btn-success { background: var(--success-bg); border-color: var(--success); color: var(--success); }
	.btn-danger:hover { border-color: var(--danger, #f85149); color: var(--danger, #f85149); }
	.btn-confirm { border-color: var(--danger); background: var(--danger-bg); color: var(--danger); animation: pulse 0.6s ease-in-out infinite alternate; }
	@keyframes pulse { from { opacity: 0.7; } to { opacity: 1; } }

	/* Stats bar */
	.stats-bar { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 14px; }
	.stat-chip { display: flex; align-items: center; gap: 6px; padding: 5px 12px; font-size: 0.75rem; border-radius: 16px; border: 1px solid var(--border, #30363d); background: var(--bg-secondary, #161b22); color: var(--text-muted, #8b949e); cursor: pointer; font-family: inherit; transition: all 0.15s; }
	.stat-chip:hover { border-color: var(--chip-color); }
	.stat-chip.active { border-color: var(--chip-color); background: color-mix(in srgb, var(--chip-color) 10%, transparent); color: var(--chip-color); }
	.stat-dot { width: 6px; height: 6px; border-radius: 50%; }
	.stat-count { font-weight: 600; font-family: 'JetBrains Mono', monospace; }

	/* Filter bar */
	.filter-bar { display: flex; gap: 8px; margin-bottom: 14px; }
	.search-input { flex: 1; padding: 7px 12px; font-size: 0.8rem; border-radius: 6px; border: 1px solid var(--border, #30363d); background: var(--input-bg, #0d1117); color: var(--text-primary, #e1e4e8); font-family: inherit; }
	.search-input:focus { outline: none; border-color: var(--accent, #58a6ff); }
	.scope-filter { padding: 7px 12px; font-size: 0.8rem; border-radius: 6px; border: 1px solid var(--border); background: var(--btn-bg); color: var(--text-primary); font-family: inherit; }

	/* Form */
	.form-card { background: var(--bg-secondary, #161b22); border: 1px solid var(--border, #30363d); border-radius: 8px; padding: 20px; margin-bottom: 16px; }
	.form-card h3 { font-size: 1rem; margin-bottom: 14px; }
	.form-grid { display: flex; flex-direction: column; gap: 14px; }
	.form-grid label { display: flex; flex-direction: column; gap: 4px; }
	.form-grid label span, .form-label { font-size: 0.75rem; color: var(--text-muted, #8b949e); text-transform: uppercase; letter-spacing: 0.03em; }
	.form-grid input, .form-grid textarea { padding: 8px 12px; font-size: 0.85rem; border-radius: 6px; border: 1px solid var(--border, #30363d); background: var(--input-bg, #0d1117); color: var(--text-primary, #e1e4e8); font-family: inherit; }
	.form-grid input:focus, .form-grid textarea:focus { outline: none; border-color: var(--accent, #58a6ff); }
	.form-actions { display: flex; gap: 8px; margin-top: 14px; }

	/* Scope selector */
	.scope-section { display: flex; flex-direction: column; gap: 6px; }
	.scope-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 6px; }
	.scope-btn { text-align: left; padding: 8px 12px; border-radius: 6px; border: 1px solid var(--border, #30363d); background: var(--bg-inset, #0d1117); color: var(--text-secondary, #c9d1d9); cursor: pointer; font-family: inherit; transition: border-color 0.15s; }
	.scope-btn:hover { border-color: var(--accent, #58a6ff); }
	.scope-btn.active { border-color: var(--accent, #58a6ff); background: var(--accent-bg); }
	.scope-btn strong { display: block; font-size: 0.8rem; }
	.scope-btn span { font-size: 0.65rem; color: var(--text-muted, #8b949e); }

	/* Request list */
	.empty { color: var(--text-muted, #8b949e); text-align: center; padding: 40px; }
	.request-list { display: flex; flex-direction: column; gap: 10px; }
	.request-card { background: var(--bg-secondary, #161b22); border: 1px solid var(--border, #30363d); border-radius: 8px; padding: 14px 16px; transition: border-color 0.15s; }
	.request-card:hover { border-color: var(--border, #484f58); }
	.request-card.done { opacity: 0.6; }
	.request-card.rejected { opacity: 0.4; }

	.request-top { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; }
	.request-info { flex: 1; min-width: 0; }
	.request-title-row { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; }
	.request-status-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
	.request-title-row h3 { font-size: 0.95rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
	.scope-badge { font-size: 0.6rem; padding: 2px 8px; border-radius: 10px; background: var(--bg-hover, #1f2937); color: var(--text-muted, #8b949e); white-space: nowrap; flex-shrink: 0; }
	.request-goal { font-size: 0.8rem; color: var(--text-secondary, #c9d1d9); margin-bottom: 4px; }
	.request-details { font-size: 0.75rem; color: var(--text-muted, #8b949e); margin-bottom: 4px; }
	.request-meta { font-size: 0.65rem; color: var(--text-faint, #484f58); display: flex; gap: 12px; }
	.request-actions { display: flex; flex-wrap: wrap; gap: 4px; flex-shrink: 0; }

	.request-result { margin-top: 10px; padding-top: 8px; border-top: 1px solid var(--border-subtle, #21262d); }
	.result-label { font-size: 0.65rem; color: var(--text-faint, #484f58); text-transform: uppercase; letter-spacing: 0.03em; }
	.request-result p { font-size: 0.8rem; color: var(--text-secondary, #c9d1d9); margin-top: 4px; }

	@media (max-width: 640px) {
		.request-top { flex-direction: column; }
		.request-actions { width: 100%; }
		.scope-grid { grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); }
	}
</style>
