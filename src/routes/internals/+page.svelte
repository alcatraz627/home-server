<script lang="ts">
  import { fetchApi } from '$lib/api';
  import { onMount } from 'svelte';
  import Button from '$lib/components/Button.svelte';
  import Icon from '$lib/components/Icon.svelte';

  let data = $state<any>(null);
  let loading = $state(true);
  let expandedSections = $state<Set<string>>(new Set(['app', 'rateLimits']));

  async function refresh() {
    loading = true;
    try {
      const res = await fetchApi('/api/internals');
      if (res.ok) data = await res.json();
    } catch {}
    loading = false;
  }

  function toggleSection(key: string) {
    if (expandedSections.has(key)) {
      expandedSections.delete(key);
    } else {
      expandedSections.add(key);
    }
    expandedSections = new Set(expandedSections);
  }

  function formatBytes(b: number): string {
    if (b < 1024) return `${b} B`;
    if (b < 1048576) return `${(b / 1024).toFixed(1)} KB`;
    return `${(b / 1048576).toFixed(1)} MB`;
  }

  onMount(refresh);
</script>

<svelte:head>
  <title>Internals | Home Server</title>
</svelte:head>

<div class="page">
  <div class="page-header-row">
    <h2 class="page-title">Internal State</h2>
    <Button size="sm" onclick={refresh} disabled={loading} {loading}>Refresh</Button>
  </div>
  <p class="page-desc">Raw internal state dump — rate limits, configs, navigation, storage, environment.</p>

  {#if data}
    {#each Object.entries(data) as [key, value]}
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div class="section" onclick={() => toggleSection(key)}>
        <div class="section-header">
          <Icon name={expandedSections.has(key) ? 'chevron-down' : 'chevron-right'} size={14} />
          <h3>{key}</h3>
          <span class="section-type"
            >{typeof value === 'object' && value !== null
              ? Array.isArray(value)
                ? `[${(value as any[]).length}]`
                : `{${Object.keys(value as object).length}}`
              : typeof value}</span
          >
        </div>
        {#if expandedSections.has(key)}
          <pre class="json-dump" onclick={(e) => e.stopPropagation()}>{JSON.stringify(value, null, 2)}</pre>
        {/if}
      </div>
    {/each}
  {/if}
</div>

<style>
  .page {
    max-width: 900px;
    margin: 0 auto;
  }

  .page-header-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 4px;
  }

  .section {
    border: 1px solid var(--border);
    border-radius: 8px;
    margin-bottom: 8px;
    background: var(--bg-secondary);
    cursor: pointer;
    overflow: hidden;
  }

  .section-header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 14px;
    color: var(--text-primary);
  }

  .section-header h3 {
    font-size: 0.85rem;
    font-weight: 600;
    margin: 0;
    font-family: 'JetBrains Mono', monospace;
  }

  .section-type {
    font-size: 0.65rem;
    color: var(--text-faint);
    font-family: 'JetBrains Mono', monospace;
    margin-left: auto;
  }

  .json-dump {
    font-size: 0.7rem;
    font-family: 'JetBrains Mono', monospace;
    color: var(--text-muted);
    padding: 12px 16px;
    margin: 0;
    border-top: 1px solid var(--border-subtle);
    background: var(--bg-primary);
    overflow-x: auto;
    max-height: 400px;
    overflow-y: auto;
    cursor: text;
    white-space: pre-wrap;
    word-break: break-all;
  }
</style>
