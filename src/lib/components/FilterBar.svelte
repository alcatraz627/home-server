<script lang="ts">
  import type { Snippet } from 'svelte';
  import SearchInput from './SearchInput.svelte';

  let {
    search = false,
    searchValue = $bindable(''),
    searchPlaceholder = 'Search...',
    children,
    actions,
  }: {
    search?: boolean;
    searchValue?: string;
    searchPlaceholder?: string;
    children?: Snippet;
    actions?: Snippet;
  } = $props();
</script>

<div class="filter-bar">
  {#if search}
    <SearchInput bind:value={searchValue} placeholder={searchPlaceholder} clearable />
  {/if}
  {#if children}
    <div class="filter-controls">
      {@render children()}
    </div>
  {/if}
  {#if actions}
    <div class="filter-actions">
      {@render actions()}
    </div>
  {/if}
</div>

<style>
  .filter-bar {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
    margin-bottom: 12px;
  }

  .filter-controls {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
  }

  .filter-actions {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-left: auto;
  }
</style>
