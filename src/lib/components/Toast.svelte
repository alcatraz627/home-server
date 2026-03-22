<!-- TODO: Replace Unicode icons with lucide-svelte when installed (npm i lucide-svelte) -->
<script lang="ts">
  import { toast } from '$lib/toast';
  import { fade } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';

  function slideInFromRight(node: Element, { duration = 200 }: { duration?: number } = {}) {
    return {
      duration,
      easing: cubicOut,
      css: (t: number) => `
        transform: translateX(${(1 - t) * 110}%);
        opacity: ${t};
      `,
    };
  }
</script>

{#if $toast.length > 0}
  <div class="toast-container">
    {#each $toast as t (t.id)}
      <div
        class="toast toast-{t.type}"
        role="alert"
        in:slideInFromRight={{ duration: 220 }}
        out:fade={{ duration: 160 }}
      >
        <span class="toast-icon">
          {#if t.type === 'success'}✓
          {:else if t.type === 'error'}✗
          {:else if t.type === 'warning'}⚠
          {:else}ℹ
          {/if}
        </span>
        <span class="toast-message">{t.message}</span>
        <button class="toast-close" onclick={() => toast.dismiss(t.id)} aria-label="Dismiss">×</button>
        <div class="toast-progress" style="animation-duration: {t.duration}ms"></div>
      </div>
    {/each}
  </div>
{/if}

<style>
  .toast-container {
    position: fixed;
    bottom: 20px;
    right: 20px;
    z-index: 9999;
    display: flex;
    flex-direction: column;
    gap: 8px;
    max-width: 400px;
  }

  .toast {
    position: relative;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 16px;
    border-radius: 8px;
    border: 1px solid var(--border);
    background: var(--bg-secondary);
    color: var(--text-primary);
    font-size: 0.85rem;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.35);
    backdrop-filter: blur(8px);
    overflow: hidden;
  }

  /* Left border accent — 4px, overrides the 1px base border on the left */
  .toast-success {
    border-left: 4px solid var(--success);
  }
  .toast-error {
    border-left: 4px solid var(--danger);
  }
  .toast-warning {
    border-left: 4px solid var(--warning);
  }
  .toast-info {
    border-left: 4px solid var(--accent);
  }

  .toast-icon {
    font-size: 1.1rem;
    font-weight: 700;
    flex-shrink: 0;
    width: 20px;
    text-align: center;
    line-height: 1;
  }

  .toast-success .toast-icon {
    color: var(--success);
  }
  .toast-error .toast-icon {
    color: var(--danger);
  }
  .toast-warning .toast-icon {
    color: var(--warning);
  }
  .toast-info .toast-icon {
    color: var(--accent);
  }

  .toast-message {
    flex: 1;
    line-height: 1.4;
  }

  .toast-close {
    background: none;
    border: none;
    color: var(--text-faint);
    font-size: 1.1rem;
    cursor: pointer;
    padding: 0;
    line-height: 1;
    flex-shrink: 0;
    min-width: 28px;
    min-height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
    transition:
      color 0.15s,
      background 0.15s;
  }

  .toast-close:hover {
    color: var(--text-primary);
    background: var(--bg-hover, rgba(255, 255, 255, 0.08));
  }

  /* Progress bar — sits at the bottom, shrinks left to right over the toast duration */
  .toast-progress {
    position: absolute;
    bottom: 0;
    left: 0;
    height: 2px;
    width: 100%;
    animation: toast-progress linear forwards;
    transform-origin: left center;
  }

  .toast-success .toast-progress {
    background: var(--success);
  }
  .toast-error .toast-progress {
    background: var(--danger);
  }
  .toast-warning .toast-progress {
    background: var(--warning);
  }
  .toast-info .toast-progress {
    background: var(--accent);
  }

  @keyframes toast-progress {
    from {
      width: 100%;
    }
    to {
      width: 0%;
    }
  }

  @media (max-width: 640px) {
    .toast-container {
      bottom: 10px;
      right: 10px;
      left: 10px;
      max-width: none;
    }
  }
</style>
