<script lang="ts">
  import { browser } from '$app/environment';
  import { tick } from 'svelte';

  let {
    tabs,
    active = $bindable((tabs[0] as { id: string })?.id ?? ''),
    size = 'md',
    compact = false,
    syncHash = false,
    class: className = '',
  } = $props<{
    tabs: { id: string; label: string; count?: number }[];
    active: string;
    size?: 'sm' | 'md';
    compact?: boolean;
    syncHash?: boolean;
    class?: string;
  }>();

  // URL hash sync — read hash on mount, write on change
  $effect(() => {
    if (browser && syncHash) {
      const hash = location.hash.slice(1);
      if (hash && tabs.some((t: { id: string }) => t.id === hash)) {
        active = hash;
      }
    }
  });

  let tabsEl = $state<HTMLElement | null>(null);
  let indicatorStyle = $state('');

  function updateIndicator() {
    if (!tabsEl) return;
    const activeEl = tabsEl.querySelector('.hs-tab.active') as HTMLElement;
    if (!activeEl) {
      indicatorStyle = 'opacity: 0;';
      return;
    }
    const left = activeEl.offsetLeft;
    const width = activeEl.offsetWidth;
    indicatorStyle = `left: ${left}px; width: ${width}px; opacity: 1;`;
  }

  $effect(() => {
    active; // track
    tick().then(updateIndicator);
  });

  function setActive(id: string) {
    active = id;
    if (browser && syncHash) {
      history.replaceState(null, '', `#${id}`);
    }
  }

  // Listen for popstate (back/forward) to sync tabs
  function handlePopState() {
    if (!syncHash || !browser) return;
    const hash = location.hash.slice(1);
    if (hash && tabs.some((t: { id: string }) => t.id === hash)) {
      active = hash;
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    const idx = tabs.findIndex((t: { id: string }) => t.id === active);
    if (e.key === 'ArrowRight' && idx < tabs.length - 1) {
      setActive(tabs[idx + 1].id);
      e.preventDefault();
    } else if (e.key === 'ArrowLeft' && idx > 0) {
      setActive(tabs[idx - 1].id);
      e.preventDefault();
    }
  }
</script>

<svelte:window onpopstate={handlePopState} />

<div
  class="hs-tabs hs-tabs-{size} {className}"
  class:compact
  role="tablist"
  tabindex="0"
  onkeydown={handleKeydown}
  bind:this={tabsEl}
>
  {#each tabs as tab (tab.id)}
    <button
      class="hs-tab"
      class:active={active === tab.id}
      role="tab"
      aria-selected={active === tab.id}
      tabindex={active === tab.id ? 0 : -1}
      onclick={() => setActive(tab.id)}
    >
      {tab.label}
      {#if tab.count !== undefined}
        <span class="hs-tab-count">{tab.count}</span>
      {/if}
    </button>
  {/each}
  <span class="hs-tab-indicator" style={indicatorStyle}></span>
</div>

<style>
  .hs-tabs {
    display: flex;
    gap: 2px;
    border-bottom: 1px solid var(--border);
    margin-bottom: 16px;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    position: relative;
  }

  .hs-tab {
    padding: 8px 16px;
    border: none;
    border-bottom: 2px solid transparent;
    background: none;
    color: var(--text-muted);
    font-family: inherit;
    font-weight: 500;
    cursor: pointer;
    white-space: nowrap;
    transition:
      color 0.15s,
      background 0.15s;
    border-radius: 0;
  }

  .hs-tabs-sm .hs-tab {
    padding: 6px 12px;
    font-size: 0.75rem;
  }
  .hs-tabs-md .hs-tab {
    font-size: 0.82rem;
  }

  /* Compact mode */
  .hs-tabs.compact {
    gap: 0;
    border-bottom: none;
    background: var(--bg-hover);
    border-radius: 8px;
    padding: 3px;
  }

  .compact .hs-tab {
    border-bottom: none;
    border-radius: 6px;
    padding: 5px 12px;
    font-size: 0.72rem;
  }

  .compact .hs-tab.active {
    background: var(--bg-secondary);
    color: var(--accent);
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);
  }

  .compact .hs-tab-indicator {
    display: none;
  }

  .hs-tab:hover {
    color: var(--text-primary);
  }

  .hs-tab.active {
    color: var(--accent);
    border-bottom-color: transparent;
  }

  /* Sliding indicator */
  .hs-tab-indicator {
    position: absolute;
    bottom: 0;
    height: 2px;
    background: var(--accent);
    border-radius: 2px 2px 0 0;
    transition:
      left 0.25s cubic-bezier(0.4, 0, 0.2, 1),
      width 0.25s cubic-bezier(0.4, 0, 0.2, 1);
    opacity: 0;
  }

  .hs-tab-count {
    font-size: 0.68rem;
    background: var(--bg-hover);
    padding: 0 5px;
    border-radius: 8px;
    margin-left: 4px;
    color: var(--text-faint);
  }

  .hs-tab.active .hs-tab-count {
    background: var(--accent-bg);
    color: var(--accent);
  }

  /* Hide scrollbar but allow scroll */
  .hs-tabs::-webkit-scrollbar {
    height: 0;
  }
</style>
