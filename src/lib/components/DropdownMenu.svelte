<script lang="ts">
  import type { Snippet } from 'svelte';
  import Icon from './Icon.svelte';
  import Button from './Button.svelte';

  interface MenuItem {
    icon?: string;
    label: string;
    onclick: () => void;
    variant?: 'default' | 'danger';
    disabled?: boolean;
    separator?: false;
  }

  interface MenuSeparator {
    separator: true;
  }

  type MenuEntry = MenuItem | MenuSeparator;

  let {
    items,
    triggerIcon = 'more',
    triggerLabel = 'Actions',
    size = 'xs',
    align = 'right',
    trigger,
  }: {
    items: MenuEntry[];
    triggerIcon?: string;
    triggerLabel?: string;
    size?: 'xs' | 'sm';
    align?: 'left' | 'right';
    trigger?: Snippet;
  } = $props();

  let open = $state(false);
  let menuEl = $state<HTMLDivElement | null>(null);

  function toggle() {
    open = !open;
  }

  function handleItemClick(item: MenuItem) {
    if (item.disabled) return;
    open = false;
    item.onclick();
  }

  function handleClickOutside(e: MouseEvent) {
    if (menuEl && !menuEl.contains(e.target as Node)) {
      open = false;
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') open = false;
  }
</script>

<svelte:window onclick={handleClickOutside} onkeydown={handleKeydown} />

<div class="dropdown-menu" bind:this={menuEl}>
  {#if trigger}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div onclick={toggle}>
      {@render trigger()}
    </div>
  {:else}
    <Button variant="ghost" {size} icon={triggerIcon} iconOnly onclick={toggle} />
  {/if}

  {#if open}
    <div class="dropdown-panel dropdown-{align}">
      {#each items as entry}
        {#if entry.separator}
          <div class="dropdown-sep"></div>
        {:else}
          <button
            class="dropdown-item"
            class:dropdown-item-danger={entry.variant === 'danger'}
            class:dropdown-item-disabled={entry.disabled}
            onclick={() => handleItemClick(entry)}
            disabled={entry.disabled}
          >
            {#if entry.icon}
              <Icon name={entry.icon} size={14} />
            {/if}
            <span>{entry.label}</span>
          </button>
        {/if}
      {/each}
    </div>
  {/if}
</div>

<style>
  .dropdown-menu {
    position: relative;
    display: inline-flex;
  }

  .dropdown-panel {
    position: absolute;
    top: 100%;
    margin-top: 4px;
    min-width: 160px;
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: 8px;
    box-shadow: var(--shadow);
    z-index: 50;
    padding: 4px;
    display: flex;
    flex-direction: column;
  }

  .dropdown-right {
    right: 0;
  }

  .dropdown-left {
    left: 0;
  }

  .dropdown-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 10px;
    font-size: 0.78rem;
    font-family: inherit;
    color: var(--text-secondary);
    background: none;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    width: 100%;
    text-align: left;
    transition:
      background 0.12s,
      color 0.12s;
  }

  .dropdown-item:hover:not(:disabled) {
    background: var(--bg-hover);
    color: var(--text-primary);
  }

  .dropdown-item-danger {
    color: var(--danger);
  }

  .dropdown-item-danger:hover:not(:disabled) {
    background: var(--danger-bg);
    color: var(--danger);
  }

  .dropdown-item-disabled {
    opacity: 0.45;
    cursor: default;
  }

  .dropdown-sep {
    height: 1px;
    background: var(--border-subtle);
    margin: 4px 6px;
  }
</style>
