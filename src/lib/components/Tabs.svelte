<script lang="ts">
  let {
    tabs,
    active = $bindable((tabs[0] as { id: string })?.id ?? ''),
    size = 'md',
    class: className = '',
  } = $props<{
    tabs: { id: string; label: string; count?: number }[];
    active: string;
    size?: 'sm' | 'md';
    class?: string;
  }>();

  function handleKeydown(e: KeyboardEvent) {
    const idx = tabs.findIndex((t: { id: string }) => t.id === active);
    if (e.key === 'ArrowRight' && idx < tabs.length - 1) {
      active = tabs[idx + 1].id;
      e.preventDefault();
    } else if (e.key === 'ArrowLeft' && idx > 0) {
      active = tabs[idx - 1].id;
      e.preventDefault();
    }
  }
</script>

<div class="hs-tabs hs-tabs-{size} {className}" role="tablist" onkeydown={handleKeydown}>
  {#each tabs as tab (tab.id)}
    <button
      class="hs-tab"
      class:active={active === tab.id}
      role="tab"
      aria-selected={active === tab.id}
      tabindex={active === tab.id ? 0 : -1}
      onclick={() => (active = tab.id)}
    >
      {tab.label}
      {#if tab.count !== undefined}
        <span class="hs-tab-count">{tab.count}</span>
      {/if}
    </button>
  {/each}
</div>

<style>
  .hs-tabs {
    display: flex;
    gap: 2px;
    border-bottom: 1px solid var(--border);
    margin-bottom: 16px;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
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
    transition: all 0.15s;
    border-radius: 0;
  }

  .hs-tabs-sm .hs-tab {
    padding: 6px 12px;
    font-size: 0.75rem;
  }
  .hs-tabs-md .hs-tab {
    font-size: 0.82rem;
  }

  .hs-tab:hover {
    color: var(--text-primary);
  }

  .hs-tab.active {
    color: var(--accent);
    border-bottom-color: var(--accent);
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
