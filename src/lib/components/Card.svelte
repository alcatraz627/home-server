<script lang="ts">
  import type { Snippet } from 'svelte';

  let {
    variant = 'default',
    padding = 'md',
    class: className = '',
    children,
    header,
    footer,
    onclick,
  }: {
    variant?: 'default' | 'outlined' | 'elevated';
    padding?: 'sm' | 'md' | 'lg' | 'none';
    class?: string;
    children: Snippet;
    header?: Snippet;
    footer?: Snippet;
    onclick?: (e: MouseEvent) => void;
  } = $props();
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<!-- svelte-ignore a11y_click_events_have_key_events -->
<div
  class="hs-card hs-card-{variant} hs-card-pad-{padding} {className}"
  class:clickable={!!onclick}
  {onclick}
  role={onclick ? 'button' : undefined}
  tabindex={onclick ? 0 : undefined}
>
  {#if header}
    <div class="hs-card-header">
      {@render header()}
    </div>
  {/if}
  <div class="hs-card-body">
    {@render children()}
  </div>
  {#if footer}
    <div class="hs-card-footer">
      {@render footer()}
    </div>
  {/if}
</div>

<style>
  .hs-card {
    background: var(--bg-secondary);
    border-radius: 10px;
    overflow: hidden;
  }

  .hs-card-default {
    border: 1px solid var(--border);
  }

  .hs-card-outlined {
    border: 1px solid var(--border);
    background: transparent;
  }

  .hs-card-elevated {
    border: 1px solid var(--border-subtle);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  }

  .hs-card.clickable {
    cursor: pointer;
    transition:
      border-color 0.15s,
      box-shadow 0.15s;
  }

  .hs-card.clickable:hover {
    border-color: var(--accent);
  }

  .hs-card-pad-none .hs-card-body {
    padding: 0;
  }

  .hs-card-pad-sm .hs-card-body {
    padding: 10px 14px;
  }

  .hs-card-pad-md .hs-card-body {
    padding: 16px 18px;
  }

  .hs-card-pad-lg .hs-card-body {
    padding: 20px 24px;
  }

  .hs-card-header {
    padding: 12px 18px;
    border-bottom: 1px solid var(--border);
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }

  .hs-card-footer {
    padding: 10px 18px;
    border-top: 1px solid var(--border);
    display: flex;
    align-items: center;
    gap: 8px;
  }
</style>
