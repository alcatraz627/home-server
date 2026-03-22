<script lang="ts">
  import Icon from '$lib/components/Icon.svelte';

  interface Props {
    icon?: string;
    title: string;
    hint?: string;
    actionLabel?: string;
    onaction?: () => void;
  }

  let { icon = 'info', title, hint, actionLabel, onaction }: Props = $props();
</script>

<div class="empty-state">
  <div class="empty-icon"><Icon name={icon} size={36} /></div>
  <p class="empty-title">{title}</p>
  {#if hint}
    <p class="empty-hint">{hint}</p>
  {/if}
  {#if actionLabel && onaction}
    <button class="empty-btn" onclick={onaction}>{actionLabel}</button>
  {/if}
</div>

<style>
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 48px 20px;
    color: var(--text-muted);
  }

  .empty-icon {
    opacity: 0.3;
    margin-bottom: 4px;
  }

  .empty-title {
    font-size: 0.95rem;
    font-weight: 500;
  }

  .empty-hint {
    font-size: 0.75rem;
    color: var(--text-faint);
    max-width: 300px;
    text-align: center;
    line-height: 1.5;
  }

  .empty-btn {
    margin-top: 8px;
    padding: 8px 20px;
    font-size: 0.85rem;
    border-radius: 8px;
    border: 1px solid var(--accent);
    background: var(--accent-bg);
    color: var(--accent);
    cursor: pointer;
    font-family: inherit;
    transition: all 0.15s;
  }

  .empty-btn:hover {
    background: var(--accent);
    color: var(--bg-primary);
  }
</style>
