<script lang="ts">
  import type { Snippet } from 'svelte';
  import Icon from '$lib/components/Icon.svelte';
  import Button from '$lib/components/Button.svelte';

  let {
    title = 'Something went wrong',
    compact = false,
    children,
  }: {
    title?: string;
    compact?: boolean;
    children: Snippet;
  } = $props();
</script>

<svelte:boundary onerror={(err) => console.error('[ErrorBoundary]', err)}>
  {@render children()}

  {#snippet failed(error, reset)}
    <div class="error-boundary" class:compact>
      <div class="error-content">
        <Icon name="alert-triangle" size={compact ? 20 : 32} class="error-icon" />
        <div class="error-text">
          <p class="error-title">{title}</p>
          <p class="error-detail">{error instanceof Error ? error.message : 'Unknown error'}</p>
        </div>
        <Button size="sm" onclick={reset}>Retry</Button>
      </div>
    </div>
  {/snippet}
</svelte:boundary>

<style>
  .error-boundary {
    border: 1px solid var(--danger, #ef4444);
    border-radius: 8px;
    padding: 20px;
    background: color-mix(in srgb, var(--danger, #ef4444) 6%, var(--bg-primary));
  }

  .error-boundary.compact {
    padding: 12px 14px;
  }

  .error-content {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .compact .error-content {
    gap: 8px;
  }

  .error-content :global(.error-icon) {
    color: var(--danger, #ef4444);
    flex-shrink: 0;
  }

  .error-text {
    flex: 1;
    min-width: 0;
  }

  .error-title {
    margin: 0;
    font-weight: 600;
    font-size: 0.85rem;
    color: var(--text-primary);
  }

  .error-detail {
    margin: 4px 0 0;
    font-size: 0.8rem;
    color: var(--text-muted);
    font-family: 'JetBrains Mono', monospace;
    word-break: break-word;
  }

  .compact .error-title {
    font-size: 0.8rem;
  }

  .compact .error-detail {
    font-size: 0.75rem;
    margin-top: 2px;
  }
</style>
