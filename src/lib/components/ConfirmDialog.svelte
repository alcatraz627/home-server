<script lang="ts">
  import Button from './Button.svelte';
  import Icon from './Icon.svelte';

  let {
    open = $bindable(false),
    title = 'Are you sure?',
    message = '',
    confirmLabel = 'Confirm',
    cancelLabel = 'Cancel',
    confirmVariant = 'danger' as 'danger' | 'primary',
    confirmIcon = '',
    onconfirm,
    oncancel,
  }: {
    open: boolean;
    title?: string;
    message?: string;
    confirmLabel?: string;
    cancelLabel?: string;
    confirmVariant?: 'danger' | 'primary';
    confirmIcon?: string;
    onconfirm: () => void;
    oncancel?: () => void;
  } = $props();

  function handleConfirm() {
    open = false;
    onconfirm();
  }

  function handleCancel() {
    open = false;
    oncancel?.();
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') handleCancel();
  }

  function handleBackdropClick(e: MouseEvent) {
    if (e.target === e.currentTarget) handleCancel();
  }
</script>

{#if open}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="backdrop" onkeydown={handleKeydown} onclick={handleBackdropClick}>
    <div class="dialog" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title">
      <div class="dialog-header">
        <h3 id="confirm-title">{title}</h3>
        <button class="close-btn" onclick={handleCancel} aria-label="Close">
          <Icon name="close" size={16} />
        </button>
      </div>
      {#if message}
        <p class="dialog-message">{message}</p>
      {/if}
      <div class="dialog-actions">
        <Button variant="ghost" size="sm" onclick={handleCancel}>{cancelLabel}</Button>
        <Button
          variant={confirmVariant === 'danger' ? 'danger' : 'primary'}
          size="sm"
          icon={confirmIcon}
          onclick={handleConfirm}
        >
          {confirmLabel}
        </Button>
      </div>
    </div>
  </div>
{/if}

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    animation: fade-in 0.15s ease;
  }

  @keyframes fade-in {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  .dialog {
    background: var(--bg-primary);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 20px;
    min-width: 320px;
    max-width: 440px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
    animation: dialog-in 0.15s ease;
  }

  @keyframes dialog-in {
    from {
      transform: scale(0.95);
      opacity: 0;
    }
    to {
      transform: scale(1);
      opacity: 1;
    }
  }

  .dialog-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 8px;
  }

  .dialog-header h3 {
    margin: 0;
    font-size: 0.95rem;
    font-weight: 600;
    color: var(--text-primary);
  }

  .close-btn {
    background: none;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    padding: 2px;
    border-radius: 4px;
  }

  .close-btn:hover {
    color: var(--text-primary);
    background: var(--bg-hover);
  }

  .dialog-message {
    margin: 0 0 16px;
    font-size: 0.82rem;
    color: var(--text-secondary);
    line-height: 1.5;
  }

  .dialog-actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
  }
</style>
