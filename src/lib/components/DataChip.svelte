<script lang="ts">
  import Icon from './Icon.svelte';

  let {
    label = '',
    value = '',
    icon = '',
    color = '',
    size = 'sm',
    class: className = '',
  }: {
    label?: string;
    value?: string;
    icon?: string;
    color?: string;
    size?: 'sm' | 'md';
    class?: string;
  } = $props();
</script>

<span class="data-chip data-chip-{size} {className}" style={color ? `--chip-color: ${color}` : ''}>
  {#if icon}
    <Icon name={icon} size={size === 'sm' ? 12 : 14} />
  {/if}
  {#if label}
    <span class="data-chip-label">{label}</span>
  {/if}
  {#if value}
    <span class="data-chip-value" style={color ? `color: ${color}` : ''}>{value}</span>
  {/if}
</span>

<style>
  .data-chip {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    background: var(--bg-hover);
    border-radius: 6px;
    white-space: nowrap;
    color: var(--text-muted);
    font-family: 'JetBrains Mono', monospace;
  }

  .data-chip-sm {
    padding: 3px 8px;
    font-size: 0.68rem;
  }

  .data-chip-md {
    padding: 4px 10px;
    font-size: 0.75rem;
  }

  .data-chip-label {
    color: var(--text-faint);
  }

  .data-chip-value {
    font-weight: 600;
    color: var(--text-primary);
  }
</style>
