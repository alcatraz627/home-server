<script lang="ts">
  import { ICONS } from '$lib/icons';
  let { name, size = 16, class: className = '' } = $props<{ name: string; size?: number; class?: string }>();
  const svg = $derived(ICONS[name] || ICONS['help']);
</script>

<span
  class="icon {className}"
  style="width: {size}px; height: {size}px; display: inline-flex; align-items: center; justify-content: center;"
>
  {@html svg}
</span>

<style>
  .icon :global(svg) {
    width: 100%;
    height: 100%;
    fill: currentColor;
  }
</style>
