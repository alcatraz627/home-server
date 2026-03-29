<script lang="ts">
  import { onMount } from 'svelte';
  import { toast } from '$lib/toast';
  import { createAutoRefresh } from '$lib/auto-refresh.svelte';
  import { getErrorMessage } from '$lib/errors';
  import { useShortcuts } from '$lib/shortcuts';
  import PageHeader from '$lib/components/PageHeader.svelte';
  import { fetchApi } from '$lib/api';
  import Button from '$lib/components/Button.svelte';
  import Badge from '$lib/components/Badge.svelte';
  import Tabs from '$lib/components/Tabs.svelte';
  import SearchInput from '$lib/components/SearchInput.svelte';
  import FilterBar from '$lib/components/FilterBar.svelte';
  import Icon from '$lib/components/Icon.svelte';
  import InfoRow from '$lib/components/InfoRow.svelte';
  import AsyncState from '$lib/components/AsyncState.svelte';

  interface LogEntry {
    timestamp: string;
    level: 'debug' | 'info' | 'warn' | 'error';
    module: string;
    message: string;
    data?: any;
    error?: { message: string; stack?: string };
  }

  interface LogFile {
    name: string;
    size: number;
    modified: string;
  }

  interface LogStats {
    totalFiles: number;
    totalSize: number;
    oldestEntry: string | null;
    newestEntry: string | null;
    errorCount: number;
    warnCount: number;
  }

  let activeTab = $state('viewer');
  let entries = $state<LogEntry[]>([]);
  let totalEntries = $state(0);
  let hasMore = $state(false);
  let loadingMore = $state(false);
  let files = $state<LogFile[]>([]);
  let stats = $state<LogStats | null>(null);
  let loading = $state(true);
  let previewFile = $state<string | null>(null);
  let previewContent = $state('');
  let previewTotalLines = $state(0);

  async function openPreview(filename: string) {
    previewFile = filename;
    previewContent = 'Loading...';
    try {
      const res = await fetchApi(`/api/logs?action=raw&file=${encodeURIComponent(filename)}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      previewContent = data.content;
      previewTotalLines = data.totalLines;
    } catch {
      previewContent = 'Failed to load file';
    }
  }

  // Filters
  let search = $state('');
  let levelFilter = $state('');
  let moduleFilter = $state('');
  let limit = $state(200);

  // Modules list (derived from entries)
  let modules = $derived([...new Set(entries.map((e) => e.module))].sort());

  async function fetchLogs() {
    loading = true;
    try {
      const params = new URLSearchParams();
      if (levelFilter) params.set('level', levelFilter);
      if (moduleFilter) params.set('module', moduleFilter);
      if (search) params.set('search', search);
      params.set('limit', String(limit));
      params.set('offset', '0');
      const res = await fetchApi(`/api/logs?${params}`);
      const data = await res.json();
      entries = data.entries || [];
      totalEntries = data.total || entries.length;
      hasMore = data.hasMore ?? false;
    } catch (e: unknown) {
      toast.error(getErrorMessage(e, 'Failed to load logs'));
    } finally {
      loading = false;
    }
  }

  async function loadMoreLogs() {
    loadingMore = true;
    try {
      const params = new URLSearchParams();
      if (levelFilter) params.set('level', levelFilter);
      if (moduleFilter) params.set('module', moduleFilter);
      if (search) params.set('search', search);
      params.set('limit', String(limit));
      params.set('offset', String(entries.length));
      const res = await fetchApi(`/api/logs?${params}`);
      const data = await res.json();
      entries = [...entries, ...(data.entries || [])];
      totalEntries = data.total || entries.length;
      hasMore = data.hasMore ?? false;
    } catch (e: unknown) {
      toast.error(getErrorMessage(e, 'Failed to load more logs'));
    } finally {
      loadingMore = false;
    }
  }

  async function fetchFiles() {
    try {
      const res = await fetchApi('/api/logs?action=files');
      const data = await res.json();
      files = data.files || [];
    } catch {}
  }

  async function fetchStats() {
    try {
      const res = await fetchApi('/api/logs?action=stats');
      stats = await res.json();
    } catch {}
  }

  let searchInputEl = $state<HTMLInputElement | undefined>();

  createAutoRefresh(fetchLogs, 10000);

  onMount(() => {
    fetchLogs();
    fetchFiles();
    fetchStats();
    return useShortcuts([
      {
        id: 'logs:refresh',
        page: 'Logs',
        description: 'Refresh logs',
        defaultKey: 'r',
        category: 'Actions',
        handler: fetchLogs,
      },
      {
        id: 'logs:focus-search',
        page: 'Logs',
        description: 'Focus search',
        defaultKey: '/',
        category: 'Navigation',
        handler: () => searchInputEl?.focus(),
      },
    ]);
  });

  function formatTime(iso: string): string {
    const d = new Date(iso);
    return d.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
  }

  function formatBytes(b: number): string {
    if (b < 1024) return `${b} B`;
    if (b < 1048576) return `${(b / 1024).toFixed(1)} KB`;
    return `${(b / 1048576).toFixed(1)} MB`;
  }

  function levelVariant(level: string): 'danger' | 'warning' | 'info' | 'default' {
    if (level === 'error') return 'danger';
    if (level === 'warn') return 'warning';
    if (level === 'info') return 'info';
    return 'default';
  }

  let expandedIdx = $state<number | null>(null);

  function applyFilters() {
    fetchLogs();
  }
</script>

<svelte:head>
  <title>Logs | Home Server</title>
</svelte:head>

<h2 class="page-title">Logs</h2>
<p class="page-desc">View application logs, diagnose errors, and manage log files.</p>

<!-- Stats bar -->
{#if stats}
  <div class="stats-bar">
    <div class="stat-chip">
      <Icon name="file-text" size={14} />
      <span>{stats.totalFiles} files ({formatBytes(stats.totalSize)})</span>
    </div>
    <div class="stat-chip error-chip">
      <Icon name="error" size={14} />
      <span>{stats.errorCount} errors</span>
    </div>
    <div class="stat-chip warn-chip">
      <Icon name="warning" size={14} />
      <span>{stats.warnCount} warnings</span>
    </div>
    {#if stats.newestEntry}
      <div class="stat-chip">
        <Icon name="clock" size={14} />
        <span>Latest: {formatTime(stats.newestEntry)}</span>
      </div>
    {/if}
  </div>
{/if}

<Tabs
  tabs={[
    { id: 'viewer', label: 'Log Viewer' },
    { id: 'files', label: 'Files', count: files.length },
  ]}
  bind:active={activeTab}
  syncHash
/>

{#if activeTab === 'viewer'}
  <!-- Filters -->
  <FilterBar>
    <SearchInput
      bind:value={search}
      bind:inputEl={searchInputEl}
      placeholder="Search logs..."
      debounce={300}
      oninput={applyFilters}
    />
    <select class="filter-select" bind:value={levelFilter} onchange={applyFilters}>
      <option value="">All levels</option>
      <option value="error">Error</option>
      <option value="warn">Warning</option>
      <option value="info">Info</option>
      <option value="debug">Debug</option>
    </select>
    <select class="filter-select" bind:value={moduleFilter} onchange={applyFilters}>
      <option value="">All modules</option>
      {#each modules as mod}
        <option value={mod}>{mod}</option>
      {/each}
    </select>
    <select class="filter-select" bind:value={limit} onchange={applyFilters}>
      <option value={50}>50 entries</option>
      <option value={200}>200 entries</option>
      <option value={500}>500 entries</option>
      <option value={1000}>1000 entries</option>
    </select>
    {#snippet actions()}
      <Button
        icon="refresh"
        size="sm"
        onclick={() => {
          fetchLogs();
          fetchStats();
        }}>Refresh</Button
      >
    {/snippet}
  </FilterBar>

  <!-- Log entries -->
  <AsyncState
    {loading}
    empty={entries.length === 0}
    emptyTitle="No log entries found"
    emptyIcon="file-text"
    emptyHint="No log entries found matching filters."
    loadingVariant="spinner"
  >
    <div class="log-list">
      {#each entries as entry, i}
        <div
          class="log-entry"
          class:expanded={expandedIdx === i}
          class:error={entry.level === 'error'}
          class:warn={entry.level === 'warn'}
          onclick={() => (expandedIdx = expandedIdx === i ? null : i)}
          role="button"
          tabindex="0"
          onkeydown={(e) => e.key === 'Enter' && (expandedIdx = expandedIdx === i ? null : i)}
        >
          <div class="log-row">
            <span class="log-time">{formatTime(entry.timestamp)}</span>
            <Badge variant={levelVariant(entry.level)} size="sm">{entry.level.toUpperCase()}</Badge>
            <span class="log-module">{entry.module}</span>
            <span class="log-message">{entry.message}</span>
          </div>
          {#if expandedIdx === i}
            <div class="log-detail">
              <InfoRow label="Timestamp" value={entry.timestamp} mono />
              <InfoRow label="Module" value={entry.module} />
              {#if entry.data}
                <InfoRow label="Data">
                  <pre class="detail-pre">{JSON.stringify(entry.data, null, 2)}</pre>
                </InfoRow>
              {/if}
              {#if entry.error}
                <InfoRow label="Error">
                  <pre class="detail-pre error-pre">{entry.error.message}{entry.error.stack
                      ? '\n\n' + entry.error.stack
                      : ''}</pre>
                </InfoRow>
              {/if}
            </div>
          {/if}
        </div>
      {/each}
    </div>
    <div class="log-footer">
      <div class="result-count">Showing {entries.length} of {totalEntries} entries</div>
      {#if hasMore}
        <Button size="sm" icon="chevron-down" onclick={loadMoreLogs} disabled={loadingMore}>
          {loadingMore ? 'Loading...' : `Load ${Math.min(limit, totalEntries - entries.length)} more`}
        </Button>
      {/if}
    </div>
  </AsyncState>
{:else if activeTab === 'files'}
  <div class="files-list">
    <Button icon="refresh" size="sm" onclick={fetchFiles}>Refresh</Button>
    {#if files.length === 0}
      <div class="empty-text">No log files found.</div>
    {:else}
      <table class="files-table">
        <thead>
          <tr>
            <th>File</th>
            <th>Size</th>
            <th>Last Modified</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {#each files as file}
            <tr>
              <td class="file-name">{file.name}</td>
              <td>{formatBytes(file.size)}</td>
              <td>{formatTime(file.modified)}</td>
              <td class="file-actions">
                <Button size="xs" onclick={() => openPreview(file.name)}>
                  <Icon name="eye" size={12} /> View
                </Button>
                <a href="/api/logs?action=download&file={encodeURIComponent(file.name)}" class="btn-download" download>
                  <Icon name="download" size={12} />
                </a>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    {/if}
  </div>
{/if}

{#if previewFile}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="preview-overlay" onclick={() => (previewFile = null)} role="presentation">
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <div class="preview-panel" onclick={(e) => e.stopPropagation()} role="dialog" tabindex="-1">
      <div class="preview-header">
        <h3>{previewFile}</h3>
        <span class="preview-meta">{previewTotalLines} lines</span>
        <a href="/api/logs?action=download&file={encodeURIComponent(previewFile)}" class="btn-download" download>
          <Icon name="download" size={14} />
        </a>
        <button class="icon-btn" aria-label="Close preview" onclick={() => (previewFile = null)}
          ><Icon name="close" size={16} /></button
        >
      </div>
      <pre class="preview-content">{previewContent}</pre>
    </div>
  </div>
{/if}

<style>
  .preview-overlay {
    position: fixed;
    inset: 0;
    z-index: 200;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .preview-panel {
    width: 90%;
    max-width: 900px;
    max-height: 85vh;
    display: flex;
    flex-direction: column;
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: 10px;
    overflow: hidden;
  }

  .preview-header {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 16px;
    border-bottom: 1px solid var(--border);
  }

  .preview-header h3 {
    font-size: 0.85rem;
    margin: 0;
    font-family: 'JetBrains Mono', monospace;
  }

  .preview-meta {
    font-size: 0.7rem;
    color: var(--text-faint);
    margin-right: auto;
  }

  .preview-content {
    padding: 16px;
    margin: 0;
    font-size: 0.68rem;
    font-family: 'JetBrains Mono', monospace;
    color: var(--text-secondary);
    overflow: auto;
    flex: 1;
    white-space: pre-wrap;
    word-break: break-all;
    max-height: 70vh;
  }

  .file-actions {
    display: flex;
    gap: 6px;
    align-items: center;
  }

  .btn-download {
    display: flex;
    align-items: center;
    padding: 3px 6px;
    border: 1px solid var(--border);
    border-radius: 4px;
    color: var(--text-muted);
    text-decoration: none;
    transition:
      border-color 0.15s,
      color 0.15s;
  }

  .btn-download:hover {
    border-color: var(--accent);
    color: var(--accent);
  }

  .stats-bar {
    display: flex;
    gap: 12px;
    margin-bottom: 16px;
    flex-wrap: wrap;
  }

  .stat-chip {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 4px 12px;
    border-radius: 20px;
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    font-size: 0.75rem;
    color: var(--text-muted);
  }

  .error-chip {
    border-color: var(--danger);
    color: var(--danger);
  }
  .warn-chip {
    border-color: var(--warning);
    color: var(--warning);
  }

  .filter-select {
    padding: 6px 10px;
    font-size: 0.78rem;
    border-radius: 6px;
    border: 1px solid var(--border);
    background: var(--input-bg);
    color: var(--text-secondary);
    font-family: inherit;
  }

  .empty-text {
    padding: 40px;
    text-align: center;
    color: var(--text-muted);
    font-size: 0.85rem;
  }

  .log-list {
    display: flex;
    flex-direction: column;
    gap: 1px;
    border: 1px solid var(--border);
    border-radius: 8px;
    overflow: hidden;
  }

  .log-entry {
    padding: 8px 14px;
    background: var(--bg-secondary);
    cursor: pointer;
    transition: background 0.1s;
  }

  .log-entry:hover {
    background: var(--bg-hover);
  }

  .log-entry.error {
    border-left: 3px solid var(--danger);
  }

  .log-entry.warn {
    border-left: 3px solid var(--warning);
  }

  .log-row {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 0.78rem;
  }

  .log-time {
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.7rem;
    color: var(--text-faint);
    white-space: nowrap;
    min-width: 130px;
  }

  .log-module {
    font-size: 0.68rem;
    color: var(--accent);
    font-family: 'JetBrains Mono', monospace;
    min-width: 80px;
  }

  .log-message {
    flex: 1;
    color: var(--text-primary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .log-detail {
    margin-top: 8px;
    padding: 10px;
    background: var(--bg-inset);
    border-radius: 6px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .detail-pre {
    background: var(--code-bg);
    padding: 8px 10px;
    border-radius: 4px;
    font-size: 0.7rem;
    font-family: 'JetBrains Mono', monospace;
    color: var(--text-secondary);
    overflow-x: auto;
    max-height: 200px;
    overflow-y: auto;
    margin: 0;
    white-space: pre-wrap;
    word-break: break-word;
  }

  .error-pre {
    color: var(--danger);
  }

  .log-footer {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    padding: 12px;
  }

  .result-count {
    font-size: 0.72rem;
    color: var(--text-faint);
  }

  /* Files tab */
  .files-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .files-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.82rem;
  }

  .files-table th {
    text-align: left;
    padding: 8px 12px;
    background: var(--table-header-bg);
    color: var(--text-muted);
    font-size: 0.72rem;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    border-bottom: 1px solid var(--border);
  }

  .files-table td {
    padding: 8px 12px;
    border-bottom: 1px solid var(--border-subtle);
    color: var(--text-secondary);
  }

  .file-name {
    font-family: 'JetBrains Mono', monospace;
    color: var(--text-primary);
  }

  @media (max-width: 640px) {
    .log-row {
      flex-wrap: wrap;
    }

    .log-time {
      min-width: auto;
      width: 100%;
    }

    .log-module {
      min-width: auto;
    }
  }
</style>
