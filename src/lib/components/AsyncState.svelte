<script lang="ts">
  import type { Snippet } from 'svelte';
  import Loading from './Loading.svelte';
  import EmptyState from './EmptyState.svelte';

  let {
    loading = false,
    error = '',
    empty = false,
    emptyTitle = 'Nothing here',
    emptyIcon = 'inbox',
    emptyHint = '',
    emptyActionLabel = '',
    onemptyaction,
    loadingVariant = 'skeleton',
    loadingCount = 3,
    loadingHeight = '60px',
    loadingColumns,
    children,
  }: {
    loading?: boolean;
    error?: string;
    empty?: boolean;
    emptyTitle?: string;
    emptyIcon?: string;
    emptyHint?: string;
    emptyActionLabel?: string;
    onemptyaction?: () => void;
    loadingVariant?: 'skeleton' | 'spinner' | 'dots';
    loadingCount?: number;
    loadingHeight?: string;
    loadingColumns?: number;
    children: Snippet;
  } = $props();
</script>

{#if loading}
  <Loading variant={loadingVariant} count={loadingCount} height={loadingHeight} columns={loadingColumns} />
{:else if error}
  <div class="async-error">
    <p class="error-msg">{error}</p>
  </div>
{:else if empty}
  <EmptyState
    icon={emptyIcon}
    title={emptyTitle}
    hint={emptyHint}
    actionLabel={emptyActionLabel}
    onaction={onemptyaction}
  />
{:else}
  {@render children()}
{/if}

<style>
  .async-error {
    padding: 16px;
    text-align: center;
  }

  .error-msg {
    color: var(--danger);
    font-size: 0.85rem;
  }
</style>
