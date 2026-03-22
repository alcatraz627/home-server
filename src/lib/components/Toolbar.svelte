<script lang="ts">
  import type { Snippet } from 'svelte';

  let {
    gap = '8px',
    wrap = false,
    align = 'center',
    justify = 'flex-start',
    class: className = '',
    children,
  }: {
    gap?: string;
    wrap?: boolean;
    align?: 'center' | 'flex-start' | 'flex-end' | 'stretch';
    justify?: 'flex-start' | 'flex-end' | 'space-between' | 'center';
    class?: string;
    children: Snippet;
  } = $props();
</script>

<div class="hs-toolbar {className}" style="gap: {gap}; align-items: {align}; justify-content: {justify};" class:wrap>
  {@render children()}
</div>

<style>
  .hs-toolbar {
    display: flex;
    align-items: center;
    padding: 8px 0;
  }

  .hs-toolbar.wrap {
    flex-wrap: wrap;
  }
</style>
