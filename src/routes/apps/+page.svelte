<script lang="ts">
  import type { PageData } from './$types';
  import FilterBar from '$lib/components/FilterBar.svelte';
  import Button from '$lib/components/Button.svelte';
  import Badge from '$lib/components/Badge.svelte';
  import Icon from '$lib/components/Icon.svelte';
  import { toast } from '$lib/toast';
  import { fetchApi, postJson } from '$lib/api';
  import { getErrorMessage } from '$lib/errors';
  import ConfirmDialog from '$lib/components/ConfirmDialog.svelte';
  import InfoRow from '$lib/components/InfoRow.svelte';
  import { onMount } from 'svelte';
  import { createAutoRefresh } from '$lib/auto-refresh.svelte';

  interface AppInfo {
    name: string;
    path: string;
  }

  let { data } = $props<{ data: PageData }>();
  let apps = $state<AppInfo[]>([]);
  $effect(() => {
    apps = data.apps;
  });
  let search = $state('');
  interface AppDetail {
    name: string;
    pids: number[];
    cpu: number;
    mem: number;
    memMB: number;
    openFiles: number;
    path: string;
    version: string;
  }

  let launching = $state<string | null>(null);
  let runningApps = $state<Set<string>>(new Set());
  const autoRefresh = createAutoRefresh(fetchRunning, 10000);
  let expandedApp = $state<string | null>(null);
  let appDetails = $state<Record<string, AppDetail>>({});

  let filtered = $derived.by(() => {
    if (!search) return apps;
    const q = search.toLowerCase();
    return apps.filter((a) => a.name.toLowerCase().includes(q));
  });

  let grouped = $derived.by(() => {
    const groups: Record<string, AppInfo[]> = {};
    for (const app of filtered) {
      const letter = app.name[0]?.toUpperCase() || '#';
      const key = /^[A-Z]$/.test(letter) ? letter : '#';
      if (!groups[key]) groups[key] = [];
      groups[key].push(app);
    }
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  });

  async function launchApp(app: AppInfo) {
    launching = app.path;
    try {
      const res = await postJson('/api/apps', { path: app.path });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Launch failed');
      toast.success(`Launched ${app.name}`);
      // Refresh running status after launch
      setTimeout(fetchRunning, 2000);
    } catch (e: unknown) {
      toast.error(getErrorMessage(e, `Failed to launch ${app.name}`));
    } finally {
      launching = null;
    }
  }

  async function fetchRunning() {
    try {
      const res = await fetchApi('/api/apps');
      if (!res.ok) throw new Error('Failed to fetch apps');
      const data = await res.json();
      apps = data.apps;
      runningApps = new Set(data.running ?? []);
    } catch {
      // Silent fail for polling
    }
  }

  async function refreshApps() {
    try {
      const res = await fetchApi('/api/apps');
      if (!res.ok) throw new Error('Failed to fetch apps');
      const data = await res.json();
      apps = data.apps;
      runningApps = new Set(data.running ?? []);
    } catch (e: unknown) {
      toast.error(getErrorMessage(e, 'Failed to refresh apps'));
    }
  }

  let killing = $state<string | null>(null);
  let showConfirmKill = $state(false);
  let confirmKillName = $state('');

  async function toggleDetails(appName: string) {
    if (expandedApp === appName) {
      expandedApp = null;
      return;
    }
    expandedApp = appName;
    if (!appDetails[appName]) {
      try {
        const res = await fetchApi(`/api/apps/${encodeURIComponent(appName)}`);
        if (res.ok) {
          appDetails[appName] = await res.json();
        }
      } catch {}
    }
  }

  async function killApp(name: string, force: boolean) {
    killing = name;
    showConfirmKill = false;
    try {
      const res = await postJson('/api/apps', { name, force }, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Kill failed');
      toast.success(force ? `Force-killed ${name}` : `Quit ${name}`);
      setTimeout(fetchRunning, 1000);
    } catch (e: unknown) {
      toast.error(getErrorMessage(e, `Failed to kill ${name}`));
    } finally {
      killing = null;
    }
  }

  // autoRefresh handles interval + cleanup; initial fetch on mount
  onMount(() => fetchRunning());
</script>

<svelte:head>
  <title>Apps | Home Server</title>
</svelte:head>

<div class="page-header">
  <h2 class="page-title">Apps</h2>
  <div class="page-actions">
    <Button size="sm" icon="refresh" onclick={refreshApps}>Refresh</Button>
    <span class="app-count">{filtered.length} of {apps.length} apps</span>
  </div>
</div>
<p class="page-desc">Browse and launch applications installed on this machine.</p>

<FilterBar search bind:searchValue={search} searchPlaceholder="Filter apps..." />

{#if apps.length === 0}
  <div class="empty-state">
    <p class="empty-title">No Applications Found</p>
    <p class="empty-desc">The /Applications directory was not found or is empty. This feature is available on macOS.</p>
  </div>
{:else if filtered.length === 0}
  <p class="empty">No apps match your search.</p>
{:else}
  {#each grouped as [letter, groupApps]}
    <div class="app-group">
      <div class="group-letter">{letter}</div>
      <div class="app-grid">
        {#each groupApps as app}
          <div class="app-card-wrap" class:expanded={expandedApp === app.name}>
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <div
              class="app-card"
              class:launching={launching === app.path}
              class:running={runningApps.has(app.name)}
              role="button"
              tabindex="0"
              onclick={() => launchApp(app)}
              onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && launchApp(app)}
              title={app.path}
            >
              <div class="app-icon">
                <img
                  src="/api/apps/icon/{encodeURIComponent(app.name)}"
                  alt=""
                  class="app-icon-img"
                  loading="lazy"
                  onerror={(e) => {
                    (e.currentTarget as HTMLImageElement).style.display = 'none';
                  }}
                />
                <span class="icon-placeholder">{app.name[0]?.toUpperCase() || '?'}</span>
              </div>
              <div class="app-name">{app.name}</div>
              {#if launching === app.path}
                <div class="app-status">Launching...</div>
              {:else if killing === app.name}
                <div class="app-status">Stopping...</div>
              {:else if runningApps.has(app.name)}
                <div class="app-badge">
                  <Badge variant="success" dot pulse>Running</Badge>
                </div>
                <!-- svelte-ignore a11y_click_events_have_key_events -->
                <!-- svelte-ignore a11y_no_static_element_interactions -->
                <div class="app-kill-actions" onclick={(e) => e.stopPropagation()}>
                  <button
                    class="kill-btn"
                    title="Quit gracefully"
                    onclick={(e) => {
                      e.stopPropagation();
                      killApp(app.name, false);
                    }}
                  >
                    <Icon name="close" size={12} /> Quit
                  </button>
                  <button
                    class="kill-btn force"
                    title="Force kill (SIGKILL)"
                    onclick={(e) => {
                      e.stopPropagation();
                      confirmKillName = app.name;
                      showConfirmKill = true;
                    }}
                  >
                    <Icon name="close" size={12} /> Force
                  </button>
                </div>
              {/if}
            </div>
            {#if runningApps.has(app.name)}
              <button
                class="info-toggle"
                title="Process details"
                onclick={(e) => {
                  e.stopPropagation();
                  toggleDetails(app.name);
                }}
              >
                <Icon name={expandedApp === app.name ? 'chevron-down' : 'chevron-right'} size={12} />
              </button>
            {/if}
            {#if expandedApp === app.name && appDetails[app.name]}
              {@const d = appDetails[app.name]}
              <div class="app-details">
                <InfoRow label="CPU" value="{d.cpu}%" />
                <InfoRow label="MEM" value="{d.mem}% ({d.memMB}MB)" />
                <InfoRow label="PIDs" value={d.pids.join(', ')} />
                <InfoRow label="Files" value={String(d.openFiles)} />
                {#if d.version}<InfoRow label="Ver" value={d.version} />{/if}
                <InfoRow label="Path" value={d.path} mono />
              </div>
            {/if}
          </div>
        {/each}
      </div>
    </div>
  {/each}
{/if}

<ConfirmDialog
  bind:open={showConfirmKill}
  title={`Force Kill "${confirmKillName}"?`}
  message="This will immediately terminate the app without saving. Unsaved work may be lost."
  confirmLabel="Force Kill"
  confirmVariant="danger"
  confirmIcon="close"
  onconfirm={() => killApp(confirmKillName, true)}
/>

<style>
  .app-kill-actions {
    display: flex;
    gap: 4px;
    margin-top: 2px;
  }

  .kill-btn {
    font-size: 0.6rem;
    padding: 2px 6px;
    border: 1px solid var(--border);
    border-radius: 4px;
    background: var(--bg-primary);
    color: var(--text-muted);
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 3px;
    font-family: inherit;
    transition:
      border-color 0.15s,
      color 0.15s;
  }

  .kill-btn:hover {
    border-color: var(--warning);
    color: var(--warning);
  }

  .kill-btn.force:hover {
    border-color: var(--danger);
    color: var(--danger);
  }

  .app-card-wrap {
    position: relative;
  }

  .app-card-wrap.expanded {
    grid-column: span 2;
    grid-row: span 2;
  }

  .info-toggle {
    position: absolute;
    top: 4px;
    right: 4px;
    background: none;
    border: none;
    color: var(--text-faint);
    cursor: pointer;
    padding: 2px;
    border-radius: 3px;
    font-family: inherit;
  }

  .info-toggle:hover {
    color: var(--accent);
    background: var(--bg-hover);
  }

  .app-details {
    background: var(--bg-primary);
    border: 1px solid var(--border);
    border-top: none;
    border-radius: 0 0 8px 8px;
    padding: 8px 12px;
    font-size: 0.68rem;
  }

  .page-header {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 12px;
    margin-bottom: 16px;
  }

  h2 {
    font-size: 1.3rem;
    margin: 0;
  }

  .page-actions {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-left: auto;
  }

  .app-count {
    font-size: 0.75rem;
    color: var(--text-muted);
  }

  .page-desc {
    color: var(--text-muted);
    font-size: 0.85rem;
    margin-bottom: 16px;
  }

  .empty-state {
    text-align: center;
    padding: 60px 20px;
    color: var(--text-muted);
  }

  .empty-title {
    font-size: 1.1rem;
    font-weight: 600;
    color: var(--text-secondary);
    margin-bottom: 8px;
  }

  .empty-desc {
    font-size: 0.85rem;
  }

  .empty {
    color: var(--text-muted);
    text-align: center;
    padding: 40px;
  }

  .app-group {
    margin-bottom: 24px;
  }

  .group-letter {
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.1em;
    padding-bottom: 6px;
    margin-bottom: 10px;
    border-bottom: 1px solid var(--border-subtle);
  }

  .app-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
    gap: 8px;
  }

  .app-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    padding: 14px 10px 10px;
    border: 1px solid var(--border);
    border-radius: 10px;
    background: var(--bg-secondary);
    cursor: pointer;
    font-family: inherit;
    color: var(--text-primary);
    min-height: 110px;
    justify-content: center;
    transition:
      border-color 0.15s,
      background 0.15s,
      transform 0.1s,
      box-shadow 0.15s;
  }

  .app-card:hover {
    border-color: var(--accent);
    background: var(--bg-inset);
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }

  .app-card:active {
    transform: translateY(0);
  }

  .app-card.launching {
    border-color: var(--accent);
    background: var(--accent-bg);
  }

  .app-card.running {
    border-color: var(--success);
  }

  .app-icon {
    width: 48px;
    height: 48px;
    border-radius: 10px;
    background: var(--bg-primary);
    border: 1px solid var(--border);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .app-icon-img {
    width: 100%;
    height: 100%;
    object-fit: contain;
    border-radius: 8px;
    position: absolute;
    inset: 0;
    z-index: 1;
  }

  .app-icon {
    position: relative;
  }

  .icon-placeholder {
    font-size: 1.3rem;
    font-weight: 700;
    color: var(--accent);
  }

  .app-name {
    font-size: 0.78rem;
    text-align: center;
    line-height: 1.3;
    overflow: hidden;
    text-overflow: ellipsis;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    word-break: break-word;
    max-width: 100%;
  }

  .app-status {
    font-size: 0.65rem;
    color: var(--accent);
    animation: pulse 0.8s ease-in-out infinite alternate;
  }

  .app-badge {
    margin-top: -2px;
  }

  @keyframes pulse {
    from {
      opacity: 0.5;
    }
    to {
      opacity: 1;
    }
  }

  @media (max-width: 640px) {
    .app-grid {
      grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
    }
  }
</style>
