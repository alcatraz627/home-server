<script lang="ts">
  import type { PageData } from './$types';
  import SearchInput from '$lib/components/SearchInput.svelte';
  import Button from '$lib/components/Button.svelte';
  import Badge from '$lib/components/Badge.svelte';
  import { toast } from '$lib/toast';
  import { onMount, onDestroy } from 'svelte';

  interface AppInfo {
    name: string;
    path: string;
  }

  let { data } = $props<{ data: PageData }>();
  let apps = $state<AppInfo[]>(data.apps);
  let search = $state('');
  let launching = $state<string | null>(null);
  let runningApps = $state<Set<string>>(new Set());
  let runningPollInterval: ReturnType<typeof setInterval> | null = null;

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
      const res = await fetch('/api/apps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: app.path }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Launch failed');
      toast.success(`Launched ${app.name}`);
      // Refresh running status after launch
      setTimeout(fetchRunning, 2000);
    } catch (e: any) {
      toast.error(e.message || `Failed to launch ${app.name}`);
    } finally {
      launching = null;
    }
  }

  async function fetchRunning() {
    try {
      const res = await fetch('/api/apps');
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
      const res = await fetch('/api/apps');
      if (!res.ok) throw new Error('Failed to fetch apps');
      const data = await res.json();
      apps = data.apps;
      runningApps = new Set(data.running ?? []);
    } catch (e: any) {
      toast.error(e.message || 'Failed to refresh apps');
    }
  }

  onMount(() => {
    fetchRunning();
    runningPollInterval = setInterval(fetchRunning, 10000);
  });

  onDestroy(() => {
    if (runningPollInterval) clearInterval(runningPollInterval);
  });
</script>

<svelte:head>
  <title>Apps | Home Server</title>
</svelte:head>

<div class="page-header">
  <h2 class="page-title">Apps</h2>
  <div class="page-actions">
    <Button size="sm" onclick={refreshApps}>Refresh</Button>
    <span class="app-count">{filtered.length} of {apps.length} apps</span>
  </div>
</div>
<p class="page-desc">Browse and launch applications installed on this machine.</p>

<div class="search-bar">
  <SearchInput bind:value={search} placeholder="Filter apps..." />
</div>

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
          <button
            class="app-card"
            class:launching={launching === app.path}
            class:running={runningApps.has(app.name)}
            onclick={() => launchApp(app)}
            title={app.path}
          >
            <div class="app-icon">
              <span class="icon-placeholder">{app.name[0]?.toUpperCase() || '?'}</span>
            </div>
            <div class="app-name">{app.name}</div>
            {#if launching === app.path}
              <div class="app-status">Launching...</div>
            {:else if runningApps.has(app.name)}
              <div class="app-badge">
                <Badge variant="success" dot pulse>Running</Badge>
              </div>
            {/if}
          </button>
        {/each}
      </div>
    </div>
  {/each}
{/if}

<style>
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

  .search-bar {
    margin-bottom: 20px;
    max-width: 400px;
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
    grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
    gap: 10px;
  }

  .app-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    padding: 16px 10px;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--bg-secondary);
    cursor: pointer;
    font-family: inherit;
    color: var(--text-primary);
    transition:
      border-color 0.15s,
      background 0.15s,
      transform 0.1s;
  }

  .app-card:hover {
    border-color: var(--accent);
    background: var(--bg-inset);
    transform: translateY(-1px);
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
