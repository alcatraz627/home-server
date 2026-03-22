<script lang="ts">
  import Icon from './Icon.svelte';

  let {
    variant = 'default',
    size = 'md',
    icon = undefined,
    iconOnly = false,
    loading = false,
    disabled = false,
    confirm = false,
    confirmText = 'Sure?',
    class: className = '',
    onclick,
    children,
  } = $props<{
    variant?: 'default' | 'primary' | 'danger' | 'ghost' | 'accent';
    size?: 'xs' | 'sm' | 'md' | 'lg';
    icon?: string;
    iconOnly?: boolean;
    loading?: boolean;
    disabled?: boolean;
    confirm?: boolean;
    confirmText?: string;
    class?: string;
    onclick?: (e: MouseEvent) => void;
    children?: any;
  }>();

  let confirming = $state(false);
  let confirmTimer: ReturnType<typeof setTimeout> | null = null;

  function handleClick(e: MouseEvent) {
    if (loading || disabled) return;
    if (confirm && !confirming) {
      confirming = true;
      confirmTimer = setTimeout(() => {
        confirming = false;
      }, 3000);
      return;
    }
    if (confirming) {
      confirming = false;
      if (confirmTimer) clearTimeout(confirmTimer);
    }
    onclick?.(e);
  }

  const iconSize = $derived(size === 'xs' ? 12 : size === 'sm' ? 14 : size === 'lg' ? 18 : 16);
</script>

<button
  class="hs-btn hs-btn-{confirming ? 'danger' : variant} hs-btn-{size} {iconOnly ? 'hs-btn-icon-only' : ''} {className}"
  disabled={disabled || loading}
  onclick={handleClick}
>
  {#if loading}
    <span class="hs-btn-spinner"></span>
  {:else if icon}
    <Icon name={icon} size={iconSize} />
  {/if}
  {#if confirming}
    <span>{confirmText}</span>
  {:else if children && !iconOnly}
    {@render children()}
  {/if}
</button>

<style>
  .hs-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    border-radius: var(--radius, 6px);
    font-family: inherit;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s ease;
    white-space: nowrap;
    line-height: 1.2;
    border: 1px solid var(--border);
  }

  .hs-btn:disabled {
    opacity: 0.45;
    cursor: default;
    pointer-events: none;
  }

  .hs-btn:active:not(:disabled) {
    transform: scale(0.97);
  }

  /* Sizes */
  .hs-btn-xs {
    padding: 2px 6px;
    font-size: 0.65rem;
    min-height: 24px;
  }
  .hs-btn-sm {
    padding: 4px 10px;
    font-size: 0.75rem;
    min-height: 28px;
  }
  .hs-btn-md {
    padding: 6px 14px;
    font-size: 0.82rem;
    min-height: 34px;
  }
  .hs-btn-lg {
    padding: 8px 20px;
    font-size: 0.9rem;
    min-height: 40px;
  }

  .hs-btn-icon-only {
    padding: 4px;
    min-width: unset;
  }

  .hs-btn-icon-only.hs-btn-xs {
    padding: 2px;
    min-height: 24px;
    min-width: 24px;
  }
  .hs-btn-icon-only.hs-btn-sm {
    padding: 3px;
    min-height: 28px;
    min-width: 28px;
  }
  .hs-btn-icon-only.hs-btn-md {
    padding: 4px;
    min-height: 34px;
    min-width: 34px;
  }
  .hs-btn-icon-only.hs-btn-lg {
    padding: 6px;
    min-height: 40px;
    min-width: 40px;
  }

  /* Variants */
  .hs-btn-default {
    background: var(--btn-bg);
    border-color: var(--border);
    color: var(--text-secondary);
  }
  .hs-btn-default:hover:not(:disabled) {
    border-color: var(--accent);
    color: var(--text-primary);
  }

  .hs-btn-primary {
    background: var(--accent);
    border-color: var(--accent);
    color: white;
  }
  .hs-btn-primary:hover:not(:disabled) {
    filter: brightness(1.1);
  }

  .hs-btn-danger {
    background: transparent;
    border-color: var(--danger);
    color: var(--danger);
  }
  .hs-btn-danger:hover:not(:disabled) {
    background: var(--danger-bg);
  }

  .hs-btn-ghost {
    background: transparent;
    border-color: transparent;
    color: var(--text-muted);
  }
  .hs-btn-ghost:hover:not(:disabled) {
    background: var(--bg-hover);
    color: var(--text-primary);
  }

  .hs-btn-accent {
    background: var(--accent-bg);
    border-color: var(--accent);
    color: var(--accent);
  }
  .hs-btn-accent:hover:not(:disabled) {
    filter: brightness(1.1);
  }

  /* Spinner */
  .hs-btn-spinner {
    width: 14px;
    height: 14px;
    border: 2px solid currentColor;
    border-top-color: transparent;
    border-radius: 50%;
    animation: spin 0.6s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
</style>
