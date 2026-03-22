<script lang="ts">
  import { renderMarkdown } from '$lib/markdown';
  import { browser } from '$app/environment';
  import { page } from '$app/stores';
  import { onMount } from 'svelte';
  import type { PageData } from './$types';
  import type { DocFile, DocCategory } from './+page.server';
  import Icon from '$lib/components/Icon.svelte';

  let { data } = $props<{ data: PageData }>();

  let search = $state('');
  let expanded = $state<Record<string, boolean>>({});
  let categoryExpanded = $state<Record<string, boolean>>({});

  // Initialize all categories as expanded
  onMount(() => {
    for (const cat of data.categories) {
      if (!(cat.id in categoryExpanded)) {
        categoryExpanded[cat.id] = true;
      }
    }

    // Handle hash-based navigation
    handleHash();
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  });

  function handleHash() {
    if (!browser) return;
    const hash = window.location.hash.slice(1);
    if (!hash) return;

    // Find the file matching the hash (e.g., #files -> files.md)
    for (const cat of data.categories) {
      for (const file of cat.files) {
        const slug = file.name.replace('.md', '');
        if (slug === hash) {
          categoryExpanded[cat.id] = true;
          expanded[file.path] = true;
          // Scroll to the file after a tick
          setTimeout(() => {
            const el = document.getElementById(`doc-${slug}`);
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }, 100);
          return;
        }
      }
    }
  }

  function toggleFile(filePath: string) {
    expanded[filePath] = !expanded[filePath];
  }

  function toggleCategory(catId: string) {
    categoryExpanded[catId] = !categoryExpanded[catId];
  }

  function slugFromFile(file: DocFile): string {
    return file.name.replace('.md', '');
  }

  let filteredCategories = $derived.by(() => {
    if (search.trim() === '') return data.categories;
    const q = search.toLowerCase();
    return data.categories
      .map((cat: DocCategory) => ({
        ...cat,
        files: cat.files.filter(
          (f: DocFile) =>
            f.name.toLowerCase().includes(q) || f.path.toLowerCase().includes(q) || f.content.toLowerCase().includes(q),
        ),
      }))
      .filter((cat: DocCategory) => cat.files.length > 0);
  });
</script>

<div class="docs-page">
  <div class="docs-header">
    <h2 class="page-title">Documentation</h2>
    <input
      class="search-input"
      type="text"
      placeholder="Search files..."
      bind:value={search}
      aria-label="Search documentation files"
    />
  </div>
  <p class="page-desc">
    Browse project documentation files organized by category. Search and expand sections to read inline.
  </p>

  {#if filteredCategories.length === 0}
    <p class="empty">No files match your search.</p>
  {:else}
    {#each filteredCategories as cat (cat.id)}
      {@const isCatOpen = categoryExpanded[cat.id] !== false}
      <div class="category-section" id="cat-{cat.id}">
        <button class="category-header" onclick={() => toggleCategory(cat.id)} aria-expanded={isCatOpen}>
          <span class="category-chevron" class:expanded={isCatOpen}><Icon name="chevron-right" size={12} /></span>
          <span class="category-label">{cat.label}</span>
          <span class="category-count">{cat.files.length}</span>
        </button>

        {#if isCatOpen}
          <ul class="file-list">
            {#each cat.files as file (file.path)}
              {@const isOpen = !!expanded[file.path]}
              <li class="file-item" class:open={isOpen} id="doc-{slugFromFile(file)}">
                <button class="file-header" onclick={() => toggleFile(file.path)} aria-expanded={isOpen}>
                  <span class="file-icon">{isOpen ? '\u25BE' : '\u25B8'}</span>
                  <span class="file-name">{file.name}</span>
                  <span class="file-path">{file.path}</span>
                </button>
                {#if isOpen}
                  <div class="rendered-doc">
                    {@html `<div class="md-content">${renderMarkdown(file.content)}</div>`}
                  </div>
                {/if}
              </li>
            {/each}
          </ul>
        {/if}
      </div>
    {/each}
  {/if}
</div>

<style>
  .docs-page {
    max-width: 900px;
  }

  .docs-header {
    display: flex;
    align-items: center;
    gap: 16px;
    margin-bottom: 20px;
    flex-wrap: wrap;
  }

  .docs-header h2 {
    font-size: 1.4rem;
    font-weight: 600;
    color: var(--text-primary);
    margin: 0;
  }

  .search-input {
    flex: 1;
    min-width: 200px;
    padding: 8px 12px;
    border: 1px solid var(--border);
    border-radius: 6px;
    background: var(--bg-secondary);
    color: var(--text-primary);
    font-size: 0.875rem;
    outline: none;
    transition: border-color 0.15s;
  }

  .search-input:focus {
    border-color: var(--accent);
  }

  .search-input::placeholder {
    color: var(--text-faint);
  }

  .empty {
    color: var(--text-muted);
    font-size: 0.9rem;
    padding: 24px 0;
  }

  /* ── Category sections ────────────────────────────────────────────────────── */
  .category-section {
    margin-bottom: 16px;
  }

  .category-header {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 10px 12px;
    background: none;
    border: none;
    cursor: pointer;
    color: var(--text-primary);
    text-align: left;
    border-bottom: 1px solid var(--border);
    transition: background 0.15s;
  }

  .category-header:hover {
    background: var(--bg-hover);
  }

  .category-chevron {
    font-size: 0.75rem;
    color: var(--accent);
    transition: transform 0.2s ease;
    display: inline-block;
    width: 12px;
    flex-shrink: 0;
  }

  .category-chevron.expanded {
    transform: rotate(90deg);
  }

  .category-label {
    font-size: 0.85rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--text-secondary);
  }

  .category-count {
    font-size: 0.72rem;
    color: var(--text-faint);
    font-family: 'JetBrains Mono', monospace;
    margin-left: auto;
  }

  /* ── File list ────────────────────────────────────────────────────────────── */
  .file-list {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding-top: 6px;
  }

  .file-item {
    border: 1px solid var(--border);
    border-radius: 8px;
    overflow: hidden;
    background: var(--bg-secondary);
    transition: border-color 0.15s;
  }

  .file-item.open {
    border-color: var(--accent);
  }

  .file-header {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    padding: 12px 16px;
    background: none;
    border: none;
    color: var(--text-primary);
    cursor: pointer;
    text-align: left;
    font-size: 0.9rem;
    transition: background 0.15s;
  }

  .file-header:hover {
    background: var(--bg-hover);
  }

  .file-icon {
    color: var(--accent);
    font-size: 0.75rem;
    width: 12px;
    flex-shrink: 0;
  }

  .file-name {
    font-weight: 600;
    font-family: 'JetBrains Mono', monospace;
    color: var(--text-primary);
    flex-shrink: 0;
  }

  .file-path {
    font-size: 0.78rem;
    color: var(--text-faint);
    font-family: 'JetBrains Mono', monospace;
    margin-left: auto;
  }

  /* Rendered document container */
  .rendered-doc {
    padding: 16px 20px;
    border-top: 1px solid var(--border);
    background: var(--bg-primary);
    overflow: auto;
  }

  /* Markdown styling */
  .rendered-doc :global(.md-content) {
    line-height: 1.7;
    font-size: 0.9rem;
  }
  .rendered-doc :global(.md-content h1) {
    font-size: 1.5rem;
    margin: 16px 0 8px;
    border-bottom: 1px solid var(--border);
    padding-bottom: 6px;
  }
  .rendered-doc :global(.md-content h2) {
    font-size: 1.3rem;
    margin: 14px 0 6px;
    border-bottom: 1px solid var(--border-subtle);
    padding-bottom: 4px;
  }
  .rendered-doc :global(.md-content h3) {
    font-size: 1.1rem;
    margin: 12px 0 6px;
  }
  .rendered-doc :global(.md-content h4),
  .rendered-doc :global(.md-content h5),
  .rendered-doc :global(.md-content h6) {
    font-size: 1rem;
    margin: 10px 0 4px;
  }
  .rendered-doc :global(.md-content p) {
    margin: 8px 0;
  }
  .rendered-doc :global(.md-content ul),
  .rendered-doc :global(.md-content ol) {
    padding-left: 24px;
    margin: 8px 0;
  }
  .rendered-doc :global(.md-content li) {
    margin: 4px 0;
  }
  .rendered-doc :global(.md-content blockquote) {
    border-left: 3px solid var(--border);
    padding-left: 12px;
    color: var(--text-muted);
    margin: 8px 0;
  }
  .rendered-doc :global(.md-content hr) {
    border: none;
    border-top: 1px solid var(--border);
    margin: 16px 0;
  }
  .rendered-doc :global(.md-content a) {
    color: var(--accent);
  }
  .rendered-doc :global(.md-content code) {
    background: var(--code-bg);
    padding: 2px 6px;
    border-radius: 3px;
    font-size: 0.85em;
  }
  .rendered-doc :global(.md-content pre) {
    background: var(--code-bg);
    padding: 12px;
    border-radius: 6px;
    overflow-x: auto;
    margin: 8px 0;
  }
  .rendered-doc :global(.md-content pre code) {
    padding: 0;
    background: none;
  }
  .rendered-doc :global(.md-content strong) {
    color: var(--text-primary);
  }
</style>
