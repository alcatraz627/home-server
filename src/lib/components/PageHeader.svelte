<script lang="ts">
  import type { Snippet } from 'svelte';

  let {
    title,
    description = '',
    children,
  }: {
    title: string;
    description?: string;
    children?: Snippet;
  } = $props();
</script>

<div class="page-header">
  <div class="page-header-top">
    <h2 class="page-title">{title}</h2>
    {#if children}
      <div class="page-header-actions">
        {@render children()}
      </div>
    {/if}
  </div>
  {#if description}
    <p class="page-desc">{description}</p>
  {/if}
</div>

<style>
  .page-header {
    margin-bottom: 4px;
  }

  .page-header-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 4px;
  }

  .page-header-actions {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
  }
</style>
