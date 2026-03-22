<script lang="ts">
  import { fetchApi } from '$lib/api';
  import { toast } from '$lib/toast';
  import { onMount } from 'svelte';
  import Button from '$lib/components/Button.svelte';
  import Badge from '$lib/components/Badge.svelte';
  import Icon from '$lib/components/Icon.svelte';
  import Card from '$lib/components/Card.svelte';

  interface ServiceStatus {
    name: string;
    installed: boolean;
    running: boolean;
    version: string;
    pid: number | null;
    port: number | null;
    uptime: string;
    memMB: number;
    connections: number;
  }

  interface PM2Process {
    name: string;
    pid: number;
    status: string;
    cpu: number;
    memory: number;
    uptime: number;
    restarts: number;
  }

  let services = $state<ServiceStatus[]>([]);
  let loading = $state(true);
  let expanded = $state<string | null>(null);

  // PM2 details
  let pm2Processes = $state<PM2Process[]>([]);
  // Postgres details
  let pgDatabases = $state<{ name: string; sizeBytes: number }[]>([]);
  // Redis details
  let redisKeyCount = $state(0);

  async function refresh() {
    loading = true;
    try {
      const res = await fetchApi('/api/databases');
      if (res.ok) {
        const data = await res.json();
        services = data.services;
      }
    } catch {}
    loading = false;
  }

  async function loadDetails(service: string) {
    if (expanded === service) {
      expanded = null;
      return;
    }
    expanded = service;
    try {
      const svc = service.toLowerCase().replace(/\s+/g, '');
      let param = svc;
      if (svc === 'postgresql') param = 'postgres';
      const res = await fetchApi(`/api/databases?service=${param}`);
      if (res.ok) {
        const data = await res.json();
        if (param === 'pm2') pm2Processes = data.processes || [];
        if (param === 'postgres') pgDatabases = data.databases || [];
        if (param === 'redis') redisKeyCount = data.keyCount || 0;
      }
    } catch {}
  }

  async function pm2Action(action: string, target: string) {
    try {
      const res = await fetchApi('/api/databases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ service: 'pm2', action, target }),
      });
      if (res.ok) {
        toast.success(`PM2: ${action} ${target}`);
        setTimeout(() => loadDetails('PM2'), 1000);
      }
    } catch {
      toast.error(`PM2 ${action} failed`);
    }
  }

  function formatBytes(b: number): string {
    if (b < 1024) return `${b} B`;
    if (b < 1048576) return `${(b / 1024).toFixed(1)} KB`;
    if (b < 1073741824) return `${(b / 1048576).toFixed(1)} MB`;
    return `${(b / 1073741824).toFixed(2)} GB`;
  }

  function formatUptime(sec: number): string {
    if (sec < 60) return `${sec}s`;
    if (sec < 3600) return `${Math.floor(sec / 60)}m`;
    return `${Math.floor(sec / 3600)}h ${Math.floor((sec % 3600) / 60)}m`;
  }

  onMount(refresh);
</script>

<svelte:head>
  <title>Databases & Services | Home Server</title>
</svelte:head>

<div class="page-header-row">
  <h2 class="page-title">Databases & Services</h2>
  <Button size="sm" onclick={refresh} disabled={loading} {loading}>Refresh</Button>
</div>
<p class="page-desc">Monitor and manage PostgreSQL, Redis, MongoDB, and PM2 process manager.</p>

<div class="service-grid">
  {#each services as svc}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="service-card"
      class:running={svc.running}
      class:not-installed={!svc.installed}
      onclick={() => svc.installed && loadDetails(svc.name)}
    >
      <div class="svc-header">
        <span class="svc-dot" class:online={svc.running}></span>
        <h3>{svc.name}</h3>
        {#if svc.version}
          <Badge size="sm">{svc.version}</Badge>
        {/if}
        <Badge variant={svc.running ? 'success' : svc.installed ? 'warning' : 'default'}>
          {svc.running ? 'Running' : svc.installed ? 'Stopped' : 'Not Installed'}
        </Badge>
      </div>

      {#if svc.installed}
        <div class="svc-stats">
          {#if svc.port}<span class="svc-stat">Port: <strong>{svc.port}</strong></span>{/if}
          {#if svc.pid}<span class="svc-stat">PID: <strong>{svc.pid}</strong></span>{/if}
          {#if svc.memMB}<span class="svc-stat">Mem: <strong>{svc.memMB}MB</strong></span>{/if}
          {#if svc.connections}<span class="svc-stat">Conn: <strong>{svc.connections}</strong></span>{/if}
          {#if svc.uptime}<span class="svc-stat">Up: <strong>{svc.uptime}</strong></span>{/if}
        </div>
      {:else}
        <p class="svc-install-hint">Not detected on this system</p>
      {/if}

      {#if expanded === svc.name}
        <div class="svc-details" onclick={(e) => e.stopPropagation()}>
          {#if svc.name === 'PM2' && pm2Processes.length > 0}
            <table class="detail-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Status</th>
                  <th>CPU</th>
                  <th>Mem</th>
                  <th>Uptime</th>
                  <th>Restarts</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {#each pm2Processes as proc}
                  <tr>
                    <td class="mono">{proc.name}</td>
                    <td>
                      <Badge
                        variant={proc.status === 'online'
                          ? 'success'
                          : proc.status === 'stopped'
                            ? 'warning'
                            : 'danger'}
                      >
                        {proc.status}
                      </Badge>
                    </td>
                    <td>{proc.cpu}%</td>
                    <td>{proc.memory}MB</td>
                    <td>{formatUptime(proc.uptime)}</td>
                    <td>{proc.restarts}</td>
                    <td class="action-cell">
                      <Button size="xs" onclick={() => pm2Action('restart', proc.name)}>Restart</Button>
                      {#if proc.status === 'online'}
                        <Button size="xs" variant="danger" onclick={() => pm2Action('stop', proc.name)}>Stop</Button>
                      {:else}
                        <Button size="xs" variant="accent" onclick={() => pm2Action('start', proc.name)}>Start</Button>
                      {/if}
                    </td>
                  </tr>
                {/each}
              </tbody>
            </table>
          {:else if svc.name === 'PostgreSQL' && pgDatabases.length > 0}
            <table class="detail-table">
              <thead>
                <tr><th>Database</th><th>Size</th></tr>
              </thead>
              <tbody>
                {#each pgDatabases as db}
                  <tr>
                    <td class="mono">{db.name}</td>
                    <td>{formatBytes(db.sizeBytes)}</td>
                  </tr>
                {/each}
              </tbody>
            </table>
          {:else if svc.name === 'Redis'}
            <div class="redis-info">
              <span>Keys in current DB: <strong>{redisKeyCount}</strong></span>
            </div>
          {:else}
            <p class="no-details">Click to load details</p>
          {/if}
        </div>
      {/if}
    </div>
  {/each}
</div>

{#if services.every((s) => !s.installed)}
  <Card padding="md">
    <p style="color: var(--text-muted); text-align: center;">
      No database services detected. Install PostgreSQL, Redis, MongoDB, or PM2 to manage them here.
    </p>
  </Card>
{/if}

<style>
  .page-header-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 4px;
  }

  .service-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(400px, 100%), 1fr));
    gap: 12px;
    margin-top: 16px;
  }

  .service-card {
    border: 1px solid var(--border);
    border-radius: 10px;
    background: var(--bg-secondary);
    padding: 16px 18px;
    cursor: pointer;
    transition:
      border-color 0.15s,
      box-shadow 0.15s;
  }

  .service-card:hover {
    border-color: var(--accent);
  }

  .service-card.running {
    border-left: 3px solid var(--success);
  }

  .service-card.not-installed {
    opacity: 0.5;
    cursor: default;
  }

  .svc-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;
  }

  .svc-header h3 {
    font-size: 0.95rem;
    font-weight: 600;
    margin: 0;
  }

  .svc-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--text-faint);
    flex-shrink: 0;
  }

  .svc-dot.online {
    background: var(--success);
    box-shadow: 0 0 4px var(--success);
  }

  .svc-stats {
    display: flex;
    gap: 16px;
    flex-wrap: wrap;
  }

  .svc-stat {
    font-size: 0.72rem;
    color: var(--text-muted);
  }

  .svc-stat strong {
    color: var(--text-primary);
    font-family: 'JetBrains Mono', monospace;
  }

  .svc-install-hint {
    font-size: 0.75rem;
    color: var(--text-faint);
    margin: 0;
  }

  .svc-details {
    margin-top: 12px;
    padding-top: 12px;
    border-top: 1px solid var(--border);
  }

  .detail-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.75rem;
  }

  .detail-table th {
    text-align: left;
    padding: 4px 8px;
    font-weight: 600;
    color: var(--text-faint);
    border-bottom: 1px solid var(--border);
    font-size: 0.68rem;
    text-transform: uppercase;
  }

  .detail-table td {
    padding: 5px 8px;
    border-bottom: 1px solid var(--border-subtle);
  }

  .mono {
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.72rem;
  }

  .action-cell {
    display: flex;
    gap: 4px;
  }

  .redis-info {
    font-size: 0.78rem;
    color: var(--text-secondary);
  }

  .redis-info strong {
    font-family: 'JetBrains Mono', monospace;
  }

  .no-details {
    font-size: 0.75rem;
    color: var(--text-faint);
    text-align: center;
  }
</style>
