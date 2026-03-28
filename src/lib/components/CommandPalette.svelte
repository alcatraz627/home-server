<script lang="ts">
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { NAV_GROUPS } from '$lib/constants/nav';
  import { fetchApi } from '$lib/api';
  import Icon from './Icon.svelte';

  export interface CommandAction {
    id: string;
    label: string;
    desc: string;
    icon: string;
    group: string;
    handler: () => void;
  }

  let { open = $bindable(false), actions = [] }: { open: boolean; actions?: CommandAction[] } = $props();

  let query = $state('');
  let selectedIndex = $state(0);
  let inputEl = $state<HTMLInputElement | null>(null);

  type PaletteItem = {
    id: string;
    label: string;
    desc: string;
    icon: string;
    group: string;
    kind: 'page' | 'action' | 'content';
    href?: string;
    handler?: () => void;
  };

  const MODULE_ICONS: Record<string, string> = {
    note: 'file-text',
    kanban: 'trello',
    bookmark: 'bookmark',
    reminder: 'bell',
    keeper: 'star',
  };

  const MODULE_LABELS: Record<string, string> = {
    note: 'Notes',
    kanban: 'Kanban',
    bookmark: 'Bookmarks',
    reminder: 'Reminders',
    keeper: 'Keeper',
  };

  // Flatten nav items + actions into one list
  let navItems = $derived.by(() => {
    const pages: PaletteItem[] = NAV_GROUPS.flatMap((g) =>
      g.items.map((item) => ({
        id: `page:${item.href}`,
        label: item.label,
        desc: item.desc,
        icon: item.icon,
        group: g.label,
        kind: 'page' as const,
        href: item.href,
      })),
    );
    const acts: PaletteItem[] = actions.map((a) => ({
      id: `action:${a.id}`,
      label: a.label,
      desc: a.desc,
      icon: a.icon,
      group: a.group,
      kind: 'action' as const,
      handler: a.handler,
    }));
    return [...acts, ...pages];
  });

  let filteredNav = $derived.by(() => {
    const q = query.toLowerCase().trim();
    if (!q) return navItems;
    return navItems.filter(
      (item) =>
        item.label.toLowerCase().includes(q) ||
        item.desc.toLowerCase().includes(q) ||
        item.group.toLowerCase().includes(q) ||
        (item.href?.toLowerCase().includes(q) ?? false),
    );
  });

  // ── Async content search ─────────────────────────────────────────
  let searchResults = $state<PaletteItem[]>([]);
  let searching = $state(false);
  let searchTimer: ReturnType<typeof setTimeout> | null = null;

  $effect(() => {
    const q = query.trim();
    if (searchTimer) clearTimeout(searchTimer);
    if (q.length < 2) {
      searchResults = [];
      searching = false;
      return;
    }
    searching = true;
    searchTimer = setTimeout(async () => {
      try {
        const res = await fetchApi(`/api/search?q=${encodeURIComponent(q)}`);
        if (!res.ok) return;
        const data: { results: { id: string; module: string; title: string; snippet: string; href: string }[] } =
          await res.json();
        searchResults = data.results.map((r) => ({
          id: `content:${r.id}`,
          label: r.title,
          desc: r.snippet,
          icon: MODULE_ICONS[r.module] ?? 'file',
          group: MODULE_LABELS[r.module] ?? r.module,
          kind: 'content' as const,
          href: r.href,
        }));
      } catch {
        searchResults = [];
      } finally {
        searching = false;
      }
    }, 300);
  });

  let results = $derived([...filteredNav, ...searchResults]);

  // Reset selection when results change
  $effect(() => {
    results; // track
    selectedIndex = 0;
  });

  // Auto-focus input when opened
  $effect(() => {
    if (open) {
      query = '';
      selectedIndex = 0;
      setTimeout(() => inputEl?.focus(), 10);
    }
  });

  function close() {
    open = false;
  }

  function execute(item: PaletteItem) {
    close();
    if (item.kind === 'page' && item.href) {
      goto(item.href);
    } else if (item.kind === 'action' && item.handler) {
      item.handler();
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (!open) return;

    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      close();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      selectedIndex = Math.min(selectedIndex + 1, results.length - 1);
      scrollToSelected();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      selectedIndex = Math.max(selectedIndex - 1, 0);
      scrollToSelected();
    } else if (e.key === 'Enter' && results.length > 0) {
      e.preventDefault();
      execute(results[selectedIndex]);
    }
  }

  function scrollToSelected() {
    setTimeout(() => {
      const el = document.querySelector('.cp-item.selected');
      el?.scrollIntoView({ block: 'nearest' });
    }, 0);
  }

  function isActive(item: PaletteItem): boolean {
    if (item.kind !== 'page' || !item.href) return false;
    const path = $page.url.pathname;
    if (item.href === '/') return path === '/';
    return path.startsWith(item.href);
  }

  function handleOverlayClick(e: MouseEvent) {
    if (e.target === e.currentTarget) close();
  }
</script>

<svelte:window onkeydown={handleKeydown} />

{#if open}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="cp-backdrop" onclick={handleOverlayClick} role="presentation">
    <div class="cp-container" role="dialog" aria-label="Command palette">
      <div class="cp-input-wrap">
        <Icon name="search" size={16} />
        <input
          bind:this={inputEl}
          type="text"
          class="cp-input"
          placeholder="Search pages, actions, and content..."
          bind:value={query}
        />
        {#if searching}
          <span class="cp-searching">searching…</span>
        {:else}
          <kbd class="cp-kbd">Esc</kbd>
        {/if}
      </div>

      <div class="cp-results">
        {#if results.length === 0 && !searching}
          <div class="cp-empty">No matching results</div>
        {:else}
          {#each results as item, i (item.id)}
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <button
              class="cp-item"
              class:selected={i === selectedIndex}
              class:active={isActive(item)}
              class:content={item.kind === 'content'}
              onclick={() => execute(item)}
              onmouseenter={() => (selectedIndex = i)}
            >
              <span class="cp-item-icon"><Icon name={item.icon} size={16} /></span>
              <span class="cp-item-text">
                <span class="cp-item-label">{item.label}</span>
                <span class="cp-item-desc">{item.desc}</span>
              </span>
              <span class="cp-item-group">
                {#if item.kind === 'action'}
                  <span class="cp-action-badge">Action</span>
                {:else if item.kind === 'content'}
                  <span class="cp-content-badge">Content</span>
                {/if}
                {item.group}
              </span>
            </button>
          {/each}
        {/if}
      </div>

      <div class="cp-footer">
        <span class="cp-hint"><kbd>↑↓</kbd> navigate</span>
        <span class="cp-hint"><kbd>↵</kbd> open</span>
        <span class="cp-hint"><kbd>esc</kbd> close</span>
      </div>
    </div>
  </div>
{/if}

<style>
  .cp-backdrop {
    position: fixed;
    inset: 0;
    z-index: 300;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: flex-start;
    justify-content: center;
    padding-top: 15vh;
    animation: cp-fade 0.15s ease-out;
    backdrop-filter: blur(2px);
  }

  @keyframes cp-fade {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  .cp-container {
    width: 90%;
    max-width: 520px;
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: 12px;
    box-shadow: 0 16px 50px rgba(0, 0, 0, 0.4);
    overflow: hidden;
    animation: cp-slide 0.2s ease-out;
  }

  @keyframes cp-slide {
    from {
      opacity: 0;
      transform: translateY(-10px) scale(0.98);
    }
    to {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }

  .cp-input-wrap {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 14px 16px;
    border-bottom: 1px solid var(--border);
    color: var(--text-faint);
  }

  .cp-input {
    flex: 1;
    border: none;
    background: none;
    color: var(--text-primary);
    font-size: 0.95rem;
    font-family: inherit;
    outline: none;
  }

  .cp-input::placeholder {
    color: var(--text-faint);
  }

  .cp-kbd {
    font-size: 0.65rem;
    font-family: 'JetBrains Mono', monospace;
    padding: 2px 6px;
    border: 1px solid var(--border);
    border-radius: 4px;
    color: var(--text-faint);
    background: var(--bg-primary);
  }

  .cp-results {
    max-height: 340px;
    overflow-y: auto;
    padding: 6px;
  }

  .cp-empty {
    padding: 24px 16px;
    text-align: center;
    color: var(--text-faint);
    font-size: 0.82rem;
  }

  .cp-item {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    padding: 8px 12px;
    border: none;
    background: none;
    border-radius: 8px;
    cursor: pointer;
    text-align: left;
    color: var(--text-secondary);
    transition: background 0.1s;
    font-family: inherit;
  }

  .cp-item:hover,
  .cp-item.selected {
    background: var(--bg-hover);
  }

  .cp-item.active {
    border-left: 2px solid var(--accent);
  }

  .cp-item-icon {
    display: flex;
    color: var(--text-faint);
    flex-shrink: 0;
  }

  .cp-item-text {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 1px;
    min-width: 0;
  }

  .cp-item-label {
    font-size: 0.82rem;
    font-weight: 500;
    color: var(--text-primary);
  }

  .cp-item-desc {
    font-size: 0.7rem;
    color: var(--text-faint);
  }

  .cp-item-group {
    font-size: 0.65rem;
    color: var(--text-faint);
    flex-shrink: 0;
    font-family: 'JetBrains Mono', monospace;
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .cp-action-badge {
    font-size: 0.55rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--accent);
    border: 1px solid var(--accent);
    border-radius: 3px;
    padding: 0 3px;
  }

  .cp-content-badge {
    font-size: 0.55rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--success);
    border: 1px solid var(--success);
    border-radius: 3px;
    padding: 0 3px;
  }

  .cp-item.content .cp-item-icon {
    color: var(--success);
  }

  .cp-searching {
    font-size: 0.65rem;
    color: var(--text-faint);
    font-style: italic;
    animation: cp-pulse 1s ease-in-out infinite alternate;
  }

  @keyframes cp-pulse {
    from {
      opacity: 0.4;
    }
    to {
      opacity: 1;
    }
  }

  .cp-footer {
    display: flex;
    gap: 16px;
    padding: 8px 16px;
    border-top: 1px solid var(--border);
    background: var(--bg-primary);
  }

  .cp-hint {
    font-size: 0.65rem;
    color: var(--text-faint);
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .cp-hint kbd {
    font-size: 0.6rem;
    font-family: 'JetBrains Mono', monospace;
    padding: 1px 4px;
    border: 1px solid var(--border);
    border-radius: 3px;
    background: var(--bg-secondary);
  }
</style>
