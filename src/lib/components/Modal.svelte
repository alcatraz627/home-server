<script lang="ts">
  import type { Snippet } from 'svelte';
  import Icon from '$lib/components/Icon.svelte';

  let {
    open = $bindable(false),
    title = '',
    width = '500px',
    onclose,
    children,
    footer,
  }: {
    open: boolean;
    title?: string;
    width?: string;
    onclose?: () => void;
    children: Snippet;
    footer?: Snippet;
  } = $props();

  /** Move the node to document.body so it escapes any overflow/transform ancestors */
  function portal(node: HTMLElement) {
    document.body.appendChild(node);
    return {
      destroy() {
        node.remove();
      },
    };
  }

  function close() {
    open = false;
    onclose?.();
  }

  function handleKeydown(e: KeyboardEvent) {
    if (!open) return;
    if (e.key === 'Escape') {
      e.stopPropagation();
      close();
    }
  }

  function handleOverlayClick(e: MouseEvent) {
    if (e.target === e.currentTarget) {
      close();
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

{#if open}
  <div use:portal class="modal-portal">
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="modal-backdrop" onclick={handleOverlayClick} role="presentation">
      <div class="modal-container" style="max-width: {width};" role="dialog" aria-label={title || 'Modal'}>
        {#if title}
          <div class="modal-header">
            <h3>{title}</h3>
            <button class="modal-close" onclick={close} aria-label="Close"><Icon name="close" size={14} /></button>
          </div>
        {:else}
          <button class="modal-close modal-close-floating" onclick={close} aria-label="Close"
            ><Icon name="close" size={14} /></button
          >
        {/if}
        <div class="modal-body">
          {@render children()}
        </div>
        {#if footer}
          <div class="modal-footer">
            {@render footer()}
          </div>
        {/if}
      </div>
    </div>
  </div>
{/if}

<style>
  .modal-backdrop {
    position: fixed;
    inset: 0;
    z-index: 200;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    animation: backdrop-fade 0.2s ease-out;
  }

  @keyframes backdrop-fade {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  .modal-container {
    width: 90%;
    max-height: 85vh;
    display: flex;
    flex-direction: column;
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: 10px;
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.4);
    position: relative;
    animation: modal-slide-up 0.25s ease-out;
  }

  @keyframes modal-slide-up {
    from {
      opacity: 0;
      transform: translateY(20px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 18px;
    border-bottom: 1px solid var(--border);
    position: sticky;
    top: 0;
    background: var(--bg-secondary);
    border-radius: 10px 10px 0 0;
    z-index: 1;
  }

  .modal-header h3 {
    margin: 0;
    font-size: 0.95rem;
    font-weight: 600;
    color: var(--text-primary);
  }

  .modal-close {
    background: none;
    border: 1px solid transparent;
    border-radius: 5px;
    color: var(--text-muted);
    font-size: 0.85rem;
    cursor: pointer;
    padding: 2px 6px;
    line-height: 1.4;
    transition:
      border-color 0.15s,
      color 0.15s,
      background 0.15s;
  }

  .modal-close:hover {
    border-color: var(--border);
    color: var(--text-secondary);
    background: var(--bg-hover);
  }

  .modal-close-floating {
    position: absolute;
    top: 10px;
    right: 10px;
    z-index: 1;
  }

  .modal-body {
    padding: 18px;
    overflow-y: auto;
    flex: 1;
  }

  .modal-footer {
    padding: 12px 18px;
    border-top: 1px solid var(--border);
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 8px;
  }
</style>
