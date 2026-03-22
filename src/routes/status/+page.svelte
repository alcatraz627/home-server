<script lang="ts">
  import { fetchApi } from '$lib/api';
  import { onMount } from 'svelte';
  import Badge from '$lib/components/Badge.svelte';
  import Button from '$lib/components/Button.svelte';
  import Icon from '$lib/components/Icon.svelte';
  import Card from '$lib/components/Card.svelte';
  import DataChip from '$lib/components/DataChip.svelte';

  interface StorageEntry {
    name: string;
    path: string;
    sizeBytes: number;
    fileCount: number;
  }

  let status = $state<any>(null);
  let health = $state<any>(null);
  let loading = $state(true);

  function formatBytes(b: number): string {
    if (b < 1024) return `${b} B`;
    if (b < 1048576) return `${(b / 1024).toFixed(1)} KB`;
    if (b < 1073741824) return `${(b / 1048576).toFixed(1)} MB`;
    return `${(b / 1073741824).toFixed(2)} GB`;
  }

  async function refresh() {
    loading = true;
    try {
      const [statusRes, healthRes] = await Promise.all([fetchApi('/api/status'), fetchApi('/api/health')]);
      if (statusRes.ok) status = await statusRes.json();
      if (healthRes.ok) health = await healthRes.json();
    } catch {}
    loading = false;
  }

  onMount(refresh);
</script>

<svelte:head>
  <title>App Status | Home Server</title>
</svelte:head>

<div class="status-page">
  <div class="page-header-row">
    <h2 class="page-title">App Status</h2>
    <Button size="sm" onclick={refresh} disabled={loading} {loading}>Refresh</Button>
  </div>
  <p class="page-desc">Server health, resource usage, storage breakdown, and application info.</p>

  {#if status}
    <!-- Health indicator -->
    <div
      class="health-banner"
      class:green={health?.status === 'green'}
      class:yellow={health?.status === 'yellow'}
      class:red={health?.status === 'red'}
    >
      <span class="health-dot-lg"></span>
      <span class="health-label">
        {health?.status === 'green'
          ? 'Healthy'
          : health?.status === 'yellow'
            ? 'Degraded'
            : health?.status === 'red'
              ? 'Unhealthy'
              : 'Checking...'}
      </span>
      {#if health?.latency != null}
        <span class="health-latency">{health.latency}ms</span>
      {/if}
    </div>

    <!-- Version & App Info -->
    <div class="info-grid">
      <Card padding="sm">
        {#snippet header()}<strong>Application</strong>{/snippet}
        <div class="info-rows">
          <div class="info-r"><span class="lbl">Version</span><code>{status.app.version}</code></div>
          <div class="info-r"><span class="lbl">Node.js</span><code>{status.app.nodeVersion}</code></div>
          <div class="info-r"><span class="lbl">PID</span><code>{status.app.pid}</code></div>
          <div class="info-r"><span class="lbl">Pages</span><span>{status.app.pageCount}</span></div>
          <div class="info-r">
            <span class="lbl">Branch</span><code>{status.app.git.branch}</code>{#if status.app.git.dirty}<Badge
                variant="warning"
                size="sm">dirty</Badge
              >{/if}
          </div>
          <div class="info-r"><span class="lbl">Commit</span><code>{status.app.git.commit}</code></div>
        </div>
      </Card>

      <Card padding="sm">
        {#snippet header()}<strong>Server</strong>{/snippet}
        <div class="info-rows">
          <div class="info-r"><span class="lbl">Hostname</span><code>{status.server.hostname}</code></div>
          <div class="info-r">
            <span class="lbl">Platform</span><span>{status.server.platform} / {status.server.arch}</span>
          </div>
          <div class="info-r"><span class="lbl">CPU</span><span>{status.server.cpuModel}</span></div>
          <div class="info-r"><span class="lbl">Cores</span><span>{status.server.cpuCount}</span></div>
          <div class="info-r">
            <span class="lbl">Uptime</span><span>{status.server.uptimeDays}d {status.server.uptimeHours % 24}h</span>
          </div>
          <div class="info-r"><span class="lbl">Load</span><span>{status.server.loadAvg}</span></div>
        </div>
      </Card>

      <Card padding="sm">
        {#snippet header()}<strong>Memory</strong>{/snippet}
        <div class="mem-visual">
          <div class="mem-bar">
            <div class="mem-fill" style="width: {status.server.memPercent}%"></div>
          </div>
          <div class="mem-labels">
            <span>{Math.round((status.server.usedMemMB / 1024) * 10) / 10} GB used</span>
            <span>{Math.round((status.server.totalMemMB / 1024) * 10) / 10} GB total</span>
          </div>
          <div class="mem-percent">{status.server.memPercent}%</div>
        </div>
      </Card>
    </div>

    <!-- Storage breakdown -->
    <h3 class="section-title">Storage ({formatBytes(status.totalStorageBytes)})</h3>
    <div class="storage-grid">
      {#each status.storage as entry}
        <div class="storage-item">
          <div class="storage-bar-wrap">
            <div
              class="storage-bar-fill"
              style="width: {Math.max(2, (entry.sizeBytes / status.totalStorageBytes) * 100)}%"
            ></div>
          </div>
          <div class="storage-info">
            <span class="storage-name">{entry.name}</span>
            <span class="storage-size">{formatBytes(entry.sizeBytes)}</span>
            <span class="storage-count">{entry.fileCount} files</span>
          </div>
        </div>
      {/each}
    </div>

    <div class="data-dir">
      <Icon name="folder" size={14} />
      <code>{status.dataDir}</code>
    </div>
  {/if}
</div>

<style>
  .status-page {
    max-width: 900px;
    margin: 0 auto;
  }

  .page-header-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 4px;
  }

  .health-banner {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 18px;
    border-radius: 10px;
    margin-bottom: 20px;
    border: 1px solid var(--border);
    background: var(--bg-secondary);
  }

  .health-banner.green {
    border-color: var(--success);
    background: color-mix(in srgb, var(--success) 8%, var(--bg-secondary));
  }

  .health-banner.yellow {
    border-color: var(--warning);
    background: color-mix(in srgb, var(--warning) 8%, var(--bg-secondary));
  }

  .health-banner.red {
    border-color: var(--danger);
    background: color-mix(in srgb, var(--danger) 8%, var(--bg-secondary));
  }

  .health-dot-lg {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .green .health-dot-lg {
    background: var(--success);
    box-shadow: 0 0 6px var(--success);
  }

  .yellow .health-dot-lg {
    background: var(--warning);
    box-shadow: 0 0 6px var(--warning);
  }

  .red .health-dot-lg {
    background: var(--danger);
    box-shadow: 0 0 6px var(--danger);
  }

  .health-label {
    font-size: 0.92rem;
    font-weight: 600;
  }

  .health-latency {
    font-size: 0.72rem;
    font-family: 'JetBrains Mono', monospace;
    color: var(--text-faint);
    margin-left: auto;
  }

  .info-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(280px, 100%), 1fr));
    gap: 12px;
    margin-bottom: 24px;
  }

  .info-rows {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .info-r {
    display: flex;
    align-items: baseline;
    gap: 8px;
    font-size: 0.78rem;
  }

  .info-r .lbl {
    color: var(--text-faint);
    font-size: 0.68rem;
    font-weight: 600;
    text-transform: uppercase;
    min-width: 65px;
  }

  .info-r code {
    font-size: 0.72rem;
    background: var(--code-bg);
    padding: 1px 5px;
    border-radius: 3px;
  }

  .mem-visual {
    text-align: center;
  }

  .mem-bar {
    height: 12px;
    background: var(--bg-hover);
    border-radius: 6px;
    overflow: hidden;
    margin-bottom: 6px;
  }

  .mem-fill {
    height: 100%;
    background: var(--accent);
    border-radius: 6px;
    transition: width 0.3s;
  }

  .mem-labels {
    display: flex;
    justify-content: space-between;
    font-size: 0.68rem;
    color: var(--text-faint);
  }

  .mem-percent {
    font-size: 1.8rem;
    font-weight: 700;
    font-family: 'JetBrains Mono', monospace;
    color: var(--accent);
    margin-top: 8px;
  }

  .section-title {
    font-size: 0.88rem;
    font-weight: 600;
    margin: 0 0 12px;
    color: var(--text-secondary);
  }

  .storage-grid {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin-bottom: 16px;
  }

  .storage-item {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .storage-bar-wrap {
    height: 6px;
    background: var(--bg-hover);
    border-radius: 3px;
    overflow: hidden;
  }

  .storage-bar-fill {
    height: 100%;
    background: var(--accent);
    border-radius: 3px;
    transition: width 0.3s;
  }

  .storage-info {
    display: flex;
    gap: 12px;
    font-size: 0.72rem;
  }

  .storage-name {
    font-weight: 500;
    color: var(--text-primary);
    min-width: 100px;
  }

  .storage-size {
    font-family: 'JetBrains Mono', monospace;
    color: var(--text-muted);
  }

  .storage-count {
    color: var(--text-faint);
    margin-left: auto;
  }

  .data-dir {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 0.72rem;
    color: var(--text-faint);
    padding: 8px 0;
  }

  .data-dir code {
    font-size: 0.68rem;
    background: var(--code-bg);
    padding: 2px 6px;
    border-radius: 3px;
  }
</style>
