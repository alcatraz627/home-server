<script lang="ts">
  import type { PageData } from './$types';
  import { toast } from '$lib/toast';

  interface Bookmark {
    id: string;
    url: string;
    title: string;
    description: string;
    tags: string[];
    createdAt: string;
  }

  let { data } = $props<{ data: PageData }>();
  let bookmarks = $state<Bookmark[]>(data.bookmarks ?? []);

  let showForm = $state(false);
  let editingId = $state<string | null>(null);
  let formUrl = $state('');
  let formTitle = $state('');
  let formDesc = $state('');
  let formTags = $state('');
  let search = $state('');
  let activeTag = $state<string | null>(null);
  let confirmDeleteId = $state<string | null>(null);

  const allTags = $derived.by(() => {
    const tags = new Set<string>();
    bookmarks.forEach((b) => b.tags.forEach((t) => tags.add(t)));
    return [...tags].sort();
  });

  const filtered = $derived.by(() => {
    let result = bookmarks;
    if (activeTag) result = result.filter((b) => b.tags.includes(activeTag!));
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (b) =>
          b.title.toLowerCase().includes(q) ||
          b.url.toLowerCase().includes(q) ||
          b.description.toLowerCase().includes(q) ||
          b.tags.some((t) => t.toLowerCase().includes(q)),
      );
    }
    return result;
  });

  function resetForm() {
    formUrl = '';
    formTitle = '';
    formDesc = '';
    formTags = '';
    editingId = null;
    showForm = false;
  }

  function startEdit(b: Bookmark) {
    editingId = b.id;
    formUrl = b.url;
    formTitle = b.title;
    formDesc = b.description;
    formTags = b.tags.join(', ');
    showForm = true;
  }

  async function saveBookmark() {
    if (!formUrl.trim()) {
      toast.error('URL is required');
      return;
    }

    const payload: any = {
      url: formUrl.trim(),
      title: formTitle.trim() || formUrl.trim(),
      description: formDesc.trim(),
      tags: formTags.trim(),
    };

    if (editingId) {
      payload._action = 'update';
      payload.id = editingId;
    }

    try {
      const res = await fetch('/api/bookmarks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Failed to save');

      if (editingId) {
        const updated = await res.json();
        bookmarks = bookmarks.map((b) => (b.id === editingId ? updated : b));
        toast.success('Bookmark updated');
      } else {
        const created = await res.json();
        bookmarks = [created, ...bookmarks];
        toast.success('Bookmark added');
      }
      resetForm();
    } catch {
      toast.error('Failed to save bookmark');
    }
  }

  async function deleteBookmark(id: string) {
    try {
      const res = await fetch('/api/bookmarks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ _action: 'delete', id }),
      });
      if (!res.ok) throw new Error('Failed');
      bookmarks = bookmarks.filter((b) => b.id !== id);
      confirmDeleteId = null;
      toast.success('Bookmark deleted');
    } catch {
      toast.error('Failed to delete bookmark');
    }
  }

  function exportHTML() {
    const lines = [
      '<!DOCTYPE NETSCAPE-Bookmark-file-1>',
      '<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">',
      '<TITLE>Bookmarks</TITLE>',
      '<H1>Bookmarks</H1>',
      '<DL><p>',
    ];
    for (const b of bookmarks) {
      const ts = Math.floor(new Date(b.createdAt).getTime() / 1000);
      lines.push(
        `  <DT><A HREF="${b.url}" ADD_DATE="${ts}"${b.tags.length ? ` TAGS="${b.tags.join(',')}"` : ''}>${b.title}</A>`,
      );
      if (b.description) lines.push(`  <DD>${b.description}`);
    }
    lines.push('</DL><p>');
    const blob = new Blob([lines.join('\n')], { type: 'text/html' });
    const link = document.createElement('a');
    link.download = 'bookmarks.html';
    link.href = URL.createObjectURL(blob);
    link.click();
    toast.success('Bookmarks exported');
  }

  function faviconUrl(url: string): string {
    try {
      const u = new URL(url);
      return `https://www.google.com/s2/favicons?domain=${u.hostname}&sz=32`;
    } catch {
      return '';
    }
  }
</script>

<div class="page">
  <div class="header">
    <h1>Bookmarks</h1>
    <div class="header-actions">
      <button
        class="btn-primary"
        onclick={() => {
          resetForm();
          showForm = true;
        }}>Add Bookmark</button
      >
      <button class="btn-secondary" onclick={exportHTML}>Export HTML</button>
    </div>
  </div>

  {#if showForm}
    <div class="card form-card">
      <h2>{editingId ? 'Edit' : 'Add'} Bookmark</h2>
      <div class="form-grid">
        <label>
          <span>URL *</span>
          <input type="url" bind:value={formUrl} placeholder="https://..." />
        </label>
        <label>
          <span>Title</span>
          <input type="text" bind:value={formTitle} placeholder="Page title" />
        </label>
        <label class="full-width">
          <span>Description</span>
          <input type="text" bind:value={formDesc} placeholder="Optional description" />
        </label>
        <label class="full-width">
          <span>Tags (comma-separated)</span>
          <input type="text" bind:value={formTags} placeholder="dev, tools, reference" />
        </label>
      </div>
      <div class="form-actions">
        <button class="btn-primary" onclick={saveBookmark}>Save</button>
        <button class="btn-secondary" onclick={resetForm}>Cancel</button>
      </div>
    </div>
  {/if}

  <div class="search-bar">
    <input type="text" bind:value={search} placeholder="Search bookmarks..." />
  </div>

  {#if allTags.length > 0}
    <div class="tag-pills">
      <button class="pill" class:active={activeTag === null} onclick={() => (activeTag = null)}>All</button>
      {#each allTags as tag}
        <button
          class="pill"
          class:active={activeTag === tag}
          onclick={() => (activeTag = activeTag === tag ? null : tag)}>{tag}</button
        >
      {/each}
    </div>
  {/if}

  {#if filtered.length === 0}
    <div class="card empty">
      <p>No bookmarks found.</p>
    </div>
  {:else}
    <div class="bookmark-list">
      {#each filtered as bm, i (bm.id)}
        <div class="card bookmark-item card-stagger" style="animation-delay: {i * 40}ms">
          <div class="bookmark-main">
            <img
              src={faviconUrl(bm.url)}
              alt=""
              class="favicon"
              onerror={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = 'none';
              }}
            />
            <div class="bookmark-info">
              <a href={bm.url} target="_blank" rel="noopener" class="bookmark-title">{bm.title}</a>
              <span class="bookmark-url">{bm.url}</span>
              {#if bm.description}
                <span class="bookmark-desc">{bm.description}</span>
              {/if}
              {#if bm.tags.length > 0}
                <div class="bookmark-tags">
                  {#each bm.tags as tag}
                    <span class="tag">{tag}</span>
                  {/each}
                </div>
              {/if}
            </div>
          </div>
          <div class="bookmark-actions">
            <button class="btn-sm" onclick={() => startEdit(bm)}>Edit</button>
            {#if confirmDeleteId === bm.id}
              <button class="btn-sm btn-danger" onclick={() => deleteBookmark(bm.id)}>Confirm</button>
              <button class="btn-sm" onclick={() => (confirmDeleteId = null)}>Cancel</button>
            {:else}
              <button class="btn-sm btn-danger" onclick={() => (confirmDeleteId = bm.id)}>Delete</button>
            {/if}
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .page {
    padding: 1.5rem;
    max-width: 900px;
    margin: 0 auto;
  }
  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1.5rem;
    flex-wrap: wrap;
    gap: 0.75rem;
  }
  h1 {
    margin: 0;
    color: var(--text-primary);
  }
  .header-actions {
    display: flex;
    gap: 0.5rem;
  }
  .form-card {
    padding: 1.25rem;
    margin-bottom: 1.5rem;
  }
  .form-card h2 {
    margin: 0 0 1rem;
    font-size: 1.1rem;
    color: var(--text-primary);
  }
  .form-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.75rem;
  }
  .full-width {
    grid-column: 1 / -1;
  }
  label {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
  }
  label span {
    font-size: 0.8rem;
    color: var(--text-secondary);
    font-weight: 500;
  }
  input {
    padding: 0.5rem 0.75rem;
    border: 1px solid var(--border);
    border-radius: 6px;
    background: var(--bg-primary);
    color: var(--text-primary);
    font-size: 0.9rem;
  }
  .form-actions {
    display: flex;
    gap: 0.5rem;
    margin-top: 1rem;
  }
  .search-bar {
    margin-bottom: 1rem;
  }
  .search-bar input {
    width: 100%;
    box-sizing: border-box;
  }
  .tag-pills {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
    margin-bottom: 1rem;
  }
  .pill {
    padding: 0.3rem 0.7rem;
    border: 1px solid var(--border);
    border-radius: 20px;
    background: var(--bg-secondary);
    color: var(--text-secondary);
    cursor: pointer;
    font-size: 0.8rem;
  }
  .pill.active {
    background: var(--accent);
    color: #fff;
    border-color: var(--accent);
  }
  .bookmark-list {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }
  .bookmark-item {
    padding: 1rem;
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 1rem;
  }
  .bookmark-main {
    display: flex;
    gap: 0.75rem;
    min-width: 0;
    flex: 1;
  }
  .favicon {
    width: 24px;
    height: 24px;
    margin-top: 2px;
    flex-shrink: 0;
    border-radius: 4px;
  }
  .bookmark-info {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    min-width: 0;
  }
  .bookmark-title {
    color: var(--accent);
    font-weight: 600;
    text-decoration: none;
    font-size: 0.95rem;
  }
  .bookmark-title:hover {
    text-decoration: underline;
  }
  .bookmark-url {
    color: var(--text-muted);
    font-size: 0.75rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .bookmark-desc {
    color: var(--text-secondary);
    font-size: 0.85rem;
  }
  .bookmark-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 0.3rem;
    margin-top: 0.25rem;
  }
  .tag {
    padding: 0.15rem 0.5rem;
    background: var(--bg-secondary);
    border-radius: 10px;
    font-size: 0.7rem;
    color: var(--text-muted);
  }
  .bookmark-actions {
    display: flex;
    gap: 0.35rem;
    flex-shrink: 0;
  }
  .empty {
    padding: 2rem;
    text-align: center;
    color: var(--text-muted);
  }
  .btn-primary,
  .btn-secondary {
    padding: 0.5rem 1rem;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-weight: 600;
    font-size: 0.85rem;
  }
  .btn-primary {
    background: var(--accent);
    color: #fff;
  }
  .btn-secondary {
    background: var(--bg-secondary);
    color: var(--text-primary);
    border: 1px solid var(--border);
  }
  .btn-sm {
    padding: 0.3rem 0.6rem;
    border: 1px solid var(--border);
    border-radius: 4px;
    background: var(--bg-secondary);
    color: var(--text-secondary);
    cursor: pointer;
    font-size: 0.75rem;
  }
  .btn-danger {
    color: var(--danger);
    border-color: var(--danger);
  }
  .btn-primary:hover {
    opacity: 0.9;
  }
</style>
