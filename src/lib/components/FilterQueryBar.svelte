<script lang="ts">
  import Icon from './Icon.svelte';

  interface Props {
    /** Bound to the filter query string */
    query: string;
    /** Placeholder text for the input */
    placeholder?: string;
    /** Number of matching items (null = no filter active) */
    matchCount?: number | null;
    /** localStorage key for saved filters (unique per page) */
    storageKey?: string;
  }

  let {
    query = $bindable(''),
    placeholder = 'Filter: p1, #tag, overdue, today, or combine with & |',
    matchCount = null,
    storageKey = '',
  }: Props = $props();

  let showSaveFilter = $state(false);
  let saveFilterName = $state('');
  let savedFilters = $state<{ name: string; query: string }[]>([]);

  function loadSavedFilters() {
    if (!storageKey) return;
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) savedFilters = JSON.parse(raw);
    } catch {}
  }

  function persistFilters() {
    if (!storageKey) return;
    localStorage.setItem(storageKey, JSON.stringify(savedFilters));
  }

  function saveFilter() {
    if (!saveFilterName.trim() || !query.trim()) return;
    savedFilters = [
      ...savedFilters.filter((f) => f.name !== saveFilterName.trim()),
      { name: saveFilterName.trim(), query: query.trim() },
    ];
    persistFilters();
    saveFilterName = '';
    showSaveFilter = false;
  }

  function deleteSavedFilter(name: string) {
    savedFilters = savedFilters.filter((f) => f.name !== name);
    persistFilters();
  }

  $effect(() => {
    loadSavedFilters();
  });
</script>

<div class="fq-bar">
  <div class="fq-input-wrap" class:active={!!query}>
    <Icon name="search" size={13} />
    <input class="fq-input" type="text" bind:value={query} {placeholder} />
    {#if matchCount !== null}
      <span class="fq-count">{matchCount} match{matchCount !== 1 ? 'es' : ''}</span>
    {/if}
    {#if query}
      <button
        class="fq-clear"
        onclick={() => {
          query = '';
          showSaveFilter = false;
        }}
        title="Clear filter"
      >
        <Icon name="close" size={12} />
      </button>
    {/if}
  </div>
  {#if query && storageKey}
    <button class="fq-save-btn" onclick={() => (showSaveFilter = !showSaveFilter)} title="Save filter">
      <Icon name="bookmark" size={13} />
    </button>
  {/if}
  {#if savedFilters.length > 0}
    <div class="fq-saved">
      {#each savedFilters as sf}
        <button class="fq-chip" onclick={() => (query = sf.query)} title={sf.query}>
          {sf.name}
        </button>
        <button class="fq-chip-del" onclick={() => deleteSavedFilter(sf.name)} title="Delete saved filter">
          <Icon name="close" size={10} />
        </button>
      {/each}
    </div>
  {/if}
</div>
{#if showSaveFilter}
  <div class="fq-save-panel">
    <input class="fq-save-input" type="text" bind:value={saveFilterName} placeholder="Filter name..." />
    <button class="fq-save-confirm" onclick={saveFilter} disabled={!saveFilterName.trim()}>Save</button>
    <button class="fq-save-cancel" onclick={() => (showSaveFilter = false)}>Cancel</button>
  </div>
{/if}

<style>
  .fq-bar {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 12px;
    flex-wrap: wrap;
  }
  .fq-input-wrap {
    display: flex;
    align-items: center;
    gap: 6px;
    flex: 1;
    min-width: 240px;
    padding: 6px 10px;
    border: 1px solid var(--border);
    border-radius: 7px;
    background: var(--bg-secondary);
    color: var(--text-muted);
    transition: border-color 0.15s;
  }
  .fq-input-wrap.active {
    border-color: var(--accent);
  }
  .fq-input {
    flex: 1;
    border: none;
    background: none;
    font-size: 0.8rem;
    color: var(--text-primary);
    font-family: inherit;
    outline: none;
  }
  .fq-input::placeholder {
    color: var(--text-faint);
  }
  .fq-count {
    font-size: 0.68rem;
    color: var(--accent);
    font-weight: 600;
    flex-shrink: 0;
  }
  .fq-clear {
    background: none;
    border: none;
    padding: 1px 2px;
    cursor: pointer;
    color: var(--text-faint);
    display: flex;
    align-items: center;
    border-radius: 3px;
    transition: color 0.1s;
  }
  .fq-clear:hover {
    color: var(--text-primary);
  }
  .fq-save-btn {
    display: flex;
    align-items: center;
    padding: 6px 9px;
    border: 1px solid var(--border);
    border-radius: 7px;
    background: none;
    color: var(--text-muted);
    cursor: pointer;
    transition:
      border-color 0.15s,
      color 0.15s;
  }
  .fq-save-btn:hover {
    border-color: var(--accent);
    color: var(--accent);
  }
  .fq-saved {
    display: flex;
    align-items: center;
    gap: 4px;
    flex-wrap: wrap;
  }
  .fq-chip {
    display: flex;
    align-items: center;
    padding: 3px 8px;
    border: 1px solid var(--border);
    border-radius: 12px;
    background: none;
    font-size: 0.72rem;
    color: var(--text-muted);
    cursor: pointer;
    font-family: inherit;
    transition:
      border-color 0.1s,
      color 0.1s;
  }
  .fq-chip:hover {
    border-color: var(--accent);
    color: var(--accent);
  }
  .fq-chip-del {
    display: flex;
    align-items: center;
    margin-left: -2px;
    padding: 3px 4px;
    background: none;
    border: none;
    color: var(--text-faint);
    cursor: pointer;
    border-radius: 4px;
    transition: color 0.1s;
  }
  .fq-chip-del:hover {
    color: var(--danger);
  }
  .fq-save-panel {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 10px;
    padding: 8px 12px;
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: 7px;
  }
  .fq-save-input {
    flex: 1;
    padding: 4px 8px;
    border: 1px solid var(--border);
    border-radius: 5px;
    background: var(--bg-primary);
    color: var(--text-primary);
    font-size: 0.8rem;
    font-family: inherit;
    outline: none;
  }
  .fq-save-input:focus {
    border-color: var(--accent);
  }
  .fq-save-confirm {
    padding: 4px 10px;
    background: var(--accent);
    color: white;
    border: none;
    border-radius: 5px;
    font-size: 0.78rem;
    cursor: pointer;
    font-family: inherit;
  }
  .fq-save-confirm:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
  .fq-save-cancel {
    padding: 4px 10px;
    background: none;
    color: var(--text-muted);
    border: 1px solid var(--border);
    border-radius: 5px;
    font-size: 0.78rem;
    cursor: pointer;
    font-family: inherit;
  }
</style>
