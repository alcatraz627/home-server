<script lang="ts">
  import type { PageData } from './$types';
  import type { BackupStatus, BackupConfig } from '$lib/server/backups';
  import { toast } from '$lib/toast';

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
    toast.info(`Backup "${config?.name || configId}" started`);
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
    <h3>{editingId ? 'Edit Backup Configuration' : 'New Backup Configuration'}</h3>
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
    <button class="btn btn-primary" onclick={submitForm} disabled={!formName || !formSource || !formDest}>
      {editingId ? 'Save Changes' : 'Create'}
    </button>
  </div>
{/if}

{#if statuses.length === 0 && !showForm}
  <p class="empty">No backup configurations yet. Click "New Backup" to set one up.</p>
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
</style>
