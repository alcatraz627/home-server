<script lang="ts">
  import { fetchApi, postJson } from '$lib/api';
  import { toast } from '$lib/toast';
  import { onMount } from 'svelte';
  import { useShortcuts, SHORTCUT_DEFAULTS } from '$lib/shortcuts';
  import Button from '$lib/components/Button.svelte';
  import Icon from '$lib/components/Icon.svelte';
  import SearchInput from '$lib/components/SearchInput.svelte';
  import EmptyState from '$lib/components/EmptyState.svelte';

  interface NoteBlock {
    id: string;
    type: 'text' | 'heading1' | 'heading2' | 'heading3' | 'bullet' | 'numbered' | 'todo' | 'code' | 'divider' | 'quote';
    content: string;
    checked?: boolean;
    language?: string;
  }

  interface NoteSummary {
    id: string;
    title: string;
    icon: string;
    parentId: string | null;
    childCount: number;
    createdAt: string;
    updatedAt: string;
  }

  interface Note {
    id: string;
    title: string;
    icon: string;
    blocks: NoteBlock[];
    parentId: string | null;
    createdAt: string;
    updatedAt: string;
  }

  let notes = $state<NoteSummary[]>([]);
  let activeNote = $state<Note | null>(null);
  let search = $state('');
  let saving = $state(false);
  let saveTimer: ReturnType<typeof setTimeout> | null = null;

  let filtered = $derived.by(() => {
    if (!search) return notes;
    const q = search.toLowerCase();
    return notes.filter((n) => n.title.toLowerCase().includes(q));
  });

  async function loadNotes() {
    try {
      const res = await fetchApi('/api/notes');
      if (res.ok) {
        const data = await res.json();
        notes = data.notes;
      }
    } catch {}
  }

  async function openNote(id: string) {
    try {
      const res = await fetchApi(`/api/notes?id=${id}`);
      if (res.ok) activeNote = await res.json();
    } catch {
      toast.error('Failed to open note');
    }
  }

  async function createNote() {
    try {
      const res = await postJson('/api/notes', { title: 'Untitled' });
      if (res.ok) {
        const note = await res.json();
        await loadNotes();
        activeNote = note;
      }
    } catch {
      toast.error('Failed to create note');
    }
  }

  async function deleteNote(id: string) {
    try {
      await postJson('/api/notes', { id }, { method: 'DELETE' });
      if (activeNote?.id === id) activeNote = null;
      await loadNotes();
      toast.success('Note deleted');
    } catch {
      toast.error('Failed to delete note');
    }
  }

  function autoSave() {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => saveNote(), 1000);
  }

  async function saveNote() {
    if (!activeNote) return;
    saving = true;
    try {
      await postJson('/api/notes', activeNote, { method: 'PUT' });
      // Update sidebar title
      notes = notes.map((n) =>
        n.id === activeNote!.id ? { ...n, title: activeNote!.title, updatedAt: new Date().toISOString() } : n,
      );
    } catch {}
    saving = false;
  }

  function addBlock(afterIndex: number, type: NoteBlock['type'] = 'text') {
    if (!activeNote) return;
    const newBlock: NoteBlock = {
      id: Math.random().toString(36).slice(2, 10),
      type,
      content: '',
      checked: type === 'todo' ? false : undefined,
    };
    activeNote.blocks = [
      ...activeNote.blocks.slice(0, afterIndex + 1),
      newBlock,
      ...activeNote.blocks.slice(afterIndex + 1),
    ];
    autoSave();
    // Focus the new block after render
    setTimeout(() => {
      const el = document.querySelector(`[data-block-id="${newBlock.id}"]`) as HTMLElement;
      el?.focus();
    }, 50);
  }

  function removeBlock(index: number) {
    if (!activeNote || activeNote.blocks.length <= 1) return;
    activeNote.blocks = activeNote.blocks.filter((_, i) => i !== index);
    autoSave();
  }

  function handleBlockKeydown(e: KeyboardEvent, index: number) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      addBlock(index);
    }
    if (
      e.key === 'Backspace' &&
      activeNote &&
      activeNote.blocks[index].content === '' &&
      activeNote.blocks.length > 1
    ) {
      e.preventDefault();
      removeBlock(index);
      // Focus previous block
      if (index > 0) {
        setTimeout(() => {
          const prev = document.querySelector(`[data-block-id="${activeNote!.blocks[index - 1].id}"]`) as HTMLElement;
          prev?.focus();
        }, 50);
      }
    }
  }

  function updateBlockContent(index: number, content: string) {
    if (!activeNote) return;
    activeNote.blocks[index].content = content;
    activeNote.blocks = [...activeNote.blocks]; // trigger reactivity
    autoSave();
  }

  function toggleTodo(index: number) {
    if (!activeNote) return;
    activeNote.blocks[index].checked = !activeNote.blocks[index].checked;
    activeNote.blocks = [...activeNote.blocks];
    autoSave();
  }

  function changeBlockType(index: number, type: NoteBlock['type']) {
    if (!activeNote) return;
    activeNote.blocks[index].type = type;
    activeNote.blocks = [...activeNote.blocks];
    autoSave();
  }

  const BLOCK_TYPES: { type: NoteBlock['type']; label: string; icon: string }[] = [
    { type: 'text', label: 'Text', icon: 'file-text' },
    { type: 'heading1', label: 'H1', icon: 'heading' },
    { type: 'heading2', label: 'H2', icon: 'heading' },
    { type: 'heading3', label: 'H3', icon: 'heading' },
    { type: 'bullet', label: 'Bullet', icon: 'list' },
    { type: 'numbered', label: 'Numbered', icon: 'list' },
    { type: 'todo', label: 'To-do', icon: 'check' },
    { type: 'code', label: 'Code', icon: 'code' },
    { type: 'quote', label: 'Quote', icon: 'quote' },
    { type: 'divider', label: 'Divider', icon: 'minus' },
  ];

  function formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  onMount(() => {
    loadNotes();
    return useShortcuts([{ ...SHORTCUT_DEFAULTS.find((d) => d.id === 'notes:new')!, handler: () => createNote() }]);
  });
</script>

<svelte:head>
  <title>Notes | Home Server</title>
</svelte:head>

<div class="notes-layout">
  <!-- Sidebar -->
  <div class="notes-sidebar">
    <div class="sidebar-header">
      <h3>Notes</h3>
      <Button size="sm" variant="accent" onclick={createNote}>
        <Icon name="add" size={14} /> New
      </Button>
    </div>
    <div class="sidebar-search">
      <SearchInput bind:value={search} placeholder="Search notes..." size="sm" />
    </div>
    <div class="note-list">
      {#each filtered as note (note.id)}
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div class="note-item" class:active={activeNote?.id === note.id} onclick={() => openNote(note.id)}>
          <span class="note-icon">{note.icon || '📝'}</span>
          <div class="note-item-info">
            <span class="note-item-title">{note.title}</span>
            <span class="note-item-date">{formatDate(note.updatedAt)}</span>
          </div>
          {#if note.childCount > 0}
            <span class="note-child-count">{note.childCount}</span>
          {/if}
        </div>
      {/each}
    </div>
  </div>

  <!-- Editor -->
  <div class="notes-editor">
    {#if activeNote}
      <div class="editor-header">
        <input
          class="title-input"
          type="text"
          bind:value={activeNote.title}
          placeholder="Untitled"
          oninput={autoSave}
        />
        <div class="editor-actions">
          {#if saving}
            <span class="save-indicator">Saving...</span>
          {/if}
          <Button size="sm" onclick={saveNote}>Save</Button>
          <Button
            size="sm"
            variant="danger"
            confirm
            confirmText="Delete?"
            onclick={() => activeNote && deleteNote(activeNote.id)}
          >
            <Icon name="close" size={14} />
          </Button>
        </div>
      </div>

      <div class="blocks">
        {#each activeNote.blocks as block, i (block.id)}
          <div class="block" class:divider-block={block.type === 'divider'}>
            <!-- Block type selector (shown on hover) -->
            <div class="block-controls">
              <button class="block-grip" tabindex="-1">
                <Icon name="grip" size={12} />
              </button>
              <select
                class="block-type-select"
                value={block.type}
                onchange={(e) => changeBlockType(i, (e.currentTarget as HTMLSelectElement).value as NoteBlock['type'])}
              >
                {#each BLOCK_TYPES as bt}
                  <option value={bt.type}>{bt.label}</option>
                {/each}
              </select>
            </div>

            <!-- Block content -->
            <div class="block-content">
              {#if block.type === 'divider'}
                <hr />
              {:else if block.type === 'todo'}
                <label class="todo-block">
                  <input type="checkbox" checked={block.checked} onchange={() => toggleTodo(i)} />
                  <span
                    class="todo-text"
                    class:checked={block.checked}
                    contenteditable="true"
                    tabindex="0"
                    data-block-id={block.id}
                    oninput={(e) => updateBlockContent(i, (e.currentTarget as HTMLElement).textContent || '')}
                    onkeydown={(e) => handleBlockKeydown(e, i)}
                    role="textbox">{block.content}</span
                  >
                </label>
              {:else}
                <div
                  class="editable block-{block.type}"
                  contenteditable="true"
                  data-block-id={block.id}
                  data-placeholder={block.type === 'text'
                    ? 'Type something...'
                    : block.type.startsWith('heading')
                      ? 'Heading'
                      : ''}
                  oninput={(e) => updateBlockContent(i, (e.currentTarget as HTMLElement).textContent || '')}
                  onkeydown={(e) => handleBlockKeydown(e, i)}
                  role="textbox"
                  tabindex="0"
                >
                  {block.content}
                </div>
              {/if}
            </div>
          </div>
        {/each}

        <!-- Add block button -->
        <button class="add-block-btn" onclick={() => addBlock(activeNote!.blocks.length - 1)}>
          <Icon name="add" size={14} /> Add block
        </button>
      </div>
    {:else}
      <div class="editor-empty">
        <EmptyState
          icon="file-text"
          title="Select a note"
          hint="Choose a note from the sidebar or create a new one"
          actionLabel="New Note"
          onaction={createNote}
        />
      </div>
    {/if}
  </div>
</div>

<style>
  .notes-layout {
    display: flex;
    height: calc(100vh - 60px);
    overflow: hidden;
  }

  /* Sidebar */
  .notes-sidebar {
    width: 280px;
    min-width: 280px;
    border-right: 1px solid var(--border);
    background: var(--bg-secondary);
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .sidebar-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 16px;
    border-bottom: 1px solid var(--border);
  }

  .sidebar-header h3 {
    font-size: 0.95rem;
    font-weight: 600;
    margin: 0;
  }

  .sidebar-search {
    padding: 8px 12px;
    border-bottom: 1px solid var(--border-subtle);
  }

  .note-list {
    flex: 1;
    overflow-y: auto;
    padding: 4px;
  }

  .note-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    border-radius: 6px;
    cursor: pointer;
    transition: background 0.1s;
  }

  .note-item:hover {
    background: var(--bg-hover);
  }

  .note-item.active {
    background: var(--accent-bg);
    border-left: 2px solid var(--accent);
  }

  .note-icon {
    font-size: 1.1rem;
    flex-shrink: 0;
  }

  .note-item-info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
  }

  .note-item-title {
    font-size: 0.82rem;
    font-weight: 500;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .note-item-date {
    font-size: 0.65rem;
    color: var(--text-faint);
  }

  .note-child-count {
    font-size: 0.6rem;
    background: var(--bg-hover);
    padding: 1px 5px;
    border-radius: 8px;
    color: var(--text-faint);
  }

  /* Editor */
  .notes-editor {
    flex: 1;
    overflow-y: auto;
    padding: 24px 40px;
    max-width: 800px;
  }

  .editor-header {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 24px;
  }

  .title-input {
    flex: 1;
    font-size: 1.8rem;
    font-weight: 700;
    font-family: var(--font-heading, 'Space Grotesk', sans-serif);
    border: none;
    background: none;
    color: var(--text-primary);
    outline: none;
    padding: 0;
  }

  .title-input::placeholder {
    color: var(--text-faint);
  }

  .editor-actions {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
  }

  .save-indicator {
    font-size: 0.68rem;
    color: var(--text-faint);
    animation: pulse 1s ease-in-out infinite;
  }

  @keyframes pulse {
    0%,
    100% {
      opacity: 1;
    }
    50% {
      opacity: 0.4;
    }
  }

  .editor-empty {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
  }

  /* Blocks */
  .blocks {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .block {
    display: flex;
    align-items: flex-start;
    gap: 4px;
    position: relative;
    padding: 2px 0;
    border-radius: 4px;
  }

  .block:hover .block-controls {
    opacity: 1;
  }

  .block-controls {
    display: flex;
    align-items: center;
    gap: 2px;
    opacity: 0;
    transition: opacity 0.15s;
    flex-shrink: 0;
    padding-top: 2px;
  }

  .block-grip {
    background: none;
    border: none;
    color: var(--text-faint);
    cursor: grab;
    padding: 2px;
    border-radius: 3px;
    display: flex;
  }

  .block-grip:hover {
    background: var(--bg-hover);
  }

  .block-type-select {
    font-size: 0.6rem;
    padding: 1px 4px;
    border: 1px solid transparent;
    border-radius: 3px;
    background: none;
    color: var(--text-faint);
    cursor: pointer;
    font-family: inherit;
  }

  .block-type-select:hover {
    border-color: var(--border);
    background: var(--bg-hover);
  }

  .block-content {
    flex: 1;
    min-width: 0;
  }

  .editable {
    outline: none;
    min-height: 1.4em;
    line-height: 1.6;
    padding: 2px 4px;
    border-radius: 3px;
    transition: background 0.1s;
    word-break: break-word;
  }

  .editable:focus {
    background: var(--bg-hover);
  }

  .editable:empty::before {
    content: attr(data-placeholder);
    color: var(--text-faint);
    pointer-events: none;
  }

  /* Block type styles */
  .block-text {
    font-size: 0.88rem;
    color: var(--text-primary);
  }

  .block-heading1 {
    font-size: 1.5rem;
    font-weight: 700;
    font-family: var(--font-heading, 'Space Grotesk', sans-serif);
    margin: 16px 0 4px;
  }

  .block-heading2 {
    font-size: 1.2rem;
    font-weight: 600;
    font-family: var(--font-heading, 'Space Grotesk', sans-serif);
    margin: 12px 0 2px;
  }

  .block-heading3 {
    font-size: 1rem;
    font-weight: 600;
    margin: 8px 0 2px;
  }

  .block-bullet {
    font-size: 0.88rem;
    padding-left: 20px;
    position: relative;
  }

  .block-bullet::before {
    content: '•';
    position: absolute;
    left: 6px;
    color: var(--text-faint);
  }

  .block-numbered {
    font-size: 0.88rem;
    padding-left: 20px;
  }

  .block-code {
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.78rem;
    background: var(--code-bg);
    padding: 8px 12px;
    border-radius: 6px;
    white-space: pre-wrap;
  }

  .block-quote {
    font-size: 0.88rem;
    border-left: 3px solid var(--accent);
    padding-left: 12px;
    color: var(--text-muted);
    font-style: italic;
  }

  .divider-block hr {
    border: none;
    border-top: 1px solid var(--border);
    margin: 8px 0;
  }

  .todo-block {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    cursor: text;
  }

  .todo-block input[type='checkbox'] {
    margin-top: 4px;
    accent-color: var(--accent);
  }

  .todo-text {
    flex: 1;
    outline: none;
    font-size: 0.88rem;
    line-height: 1.6;
    min-height: 1.4em;
  }

  .todo-text.checked {
    text-decoration: line-through;
    color: var(--text-faint);
  }

  .add-block-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 12px;
    border: 1px dashed var(--border);
    border-radius: 6px;
    background: none;
    color: var(--text-faint);
    cursor: pointer;
    font-family: inherit;
    font-size: 0.78rem;
    margin-top: 8px;
    transition:
      border-color 0.15s,
      color 0.15s;
  }

  .add-block-btn:hover {
    border-color: var(--accent);
    color: var(--accent);
  }

  @media (max-width: 640px) {
    .notes-layout {
      flex-direction: column;
    }

    .notes-sidebar {
      width: 100%;
      min-width: unset;
      max-height: 40vh;
      border-right: none;
      border-bottom: 1px solid var(--border);
    }

    .notes-editor {
      padding: 16px 20px;
    }
  }
</style>
