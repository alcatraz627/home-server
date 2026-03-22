<script lang="ts">
  import type { PageData } from './$types';
  import type { BackupStatus, BackupConfig } from '$lib/server/backups';
  import { toast } from '$lib/toast';
  import EmptyState from '$lib/components/EmptyState.svelte';
  import CronBuilder from '$lib/components/CronBuilder.svelte';
  import FileBrowser from '$lib/components/FileBrowser.svelte';

  let { data } = $props<{ data: PageData }>();
  // svelte-ignore state_referenced_locally
  let statuses = $state<BackupStatus[]>(data.statuses);
  // svelte-ignore state_referenced_locally
  const rsyncAvailable = data.rsyncAvailable;

  // New / edit backup form
  let showForm = $state(false);
  let editingId = $state<string | null>(null);
  let formName = $state('');
  let formSource = $state('');
  let formDest = $state('');
  let formExcludes = $state('');
  let formSchedule = $state('');

  // Exclude tag management
  let excludeInput = $state('');
  let excludeList = $derived(
    formExcludes
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean),
  );

  const COMMON_EXCLUDES = ['.DS_Store', '.Trash', '.cache', 'node_modules', '.git', '.thumbnails', '*.tmp', '*.log'];

  function addExclude(val: string) {
    const items = new Set(excludeList);
    items.add(val);
    formExcludes = [...items].join('\n');
    excludeInput = '';
  }

  function removeExclude(val: string) {
    formExcludes = excludeList.filter((e) => e !== val).join('\n');
  }

  // Backup type detection
  let backupType = $derived.by(() => {
    if (formSource.includes('@') || formSource.includes(':')) return 'remote-source';
    if (formDest.includes('@') || formDest.includes(':')) return 'remote-dest';
    return 'local';
  });

  let backupTypeLabel = $derived(
    backupType === 'remote-source'
      ? 'Remote → Local'
      : backupType === 'remote-dest'
        ? 'Local → Remote'
        : 'Local → Local',
  );

  let estimatedCommand = $derived(
    `rsync -avz${excludeList.map((e) => ` --exclude='${e}'`).join('')} "${formSource}" "${formDest}"`,
  );

  // Running state
  let runningIds = $state<Set<string>>(new Set());

  // Delete confirm state: maps configId -> timeout handle
  let deleteConfirm = $state<Set<string>>(new Set());
  let deleteTimers = new Map<string, ReturnType<typeof setTimeout>>();

  async function refresh() {
    const res = await fetch('/api/backups');
    const result = await res.json();
    statuses = result.statuses;
  }

  function openNewForm() {
    editingId = null;
    formName = '';
    formSource = '';
    formDest = '';
    formExcludes = '';
    formSchedule = '';
    showForm = true;
  }

  function openEditForm(config: BackupConfig) {
    editingId = config.id;
    formName = config.name;
    formSource = config.sourcePath;
    formDest = config.destPath;
    formExcludes = config.excludes.join('\n');
    formSchedule = config.schedule ?? '';
    showForm = true;
    // Scroll form into view
    setTimeout(() => {
      document.querySelector('.form-card')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
  }

  function cancelForm() {
    showForm = false;
    editingId = null;
    formName = '';
    formSource = '';
    formDest = '';
    formExcludes = '';
    formSchedule = '';
  }

  async function submitForm() {
    if (editingId) {
      await updateBackup(editingId);
    } else {
      await createBackup();
    }
  }

  async function createBackup() {
    try {
      const config = {
        name: formName,
        sourcePath: formSource,
        destPath: formDest,
        excludes: formExcludes
          .split('\n')
          .map((s) => s.trim())
          .filter(Boolean),
        schedule: formSchedule || null,
      };
      const res = await fetch('/api/backups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      if (!res.ok) throw new Error('Failed to create backup');
      cancelForm();
      toast.success(`Backup "${config.name}" created`);
      await refresh();
    } catch (e: any) {
      toast.error(e.message || 'Failed to create backup');
    }
  }

  async function updateBackup(id: string) {
    try {
      const config = {
        id,
        name: formName,
        sourcePath: formSource,
        destPath: formDest,
        excludes: formExcludes
          .split('\n')
          .map((s) => s.trim())
          .filter(Boolean),
        schedule: formSchedule || null,
        enabled: true,
      };
      const res = await fetch('/api/backups', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      if (!res.ok) throw new Error('Failed to update backup');
      cancelForm();
      toast.success(`Backup "${config.name}" updated`);
      await refresh();
    } catch (e: any) {
      toast.error(e.message || 'Failed to update backup');
    }
  }

  async function triggerBackup(configId: string) {
    runningIds.add(configId);
    runningIds = new Set(runningIds);
    const config = statuses.find((s) => s.config.id === configId)?.config;
    toast.info(`Backup "${config?.name || configId}" started`, { key: `backup-${configId}` });
    await fetch('/api/backups', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ configId }),
    });
    // Poll for completion
    const poll = setInterval(async () => {
      await refresh();
      const status = statuses.find((s) => s.config.id === configId);
      if (status?.lastRun?.status !== 'running') {
        clearInterval(poll);
        runningIds.delete(configId);
        runningIds = new Set(runningIds);
        if (status?.lastRun?.status === 'success') {
          toast.success(`Backup "${config?.name || configId}" completed`);
        } else if (status?.lastRun?.status === 'failed') {
          toast.error(`Backup "${config?.name || configId}" failed`);
        }
      }
    }, 2000);
  }

  function requestDelete(configId: string) {
    if (deleteConfirm.has(configId)) {
      // Second click — confirmed
      confirmDelete(configId);
    } else {
      // First click — arm the confirm state
      deleteConfirm.add(configId);
      deleteConfirm = new Set(deleteConfirm);
      const timer = setTimeout(() => {
        deleteConfirm.delete(configId);
        deleteConfirm = new Set(deleteConfirm);
        deleteTimers.delete(configId);
      }, 3000);
      deleteTimers.set(configId, timer);
    }
  }

  async function confirmDelete(configId: string) {
    // Clear dismiss timer
    const timer = deleteTimers.get(configId);
    if (timer) {
      clearTimeout(timer);
      deleteTimers.delete(configId);
    }
    deleteConfirm.delete(configId);
    deleteConfirm = new Set(deleteConfirm);

    const name = statuses.find((s) => s.config.id === configId)?.config.name ?? configId;
    try {
      const res = await fetch('/api/backups', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: configId }),
      });
      if (!res.ok) throw new Error('Failed to delete backup');
      // If currently editing this config, close form
      if (editingId === configId) cancelForm();
      toast.success(`Backup "${name}" deleted`);
      await refresh();
    } catch (e: any) {
      toast.error(e.message || 'Failed to delete backup');
    }
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
    if (status === 'success') return 'var(--success)';
    if (status === 'failed') return 'var(--danger)';
    return 'var(--warning)';
  }
</script>

<svelte:head>
  <title>Backups | Home Server</title>
</svelte:head>

<div class="header">
  <h2>Backups</h2>
  <div class="controls">
    <button class="btn" onclick={refresh}>Refresh</button>
    <button class="btn" onclick={() => (showForm ? cancelForm() : openNewForm())}>
      {showForm ? 'Cancel' : 'New Backup'}
    </button>
  </div>
</div>

{#if !rsyncAvailable}
  <div class="warning">rsync is not installed. Backups require rsync to be available on this machine.</div>
{/if}

{#if showForm}
  <div class="form-card">
    <!-- Step 1: Name -->
    <div class="form-name-section">
      <input class="form-name-input" type="text" bind:value={formName} placeholder="Backup name..." />
      <span class="form-name-hint">{editingId ? 'Editing' : 'New'} backup configuration</span>
    </div>

    <!-- Step 2: Source → Destination Visual Diagram -->
    <div class="path-diagram">
      <div class="path-card path-source">
        <div class="path-card-header">
          <span class="path-card-icon">📂</span>
          <span class="path-card-label">Source</span>
          {#if backupType === 'remote-source'}
            <span class="path-badge path-remote">Remote</span>
          {:else}
            <span class="path-badge path-local">Local</span>
          {/if}
        </div>
        <div class="path-input-row">
          <input
            class="path-input"
            type="text"
            bind:value={formSource}
            placeholder="/path/to/source/ or user@host:/path"
          />
          <FileBrowser value={formSource} onselect={(p) => (formSource = p)} label="📁" />
        </div>
      </div>

      <div class="path-arrow">
        <div class="path-arrow-line"></div>
        <span class="path-arrow-icon">→</span>
        <div class="path-arrow-line"></div>
      </div>

      <div class="path-card path-dest">
        <div class="path-card-header">
          <span class="path-card-icon">💾</span>
          <span class="path-card-label">Destination</span>
          {#if backupType === 'remote-dest'}
            <span class="path-badge path-remote">Remote</span>
          {:else}
            <span class="path-badge path-local">Local</span>
          {/if}
        </div>
        <div class="path-input-row">
          <input class="path-input" type="text" bind:value={formDest} placeholder="/path/to/backup/" />
          <FileBrowser value={formDest} onselect={(p) => (formDest = p)} label="📁" />
        </div>
      </div>
    </div>

    <!-- Step 3: Schedule with CronBuilder -->
    <div class="form-section">
      <span class="form-section-label">Schedule</span>
      <CronBuilder value={formSchedule || null} onchange={(v) => (formSchedule = v ?? '')} />
    </div>

    <!-- Step 4: Excludes with tag-style input -->
    <div class="form-section">
      <span class="form-section-label">Exclude Patterns</span>
      <div class="exclude-tags">
        {#each excludeList as tag}
          <span class="exclude-tag">
            {tag}
            <button class="exclude-tag-remove" onclick={() => removeExclude(tag)}>×</button>
          </span>
        {/each}
        <input
          class="exclude-input"
          type="text"
          bind:value={excludeInput}
          placeholder="Add pattern..."
          onkeydown={(e) => {
            if (e.key === 'Enter' && excludeInput.trim()) {
              e.preventDefault();
              addExclude(excludeInput.trim());
            }
          }}
        />
      </div>
      <div class="exclude-suggestions">
        {#each COMMON_EXCLUDES.filter((e) => !excludeList.includes(e)) as suggestion}
          <button class="exclude-suggestion" onclick={() => addExclude(suggestion)}>{suggestion}</button>
        {/each}
      </div>
    </div>

    <!-- Step 5: Summary Footer -->
    <div class="form-summary">
      <div class="summary-row">
        <span class="summary-label">Type</span>
        <span class="summary-value summary-type">{backupTypeLabel}</span>
      </div>
      <div class="summary-row">
        <span class="summary-label">Engine</span>
        <span class="summary-value">rsync -avz</span>
      </div>
      {#if excludeList.length > 0}
        <div class="summary-row">
          <span class="summary-label">Excludes</span>
          <span class="summary-value">{excludeList.length} patterns</span>
        </div>
      {/if}
      {#if formSchedule}
        <div class="summary-row">
          <span class="summary-label">Schedule</span>
          <span class="summary-value">{formSchedule}</span>
        </div>
      {/if}
      <details class="summary-command">
        <summary>Preview command</summary>
        <code>{estimatedCommand}</code>
      </details>
    </div>

    <!-- Actions -->
    <div class="form-actions">
      <button class="btn btn-primary" onclick={submitForm} disabled={!formName || !formSource || !formDest}>
        {editingId ? 'Save Changes' : 'Create Backup'}
      </button>
      <button class="btn" onclick={cancelForm}>Cancel</button>
    </div>
  </div>
{/if}

{#if statuses.length === 0 && !showForm}
  <EmptyState
    icon="⟲"
    title="No backup configurations"
    hint="Set up automated rsync backups between directories or devices"
    actionLabel="New Backup"
    onaction={openNewForm}
  />
{:else}
  <div class="backup-list">
    {#each statuses as status}
      <div class="backup-card" class:editing={editingId === status.config.id}>
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
          <div class="card-actions">
            <button
              class="btn"
              onclick={() => triggerBackup(status.config.id)}
              disabled={runningIds.has(status.config.id)}
            >
              {runningIds.has(status.config.id) ? 'Running...' : 'Run Now'}
            </button>
            <button
              class="btn btn-edit"
              onclick={() => openEditForm(status.config)}
              disabled={runningIds.has(status.config.id)}
            >
              Edit
            </button>
            <button
              class="btn btn-delete"
              class:btn-delete-confirm={deleteConfirm.has(status.config.id)}
              onclick={() => requestDelete(status.config.id)}
              disabled={runningIds.has(status.config.id)}
            >
              {deleteConfirm.has(status.config.id) ? 'Sure?' : 'Delete'}
            </button>
          </div>
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
            <span class="run-status" style="color: var(--text-muted)">Never run</span>
          </div>
        {/if}
      </div>
    {/each}
  </div>
{/if}

<style>
  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 16px;
  }
  h2 {
    font-size: 1.3rem;
  }
  .controls {
    display: flex;
    gap: 8px;
  }
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
  .btn:hover:not(:disabled) {
    border-color: var(--accent);
  }
  .btn:disabled {
    opacity: 0.5;
    cursor: default;
  }
  .btn-primary {
    background: var(--success);
    border-color: var(--success);
    color: var(--bg-primary);
    margin-top: 12px;
  }
  .btn-primary:hover:not(:disabled) {
    filter: brightness(1.15);
  }

  .btn-edit {
    color: var(--accent);
    border-color: var(--border);
  }
  .btn-edit:hover:not(:disabled) {
    border-color: var(--accent);
    background: var(--accent-subtle, var(--bg-tertiary));
  }

  .btn-delete {
    color: var(--danger);
    border-color: var(--border);
  }
  .btn-delete:hover:not(:disabled) {
    border-color: var(--danger);
  }
  .btn-delete-confirm {
    background: var(--danger);
    border-color: var(--danger);
    color: var(--bg-primary);
  }
  .btn-delete-confirm:hover:not(:disabled) {
    filter: brightness(1.1);
  }

  .warning {
    background: var(--warning-bg);
    border: 1px solid var(--warning);
    border-radius: 8px;
    padding: 12px 16px;
    color: var(--warning);
    font-size: 0.85rem;
    margin-bottom: 16px;
  }

  .form-card {
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 20px;
    margin-bottom: 16px;
  }
  .form-card h3 {
    font-size: 1rem;
    margin-bottom: 14px;
  }
  .form-grid {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .form-grid label {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .form-grid label span {
    font-size: 0.75rem;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }
  .form-grid input,
  .form-grid textarea {
    padding: 8px 12px;
    font-size: 0.85rem;
    border-radius: 6px;
    border: 1px solid var(--border);
    background: var(--input-bg);
    color: var(--text-primary);
    font-family: inherit;
  }
  .form-grid input:focus,
  .form-grid textarea:focus {
    outline: none;
    border-color: var(--accent);
  }

  .empty {
    color: var(--text-muted);
    text-align: center;
    padding: 40px;
  }

  .backup-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .backup-card {
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 16px;
    transition: border-color 0.15s;
  }
  .backup-card.editing {
    border-color: var(--accent);
  }
  .backup-top {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 12px;
  }
  .backup-top h3 {
    font-size: 1rem;
    margin-bottom: 6px;
  }
  .backup-paths {
    font-size: 0.8rem;
    color: var(--text-muted);
    margin-bottom: 2px;
  }
  .backup-paths code {
    font-size: 0.8rem;
    color: var(--text-secondary);
  }
  .path-label {
    display: inline-block;
    width: 36px;
  }
  .backup-schedule {
    font-size: 0.75rem;
    color: var(--accent);
    margin-bottom: 2px;
  }
  .backup-schedule code {
    font-size: 0.75rem;
  }
  .backup-excludes {
    font-size: 0.7rem;
    color: var(--text-faint);
    margin-top: 4px;
  }

  .card-actions {
    display: flex;
    gap: 6px;
    flex-shrink: 0;
    align-items: flex-start;
    flex-wrap: wrap;
    justify-content: flex-end;
  }

  .last-run {
    margin-top: 12px;
    padding-top: 10px;
    border-top: 1px solid var(--border-subtle);
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
  }
  .run-status {
    font-size: 0.8rem;
    font-weight: 500;
  }
  .run-time {
    font-size: 0.75rem;
    color: var(--text-muted);
  }
  .run-stats {
    font-size: 0.75rem;
    color: var(--text-muted);
  }
  .run-error {
    margin-top: 8px;
    width: 100%;
  }
  .run-error summary {
    font-size: 0.75rem;
    color: var(--danger);
    cursor: pointer;
  }
  .run-error pre {
    font-size: 0.7rem;
    color: var(--text-muted);
    background: var(--code-bg);
    padding: 8px;
    border-radius: 4px;
    overflow-x: auto;
    margin-top: 4px;
  }

  /* ── Creative Form Styles ──────────────────────────────── */

  .form-name-section {
    margin-bottom: 20px;
  }

  .form-name-input {
    width: 100%;
    padding: 12px 16px;
    font-size: 1.2rem;
    font-weight: 600;
    font-family: 'Space Grotesk', 'Inter', sans-serif;
    border: 2px solid var(--border);
    border-radius: 10px;
    background: var(--bg-inset);
    color: var(--text-primary);
    transition: border-color 0.2s;
  }

  .form-name-input:focus {
    outline: none;
    border-color: var(--accent);
  }

  .form-name-input::placeholder {
    color: var(--text-faint);
    font-weight: 400;
  }

  .form-name-hint {
    display: block;
    margin-top: 4px;
    font-size: 0.7rem;
    color: var(--text-faint);
  }

  /* Path Diagram — Source → Destination */
  .path-diagram {
    display: flex;
    align-items: stretch;
    gap: 0;
    margin-bottom: 20px;
  }

  .path-card {
    flex: 1;
    padding: 14px;
    border-radius: 10px;
    border: 2px solid var(--border);
    background: var(--bg-inset);
    transition: border-color 0.2s;
  }

  .path-card:focus-within {
    border-color: var(--accent);
  }

  .path-source {
    border-color: var(--cyan);
    border-top-right-radius: 0;
    border-bottom-right-radius: 0;
  }

  .path-dest {
    border-color: var(--success);
    border-top-left-radius: 0;
    border-bottom-left-radius: 0;
  }

  .path-card-header {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 8px;
  }

  .path-card-icon {
    font-size: 1.1rem;
  }

  .path-card-label {
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--text-muted);
  }

  .path-badge {
    font-size: 0.55rem;
    padding: 1px 6px;
    border-radius: 8px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }

  .path-local {
    background: var(--success-bg);
    color: var(--success);
  }

  .path-remote {
    background: var(--warning-bg);
    color: var(--warning);
  }

  .path-input-row {
    display: flex;
    gap: 6px;
    align-items: center;
  }

  .path-input {
    flex: 1;
    padding: 6px 10px;
    font-size: 0.8rem;
    border-radius: 6px;
    border: 1px solid var(--border);
    background: var(--input-bg);
    color: var(--text-primary);
    font-family: 'JetBrains Mono', monospace;
  }

  .path-input:focus {
    outline: none;
    border-color: var(--accent);
  }

  /* Arrow between source and dest */
  .path-arrow {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 0 4px;
    min-width: 36px;
  }

  .path-arrow-line {
    width: 2px;
    flex: 1;
    background: linear-gradient(to bottom, var(--cyan), var(--success));
    min-height: 12px;
  }

  .path-arrow-icon {
    font-size: 1.2rem;
    color: var(--accent);
    font-weight: 700;
    padding: 4px 0;
  }

  /* Form sections */
  .form-section {
    margin-bottom: 16px;
  }

  .form-section-label {
    display: block;
    font-size: 0.7rem;
    font-weight: 600;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.04em;
    margin-bottom: 8px;
  }

  /* Exclude tags */
  .exclude-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    padding: 8px 10px;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--bg-inset);
    min-height: 40px;
    align-items: center;
  }

  .exclude-tag {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 2px 8px;
    font-size: 0.7rem;
    border-radius: 6px;
    background: var(--bg-hover);
    color: var(--text-primary);
    font-family: 'JetBrains Mono', monospace;
  }

  .exclude-tag-remove {
    background: none;
    border: none;
    color: var(--text-faint);
    cursor: pointer;
    font-size: 0.8rem;
    padding: 0 2px;
    line-height: 1;
  }

  .exclude-tag-remove:hover {
    color: var(--danger);
  }

  .exclude-input {
    flex: 1;
    min-width: 100px;
    border: none;
    background: none;
    color: var(--text-primary);
    font-size: 0.75rem;
    font-family: 'JetBrains Mono', monospace;
    outline: none;
    padding: 2px 4px;
  }

  .exclude-input::placeholder {
    color: var(--text-faint);
  }

  .exclude-suggestions {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    margin-top: 6px;
  }

  .exclude-suggestion {
    padding: 2px 8px;
    font-size: 0.6rem;
    border-radius: 10px;
    border: 1px dashed var(--border);
    background: none;
    color: var(--text-faint);
    cursor: pointer;
    font-family: 'JetBrains Mono', monospace;
    transition: all 0.15s;
  }

  .exclude-suggestion:hover {
    border-color: var(--accent);
    color: var(--accent);
    background: var(--accent-bg);
  }

  /* Summary footer */
  .form-summary {
    margin-top: 16px;
    padding: 12px 14px;
    border-radius: 8px;
    background: var(--bg-inset);
    border: 1px solid var(--border);
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .summary-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 0.75rem;
  }

  .summary-label {
    color: var(--text-faint);
    text-transform: uppercase;
    font-size: 0.65rem;
    letter-spacing: 0.04em;
  }

  .summary-value {
    color: var(--text-secondary);
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.7rem;
  }

  .summary-type {
    color: var(--accent);
    font-weight: 600;
  }

  .summary-command {
    margin-top: 4px;
    font-size: 0.7rem;
  }

  .summary-command summary {
    color: var(--text-faint);
    cursor: pointer;
    font-size: 0.65rem;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .summary-command code {
    display: block;
    margin-top: 4px;
    padding: 8px 10px;
    background: var(--code-bg);
    border-radius: 6px;
    font-size: 0.65rem;
    color: var(--text-muted);
    word-break: break-all;
    white-space: pre-wrap;
  }

  .form-actions {
    display: flex;
    gap: 8px;
    margin-top: 16px;
  }

  @media (max-width: 640px) {
    .path-diagram {
      flex-direction: column;
    }

    .path-source {
      border-radius: 10px 10px 0 0;
      border-bottom-right-radius: 0;
    }

    .path-dest {
      border-radius: 0 0 10px 10px;
      border-top-left-radius: 0;
    }

    .path-arrow {
      flex-direction: row;
      min-width: unset;
      padding: 4px 0;
    }

    .path-arrow-line {
      width: auto;
      height: 2px;
      min-height: unset;
      flex: 1;
    }

    .path-arrow-icon {
      transform: rotate(90deg);
    }
  }
</style>
