<script lang="ts">
  import type { PageData } from './$types';
  import type { ServiceStatus } from '$lib/server/services';
  import { toast } from '$lib/toast';
  import { fetchApi, postJson } from '$lib/api';
  import { getErrorMessage } from '$lib/errors';
  import Button from '$lib/components/Button.svelte';
  import Badge from '$lib/components/Badge.svelte';
  import Icon from '$lib/components/Icon.svelte';
  import Tooltip from '$lib/components/Tooltip.svelte';
  import PageHeader from '$lib/components/PageHeader.svelte';
  import AsyncState from '$lib/components/AsyncState.svelte';
  import ProgressBar from '$lib/components/ProgressBar.svelte';

  let { data } = $props<{ data: PageData }>();
  // svelte-ignore state_referenced_locally
  let statuses = $state<ServiceStatus[]>(data.statuses ?? []);

  // Add form
  let showForm = $state(false);
  let formName = $state('');
  let formUrl = $state('');
  let formInterval = $state(60);
  let formTimeout = $state(5);

  // Loading states
  let refreshing = $state(false);
  let adding = $state(false);
  let checkingId = $state<string | null>(null);

  import { onMount } from 'svelte';
  import { useShortcuts, SHORTCUT_DEFAULTS } from '$lib/shortcuts';
  import { createAutoRefresh } from '$lib/auto-refresh.svelte';

  // Auto-refresh every 30s
  createAutoRefresh(refresh, 30000);

  onMount(() => {
    return useShortcuts([
      { ...SHORTCUT_DEFAULTS.find((d) => d.id === 'services:refresh')!, handler: () => refreshWithIndicator() },
    ]);
  });

  async function refresh() {
    try {
      const res = await fetchApi('/api/services');
      const data = await res.json();
      statuses = data.statuses;
    } catch {
      // silent refresh failure
    }
  }

  async function refreshWithIndicator() {
    refreshing = true;
    await refresh();
    refreshing = false;
  }

  function resetForm() {
    formName = '';
    formUrl = '';
    formInterval = 60;
    formTimeout = 5;
    showForm = false;
  }

  async function addService() {
    if (!formName.trim() || !formUrl.trim()) {
      toast.error('Name and URL are required');
      return;
    }
    try {
      new URL(formUrl);
    } catch {
      toast.error('Invalid URL');
      return;
    }

    adding = true;
    try {
      const res = await postJson('/api/services', {
        action: 'add',
        name: formName.trim(),
        url: formUrl.trim(),
        interval: formInterval,
        timeout: formTimeout,
      });
      if (!res.ok) throw new Error('Failed to add service');
      toast.success(`Added ${formName}`);
      resetForm();
      await refresh();
    } catch (err: unknown) {
      toast.error(getErrorMessage(err));
    } finally {
      adding = false;
    }
  }

  async function removeService(id: string, name: string) {
    try {
      const res = await postJson('/api/services', { action: 'remove', id });
      if (!res.ok) throw new Error('Failed to remove');
      toast.success(`Removed ${name}`);
      await refresh();
    } catch (err: unknown) {
      toast.error(getErrorMessage(err));
    }
  }

  async function checkNow(id: string) {
    checkingId = id;
    try {
      await postJson('/api/services', { action: 'check', id });
      await refresh();
    } catch {
      toast.error('Check failed');
    } finally {
      checkingId = null;
    }
  }

  function statusVariant(s: ServiceStatus): 'success' | 'danger' | 'default' {
    if (!s.lastCheck) return 'default';
    if (s.lastCheck.status !== null && s.lastCheck.status < 500) return 'success';
    return 'danger';
  }

  function statusLabel(s: ServiceStatus): string {
    if (!s.lastCheck) return 'UNKNOWN';
    if (s.lastCheck.status !== null && s.lastCheck.status < 500) return 'UP';
    return 'DOWN';
  }

  function formatMs(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  }

  function timeAgo(iso: string): string {
    const diff = Date.now() - new Date(iso).getTime();
    if (diff < 60000) return `${Math.floor(diff / 1000)}s ago`;
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    return `${Math.floor(diff / 3600000)}h ago`;
  }

  const INTERVALS = [
    { label: '30s', value: 30 },
    { label: '1m', value: 60 },
    { label: '5m', value: 300 },
    { label: '15m', value: 900 },
  ];

  const TIMEOUTS = [
    { label: '5s', value: 5 },
    { label: '10s', value: 10 },
    { label: '30s', value: 30 },
  ];
</script>

<div class="page page-lg">
  <PageHeader title="Service Health" icon="signal">
    {#snippet titleExtra()}
      <Badge variant="default" size="sm">{statuses.length}</Badge>
    {/snippet}
    <Button variant="ghost" size="sm" icon="refresh" loading={refreshing} onclick={refreshWithIndicator}>
      Refresh
    </Button>
    <Button variant="primary" size="sm" icon="add" onclick={() => (showForm = !showForm)}>Add Service</Button>
  </PageHeader>

  {#if showForm}
    <div class="add-form card card-padded">
      <h3>Add Service</h3>
      <div class="form-grid">
        <label class="form-field">
          <span class="form-label">Name</span>
          <input type="text" class="input" bind:value={formName} placeholder="My API" />
        </label>
        <label class="form-field">
          <span class="form-label">URL</span>
          <input type="url" class="input" bind:value={formUrl} placeholder="https://example.com/health" />
        </label>
        <label class="form-field">
          <span class="form-label">Check Interval</span>
          <select class="input" bind:value={formInterval}>
            {#each INTERVALS as opt}
              <option value={opt.value}>{opt.label}</option>
            {/each}
          </select>
        </label>
        <label class="form-field">
          <span class="form-label">Timeout</span>
          <select class="input" bind:value={formTimeout}>
            {#each TIMEOUTS as opt}
              <option value={opt.value}>{opt.label}</option>
            {/each}
          </select>
        </label>
      </div>
      <div class="form-actions">
        <Button variant="ghost" size="sm" onclick={resetForm}>Cancel</Button>
        <Button variant="primary" size="sm" loading={adding} onclick={addService}>Add</Button>
      </div>
    </div>
  {/if}

  <AsyncState
    empty={statuses.length === 0}
    emptyTitle="No services configured"
    emptyIcon="signal"
    emptyHint="Add an HTTP endpoint to monitor its health."
    emptyActionLabel="Add Service"
    onemptyaction={() => (showForm = true)}
  >
    <div class="service-grid">
      {#each statuses as svc (svc.config.id)}
        <div class="service-card card card-padded">
          <div class="service-top">
            <div class="service-info">
              <div class="service-name">{svc.config.name}</div>
              <div class="service-url">{svc.config.url}</div>
            </div>
            <Badge variant={statusVariant(svc)} size="md" dot pulse={statusLabel(svc) === 'UP'}>
              {statusLabel(svc)}
            </Badge>
          </div>

          <div class="service-stats">
            {#if svc.lastCheck}
              <div class="stat">
                <span class="stat-label">Response</span>
                <span class="stat-value">{formatMs(svc.lastCheck.responseTime)}</span>
              </div>
              <div class="stat">
                <span class="stat-label">Last checked</span>
                <span class="stat-value">{timeAgo(svc.lastCheck.timestamp)}</span>
              </div>
            {/if}
            <div class="stat">
              <span class="stat-label">Uptime (24h)</span>
              <span class="stat-value">
                {#if svc.uptime24h < 0}
                  --
                {:else}
                  {svc.uptime24h}%
                {/if}
              </span>
            </div>
          </div>

          {#if svc.uptime24h >= 0}
            <ProgressBar
              value={svc.uptime24h}
              height="4px"
              colorThresholds={[
                { value: 0, color: 'var(--danger)' },
                { value: 50, color: 'var(--warning)' },
                { value: 95, color: 'var(--success)' },
              ]}
            />
          {/if}

          {#if svc.lastCheck?.error}
            <div class="service-error">{svc.lastCheck.error}</div>
          {/if}

          <div class="service-actions">
            <Tooltip text="Check now">
              <Button
                variant="ghost"
                size="xs"
                icon="refresh"
                iconOnly
                loading={checkingId === svc.config.id}
                onclick={() => checkNow(svc.config.id)}
              />
            </Tooltip>
            <Tooltip text="Delete">
              <Button
                variant="ghost"
                size="xs"
                icon="delete"
                iconOnly
                confirm
                confirmText="Delete?"
                onclick={() => removeService(svc.config.id, svc.config.name)}
              />
            </Tooltip>
          </div>
        </div>
      {/each}
    </div>
  </AsyncState>
</div>

<style>
  .add-form h3 {
    margin: 0 0 12px;
    font-size: 0.9rem;
    color: var(--text-primary);
  }

  .form-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }

  .form-field {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .form-label {
    font-size: 0.72rem;
    color: var(--text-muted);
    font-weight: 500;
  }

  .input {
    padding: 6px 10px;
    border: 1px solid var(--border);
    border-radius: 6px;
    background: var(--input-bg);
    color: var(--text-primary);
    font-family: inherit;
    font-size: 0.82rem;
  }

  .input:focus {
    outline: none;
    border-color: var(--accent);
  }

  .form-actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    margin-top: 12px;
  }

  .service-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
    gap: 12px;
  }

  .service-card {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .service-top {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
  }

  .service-info {
    min-width: 0;
  }

  .service-name {
    font-weight: 600;
    font-size: 0.9rem;
    color: var(--text-primary);
  }

  .service-url {
    font-size: 0.72rem;
    color: var(--text-muted);
    font-family: var(--font-mono, monospace);
    word-break: break-all;
    margin-top: 2px;
  }

  .service-stats {
    display: flex;
    gap: 16px;
  }

  .stat {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .stat-label {
    font-size: 0.65rem;
    color: var(--text-faint);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .stat-value {
    font-size: 0.82rem;
    font-weight: 600;
    color: var(--text-secondary);
  }

  .service-error {
    font-size: 0.72rem;
    color: var(--danger);
    background: var(--danger-bg);
    padding: 6px 8px;
    border-radius: 4px;
    font-family: var(--font-mono, monospace);
  }

  .service-actions {
    display: flex;
    gap: 4px;
    border-top: 1px solid var(--border);
    padding-top: 8px;
    margin-top: auto;
  }

  @media (max-width: 600px) {
    .form-grid {
      grid-template-columns: 1fr;
    }
    .service-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
