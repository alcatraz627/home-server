<script lang="ts">
  import Icon from './Icon.svelte';

  let {
    active = false,
    icon = '',
    color = '',
    count,
    dot = false,
    pulse = false,
    size = 'sm',
    class: className = '',
    onclick,
    children,
  }: {
    active?: boolean;
    icon?: string;
    color?: string;
    count?: number;
    dot?: boolean;
    pulse?: boolean;
    size?: 'sm' | 'md';
    class?: string;
    onclick?: (e: MouseEvent) => void;
    children?: any;
  } = $props();
</script>

<button
  class="int-chip int-chip-{size} {className}"
  class:active
  style={color ? `--chip-color: ${color}` : ''}
  {onclick}
>
  {#if dot}
    <span class="int-chip-dot" class:pulse style={color ? `background: ${color}` : ''}></span>
  {/if}
  {#if icon}
    <Icon name={icon} size={size === 'sm' ? 12 : 14} />
  {/if}
  {#if children}
    {@render children()}
  {/if}
  {#if count !== undefined}
    <span class="int-chip-count">{count}</span>
  {/if}
</button>

<style>
  .int-chip {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    background: var(--bg-hover);
    border: 1px solid transparent;
    border-radius: 6px;
    cursor: pointer;
    color: var(--text-muted);
    font-family: inherit;
    white-space: nowrap;
    transition:
      border-color 0.15s,
      background 0.15s,
      color 0.15s;
  }

  .int-chip-sm {
    padding: 3px 10px;
    font-size: 0.7rem;
  }

  .int-chip-md {
    padding: 5px 12px;
    font-size: 0.78rem;
  }

  .int-chip:hover {
    border-color: var(--chip-color, var(--border));
    color: var(--chip-color, var(--text-primary));
  }

  .int-chip.active {
    border-color: var(--chip-color, var(--accent));
    color: var(--chip-color, var(--accent));
    background: var(--bg-primary);
  }

  .int-chip-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--chip-color, var(--text-faint));
    flex-shrink: 0;
  }

  .int-chip-dot.pulse {
    animation: chipPulse 2s ease-in-out infinite;
  }

  @keyframes chipPulse {
    0%,
    100% {
      opacity: 1;
    }
    50% {
      opacity: 0.4;
    }
  }

  .int-chip-count {
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.65rem;
    font-weight: 600;
    opacity: 0.7;
  }
</style>
