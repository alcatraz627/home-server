<script lang="ts">
  import type { Snippet } from 'svelte';

  let {
    label,
    value = '',
    mono = false,
    code = false,
    children,
  }: {
    label: string;
    value?: string;
    mono?: boolean;
    code?: boolean;
    children?: Snippet;
  } = $props();
</script>

<div class="info-row">
  <span class="info-row-label">{label}</span>
  <span class="info-row-value" class:mono>
    {#if children}
      {@render children()}
    {:else if code}
      <code>{value}</code>
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

  .info-row-value code {
    font-size: 0.72rem;
    background: var(--code-bg);
    padding: 1px 5px;
    border-radius: 3px;
    font-family: 'JetBrains Mono', monospace;
  }
</style>
