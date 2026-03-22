<script lang="ts">
  import type { Snippet } from 'svelte';

  let {
    label,
    value = '',
    mono = false,
    children,
  }: {
    label: string;
    value?: string;
    mono?: boolean;
    children?: Snippet;
  } = $props();
</script>

<div class="info-row">
  <span class="info-row-label">{label}</span>
  <span class="info-row-value" class:mono>
    {#if children}
      {@render children()}
    {:else}
      {value}
    {/if}
  </span>
</div>

<style>
  .info-row {
    display: flex;
    align-items: baseline;
    gap: 8px;
    padding: 3px 0;
    font-size: 0.78rem;
  }

  .info-row-label {
    color: var(--text-faint);
    font-size: 0.7rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    min-width: 70px;
    flex-shrink: 0;
  }

  .info-row-value {
    color: var(--text-primary);
    word-break: break-all;
  }

  .info-row-value.mono {
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.72rem;
  }
</style>
