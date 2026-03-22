<script lang="ts">
  import type { PageData } from './$types';

  interface DockerContainer {
    id: string;
    name: string;
    image: string;
    status: string;
    state: string;
    ports: string;
    created: string;
  }
  import { toast } from '$lib/toast';
  import { fetchApi } from '$lib/api';
  import Button from '$lib/components/Button.svelte';
  import Badge from '$lib/components/Badge.svelte';
  import Icon from '$lib/components/Icon.svelte';
  import Tooltip from '$lib/components/Tooltip.svelte';
  import EmptyState from '$lib/components/EmptyState.svelte';
  import Loading from '$lib/components/Loading.svelte';
  import { onMount } from 'svelte';

  let { data } = $props<{ data: PageData }>();
  const dockerInstalled = data.installed;

  let containers = $state<DockerContainer[]>([]);
  let loading = $state(true);
  let actionLoading = $state<string | null>(null);

  onMount(async () => {
    if (dockerInstalled) {
      await refresh();
    }
    loading = false;
  });

  async function refresh() {
    try {
      const res = await fetchApi('/api/docker');
      const data = await res.json();
      containers = data.containers ?? [];
    } catch {
      toast.error('Failed to fetch containers');
    }
  }

  async function containerAction(id: string, action: 'start' | 'stop' | 'restart') {
    actionLoading = `${id}-${action}`;
    try {
      const res = await fetchApi('/api/docker', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, id }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed');
      }
      toast.success(`Container ${action}ed`);
      await refresh();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      actionLoading = null;
    }
  }

  function stateVariant(state: string): 'success' | 'danger' | 'warning' | 'default' {
    if (state === 'running') return 'success';
    if (state === 'exited') return 'danger';
    if (state === 'paused' || state === 'restarting') return 'warning';
    return 'default';
  }

  function stateLabel(state: string): string {
    return state.charAt(0).toUpperCase() + state.slice(1);
  }
</script>

<div class="page">
  <header class="page-header">
    <div class="page-title">
      <Icon name="monitor" size={20} />
      <h1>Docker</h1>
      {#if dockerInstalled}
        <Badge variant="success" size="sm" dot>Available</Badge>
      {/if}
    </div>
    {#if dockerInstalled}
      <Button variant="ghost" size="sm" icon="refresh" onclick={refresh}>Refresh</Button>
    {/if}
  </header>

  {#if !dockerInstalled}
    <EmptyState
      icon="monitor"
      title="Docker not installed"
      hint="Install Docker to manage containers from this dashboard."
    />
  {:else if loading}
    <Loading variant="skeleton" count={3} height="80px" />
  {:else if containers.length === 0}
    <EmptyState
      icon="monitor"
      title="No containers found"
      hint="No Docker containers are running or stopped on this host."
    />
  {:else}
    <div class="container-grid">
      {#each containers as c (c.id)}
        <div class="container-card card">
          <div class="container-top">
            <div class="container-info">
              <div class="container-name">{c.name}</div>
              <div class="container-image">{c.image}</div>
            </div>
            <Badge variant={stateVariant(c.state)} size="md" dot pulse={c.state === 'running'}>
              {stateLabel(c.state)}
            </Badge>
          </div>

          <div class="container-details">
            <div class="detail">
              <span class="detail-label">ID</span>
              <span class="detail-value mono">{c.id.slice(0, 12)}</span>
            </div>
            <div class="detail">
              <span class="detail-label">Status</span>
              <span class="detail-value">{c.status}</span>
            </div>
            {#if c.ports}
              <div class="detail">
                <span class="detail-label">Ports</span>
                <span class="detail-value mono">{c.ports}</span>
              </div>
            {/if}
            {#if c.created}
              <div class="detail">
                <span class="detail-label">Created</span>
                <span class="detail-value">{c.created}</span>
              </div>
            {/if}
          </div>

          <div class="container-actions">
            {#if c.state !== 'running'}
              <Tooltip text="Start">
                <Button
                  variant="ghost"
                  size="xs"
                  icon="play"
                  iconOnly
                  loading={actionLoading === `${c.id}-start`}
                  onclick={() => containerAction(c.id, 'start')}
                />
              </Tooltip>
            {:else}
              <Tooltip text="Stop">
                <Button
                  variant="ghost"
                  size="xs"
                  icon="stop"
                  iconOnly
                  loading={actionLoading === `${c.id}-stop`}
                  onclick={() => containerAction(c.id, 'stop')}
                />
              </Tooltip>
            {/if}
            <Tooltip text="Restart">
              <Button
                variant="ghost"
                size="xs"
                icon="refresh"
                iconOnly
                loading={actionLoading === `${c.id}-restart`}
                onclick={() => containerAction(c.id, 'restart')}
              />
            </Tooltip>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .page {
    max-width: 1100px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .page-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 12px;
  }

  .page-title {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .page-title h1 {
    font-size: 1.2rem;
    font-weight: 600;
    margin: 0;
    color: var(--text-primary);
  }

  .card {
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 16px;
  }

  .container-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
    gap: 12px;
  }

  .container-card {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .container-top {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
  }

  .container-info {
    min-width: 0;
  }

  .container-name {
    font-weight: 600;
    font-size: 0.9rem;
    color: var(--text-primary);
  }

  .container-image {
    font-size: 0.72rem;
    color: var(--text-muted);
    font-family: var(--font-mono, monospace);
    word-break: break-all;
    margin-top: 2px;
  }

  .container-details {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .detail {
    display: flex;
    align-items: baseline;
    gap: 8px;
  }

  .detail-label {
    font-size: 0.65rem;
    color: var(--text-faint);
    text-transform: uppercase;
    letter-spacing: 0.04em;
    min-width: 50px;
  }

  .detail-value {
    font-size: 0.78rem;
    color: var(--text-secondary);
  }

  .mono {
    font-family: var(--font-mono, monospace);
  }

  .container-actions {
    display: flex;
    gap: 4px;
    border-top: 1px solid var(--border);
    padding-top: 8px;
    margin-top: auto;
  }

  @media (max-width: 600px) {
    .container-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
