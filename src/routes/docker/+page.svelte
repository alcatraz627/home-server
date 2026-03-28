<script lang="ts">
  import type { PageData } from './$types';
  import type { DockerContainer } from '$lib/types/docker';
  import { toast } from '$lib/toast';
  import { fetchApi, postJson } from '$lib/api';
  import { getErrorMessage } from '$lib/errors';
  import Button from '$lib/components/Button.svelte';
  import Badge from '$lib/components/Badge.svelte';
  import Icon from '$lib/components/Icon.svelte';
  import Tooltip from '$lib/components/Tooltip.svelte';
  import PageHeader from '$lib/components/PageHeader.svelte';
  import EmptyState from '$lib/components/EmptyState.svelte';
  import AsyncState from '$lib/components/AsyncState.svelte';
  import InfoRow from '$lib/components/InfoRow.svelte';
  import { onMount } from 'svelte';
  import { useShortcuts, SHORTCUT_DEFAULTS } from '$lib/shortcuts';

  let { data } = $props<{ data: PageData }>();
  const dockerInstalled = $derived(data.installed);

  let containers = $state<DockerContainer[]>([]);
  let loading = $state(true);
  let actionLoading = $state<string | null>(null);

  onMount(() => {
    (async () => {
      if (dockerInstalled) {
        await refresh();
      }
      loading = false;
    })();
    return useShortcuts([{ ...SHORTCUT_DEFAULTS.find((d) => d.id === 'docker:refresh')!, handler: () => refresh() }]);
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
      const res = await postJson('/api/docker', { action, id });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed');
      }
      toast.success(`Container ${action}ed`);
      await refresh();
    } catch (err: unknown) {
      toast.error(getErrorMessage(err));
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

<div class="page page-lg">
  <PageHeader title="Docker" icon="monitor">
    {#snippet titleExtra()}
      {#if dockerInstalled}
        <Badge variant="success" size="sm" dot>Available</Badge>
      {/if}
    {/snippet}
    {#if dockerInstalled}
      <Button variant="ghost" size="sm" icon="refresh" onclick={refresh}>Refresh</Button>
    {/if}
  </PageHeader>

  {#if !dockerInstalled}
    <EmptyState
      icon="monitor"
      title="Docker not installed"
      hint="Install Docker to manage containers from this dashboard."
    />
  {:else}
    <AsyncState
      {loading}
      empty={containers.length === 0}
      emptyIcon="monitor"
      emptyTitle="No containers found"
      emptyHint="No Docker containers are running or stopped on this host."
      loadingCount={3}
      loadingHeight="80px"
    >
      <div class="container-grid">
        {#each containers as c (c.id)}
          <div class="container-card card card-padded">
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
              <InfoRow label="ID" value={c.id.slice(0, 12)} mono />
              <InfoRow label="Status" value={c.status} />
              {#if c.ports}
                <InfoRow label="Ports" value={c.ports} mono />
              {/if}
              {#if c.created}
                <InfoRow label="Created" value={c.created} />
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
    </AsyncState>
  {/if}
</div>

<style>
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
