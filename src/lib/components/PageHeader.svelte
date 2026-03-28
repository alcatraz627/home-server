<script lang="ts">
  import type { Snippet } from 'svelte';
  import Icon from './Icon.svelte';

  let {
    title,
    icon = '',
    description = '',
    titleExtra,
    children,
  }: {
    title: string;
    icon?: string;
    description?: string;
    titleExtra?: Snippet;
    children?: Snippet;
  } = $props();
</script>

<div class="page-header">
  <div class="page-header-top">
    <div class="page-title-row">
      {#if icon}
        <Icon name={icon} size={20} />
      {/if}
      <h2 class="page-title">{title}</h2>
      {#if titleExtra}
        {@render titleExtra()}
      {/if}
    </div>
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
    flex-wrap: wrap;
  }

  .page-title-row {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .page-header-actions {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
  }
</style>
