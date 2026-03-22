<script lang="ts">
  import type { Snippet } from 'svelte';

  let {
    text,
    position = 'top',
    children,
  }: {
    text: string;
    position?: 'top' | 'bottom' | 'left' | 'right';
    children: Snippet;
  } = $props();

  let visible = $state(false);
  let delayTimer: ReturnType<typeof setTimeout> | null = null;

  function show() {
    delayTimer = setTimeout(() => {
      visible = true;
    }, 200);
  }

  function hide() {
    if (delayTimer) {
      clearTimeout(delayTimer);
      delayTimer = null;
    }
    visible = false;
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<span class="tooltip-wrap" onmouseenter={show} onmouseleave={hide} onfocusin={show} onfocusout={hide}>
  {@render children()}
  {#if visible}
    <span class="tooltip tooltip-{position}" role="tooltip">{text}</span>
  {/if}
</span>

<style>
  .tooltip-wrap {
    position: relative;
    display: inline-flex;
    align-items: center;
  }

  .tooltip {
    position: absolute;
    z-index: 1000;
    background: var(--bg-secondary);
    color: var(--text-primary);
    font-size: 0.72rem;
    font-weight: 500;
    padding: 4px 8px;
    border-radius: 4px;
    white-space: nowrap;
    pointer-events: none;
    border: 1px solid var(--border);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    animation: tooltip-fade-in 0.15s ease-out;
  }

  /* Arrow shared base */
  .tooltip::after {
    content: '';
    position: absolute;
    width: 6px;
    height: 6px;
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    transform: rotate(45deg);
  }

  /* ── Top ──────────────────────────────────────────────────────────────────────── */
  .tooltip-top {
    bottom: calc(100% + 6px);
    left: 50%;
    translate: -50% 0;
  }

  .tooltip-top::after {
    bottom: -4px;
    left: 50%;
    translate: -50% 0;
    border-top: none;
    border-left: none;
  }

  @keyframes tooltip-fade-in {
    from {
      opacity: 0;
      translate: -50% 4px;
    }
    to {
      opacity: 1;
      translate: -50% 0;
    }
  }

  /* ── Bottom ──────────────────────────────────────────────────────────────────── */
  .tooltip-bottom {
    top: calc(100% + 6px);
    left: 50%;
    translate: -50% 0;
  }

  .tooltip-bottom::after {
    top: -4px;
    left: 50%;
    translate: -50% 0;
    border-bottom: none;
    border-right: none;
  }

  /* ── Left ───────────────────────────────────────────────────────────────────── */
  .tooltip-left {
    right: calc(100% + 6px);
    top: 50%;
    translate: 0 -50%;
  }

  .tooltip-left::after {
    right: -4px;
    top: 50%;
    translate: 0 -50%;
    border-bottom: none;
    border-left: none;
  }

  /* ── Right ──────────────────────────────────────────────────────────────────── */
  .tooltip-right {
    left: calc(100% + 6px);
    top: 50%;
    translate: 0 -50%;
  }

  .tooltip-right::after {
    left: -4px;
    top: 50%;
    translate: 0 -50%;
    border-top: none;
    border-right: none;
  }
</style>
