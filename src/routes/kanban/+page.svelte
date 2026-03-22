<script lang="ts">
  import type { PageData } from './$types';
  import { toast } from '$lib/toast';
  import { fetchApi } from '$lib/api';

  import Icon from '$lib/components/Icon.svelte';
  import Badge from '$lib/components/Badge.svelte';

  interface KanbanCard {
    id: string;
    title: string;
    description: string;
    color: string;
    dueDate: string | null;
    column: 'todo' | 'doing' | 'done' | 'archive';
    order: number;
    priority: 'P1' | 'P2' | 'P3' | '';
    assignee: string;
    createdAt: string;
  }

  type Column = 'todo' | 'doing' | 'done' | 'archive';

  const COLUMNS: { key: Column; label: string; icon: string }[] = [
    { key: 'todo', label: 'To Do', icon: 'circle' },
    { key: 'doing', label: 'Doing', icon: 'clock' },
    { key: 'done', label: 'Done', icon: 'check' },
    { key: 'archive', label: 'Archive', icon: 'archive' },
  ];

  const PRIORITIES: { value: 'P1' | 'P2' | 'P3' | ''; label: string; color: string }[] = [
    { value: '', label: 'None', color: 'var(--text-faint)' },
    { value: 'P1', label: 'P1', color: 'var(--danger)' },
    { value: 'P2', label: 'P2', color: 'var(--warning)' },
    { value: 'P3', label: 'P3', color: 'var(--text-muted)' },
  ];

  let showArchive = $state(false);

  const COLORS = ['#ef4444', '#f59e0b', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899'];

  let { data } = $props<{ data: PageData }>();
  let cards = $state<KanbanCard[]>(data.cards ?? []);

  let addingTo = $state<Column | null>(null);
  let newTitle = $state('');
  let newDescription = $state('');
  let newColor = $state('');
  let newDueDate = $state('');
  let newPriority = $state<'P1' | 'P2' | 'P3' | ''>('');
  let newAssignee = $state('');
  let confirmDeleteId = $state<string | null>(null);
  let dragCardId = $state<string | null>(null);
  let dragOverCol = $state<Column | null>(null);

  let visibleColumns = $derived(showArchive ? COLUMNS : COLUMNS.filter((c) => c.key !== 'archive'));

  function columnCards(col: Column): KanbanCard[] {
    return cards.filter((c) => c.column === col).sort((a, b) => a.order - b.order);
  }

  async function addCard(col: Column) {
    if (!newTitle.trim()) {
      toast.error('Title is required');
      return;
    }
    try {
      const res = await fetchApi('/api/kanban', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newTitle.trim(),
          description: newDescription.trim(),
          color: newColor,
          dueDate: newDueDate,
          priority: newPriority,
          assignee: newAssignee.trim(),
          column: col,
        }),
      });
      if (!res.ok) throw new Error();
      const card = await res.json();
      cards = [...cards, card];
      newTitle = '';
      newDescription = '';
      newColor = '';
      newDueDate = '';
      newPriority = '';
      newAssignee = '';
      addingTo = null;
      toast.success('Card added');
    } catch {
      toast.error('Failed to add card');
    }
  }

  async function deleteCard(id: string) {
    try {
      const res = await fetchApi('/api/kanban', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ _action: 'delete', id }),
      });
      if (!res.ok) throw new Error();
      cards = cards.filter((c) => c.id !== id);
      confirmDeleteId = null;
      toast.success('Card deleted');
    } catch {
      toast.error('Failed to delete card');
    }
  }

  async function moveCard(cardId: string, toCol: Column) {
    const card = cards.find((c) => c.id === cardId);
    if (!card || card.column === toCol) return;

    try {
      const res = await fetchApi('/api/kanban', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          _action: 'move',
          id: cardId,
          column: toCol,
          order: cards.filter((c) => c.column === toCol).length,
        }),
      });
      if (!res.ok) throw new Error();
      cards = cards.map((c) => (c.id === cardId ? { ...c, column: toCol } : c));
    } catch {
      toast.error('Failed to move card');
    }
  }

  let dragInsertIndex = $state(-1);

  function handleDragStart(e: DragEvent, cardId: string) {
    dragCardId = cardId;
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', cardId);
    }
    // Add dragging class after a tick to allow the drag image to render
    setTimeout(() => {
      const el = document.querySelector(`[data-card-id="${cardId}"]`);
      el?.classList.add('dragging');
    }, 0);
  }

  function handleDragEnd() {
    const el = document.querySelector('.dragging');
    el?.classList.remove('dragging');
    dragCardId = null;
    dragOverCol = null;
    dragInsertIndex = -1;
  }

  function handleDragOver(e: DragEvent, col: Column) {
    e.preventDefault();
    dragOverCol = col;
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';

    // Calculate insertion index
    const colEl = (e.currentTarget as HTMLElement).querySelector('.column-cards');
    if (colEl) {
      const cards = Array.from(colEl.querySelectorAll('.kanban-card:not(.dragging)'));
      let idx = cards.length;
      for (let i = 0; i < cards.length; i++) {
        const rect = cards[i].getBoundingClientRect();
        if (e.clientY < rect.top + rect.height / 2) {
          idx = i;
          break;
        }
      }
      dragInsertIndex = idx;
    }
  }

  function handleDragLeave() {
    dragOverCol = null;
    dragInsertIndex = -1;
  }

  function handleDrop(e: DragEvent, col: Column) {
    e.preventDefault();
    dragOverCol = null;
    dragInsertIndex = -1;
    if (dragCardId) {
      moveCard(dragCardId, col);
      dragCardId = null;
    }
  }

  function formatDate(d: string): string {
    return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  function isOverdue(d: string | null): boolean {
    if (!d) return false;
    return new Date(d) < new Date(new Date().toDateString());
  }
</script>

<div class="page">
  <div class="kanban-header">
    <h2 class="page-title">Kanban Board</h2>
    <label class="archive-toggle">
      <input type="checkbox" bind:checked={showArchive} />
      Show Archive
    </label>
  </div>
  <p class="page-desc">Organize tasks visually with drag-and-drop cards across customizable columns.</p>

  <div class="board" style="grid-template-columns: repeat({visibleColumns.length}, 1fr);">
    {#each visibleColumns as col}
      <div
        class="column"
        class:drag-over={dragOverCol === col.key}
        ondragover={(e) => handleDragOver(e, col.key)}
        ondragleave={handleDragLeave}
        ondrop={(e) => handleDrop(e, col.key)}
        role="list"
      >
        <div class="column-header">
          <h2>{col.label}</h2>
          <span class="count">{columnCards(col.key).length}</span>
        </div>

        <div class="column-cards">
          {#each columnCards(col.key) as card, i (card.id)}
            {#if dragOverCol === col.key && dragInsertIndex === i}
              <div class="drop-indicator"></div>
            {/if}
            <div
              class="card kanban-card card-stagger"
              data-card-id={card.id}
              style="animation-delay: {i * 40}ms"
              draggable="true"
              ondragstart={(e) => handleDragStart(e, card.id)}
              ondragend={handleDragEnd}
              role="listitem"
            >
              {#if card.color}
                <div class="card-color" style="background:{card.color}"></div>
              {/if}
              <div class="card-body">
                <div class="card-title-row">
                  {#if card.priority}
                    <span
                      class="card-priority"
                      style="color: {PRIORITIES.find((p) => p.value === card.priority)?.color || 'inherit'}"
                    >
                      {card.priority}
                    </span>
                  {/if}
                  <span class="card-title">{card.title}</span>
                </div>
                {#if card.description}
                  <p class="card-desc">{card.description}</p>
                {/if}
                <div class="card-meta">
                  {#if card.assignee}
                    <span class="card-assignee" title={card.assignee}>{card.assignee}</span>
                  {/if}
                  {#if card.dueDate}
                    <span class="card-due" class:overdue={isOverdue(card.dueDate)}>
                      {formatDate(card.dueDate)}
                    </span>
                  {/if}
                </div>
              </div>
              <div class="card-actions">
                {#if confirmDeleteId === card.id}
                  <button class="btn-xs btn-danger" onclick={() => deleteCard(card.id)}>Yes</button>
                  <button class="btn-xs" onclick={() => (confirmDeleteId = null)}>No</button>
                {:else}
                  <button class="btn-xs btn-danger" onclick={() => (confirmDeleteId = card.id)}>x</button>
                {/if}
              </div>
            </div>
          {/each}
          {#if dragOverCol === col.key && dragInsertIndex >= columnCards(col.key).length}
            <div class="drop-indicator"></div>
          {/if}
        </div>

        {#if addingTo === col.key}
          <div class="card add-form">
            <input
              type="text"
              bind:value={newTitle}
              placeholder="Card title..."
              onkeydown={(e) => e.key === 'Enter' && addCard(col.key)}
            />
            <textarea bind:value={newDescription} placeholder="Description (optional)" rows="2" class="desc-input"
            ></textarea>
            <div class="form-row">
              <input type="text" bind:value={newAssignee} placeholder="Assignee" class="assignee-input" />
              <select bind:value={newPriority} class="priority-select">
                {#each PRIORITIES as p}
                  <option value={p.value}>{p.label}</option>
                {/each}
              </select>
            </div>
            <div class="color-row">
              {#each COLORS as c}
                <button
                  class="color-dot"
                  class:selected={newColor === c}
                  style="background:{c}"
                  onclick={() => (newColor = newColor === c ? '' : c)}
                ></button>
              {/each}
            </div>
            <input type="date" bind:value={newDueDate} />
            <div class="add-actions">
              <button class="btn-primary btn-sm" onclick={() => addCard(col.key)}>Add</button>
              <button class="btn-sm" onclick={() => (addingTo = null)}>Cancel</button>
            </div>
          </div>
        {:else}
          <button
            class="add-btn"
            onclick={() => {
              addingTo = col.key;
              newTitle = '';
              newDescription = '';
              newColor = '';
              newDueDate = '';
              newPriority = '';
              newAssignee = '';
            }}
          >
            + Add Card
          </button>
        {/if}
      </div>
    {/each}
  </div>
</div>

<style>
  .page {
    padding: 1.5rem;
    max-width: 1200px;
    margin: 0 auto;
  }
  h1 {
    margin-bottom: 1.5rem;
    color: var(--text-primary);
  }
  .kanban-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 4px;
  }

  .archive-toggle {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 0.78rem;
    color: var(--text-muted);
    cursor: pointer;
  }

  .board {
    display: grid;
    gap: 1rem;
    min-height: 60vh;
  }
  @media (max-width: 700px) {
    .board {
      grid-template-columns: 1fr;
    }
  }
  .column {
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 0.75rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    transition: border-color 0.15s;
  }
  .column.drag-over {
    border-color: var(--accent);
    background: color-mix(in srgb, var(--accent) 5%, var(--bg-secondary));
  }
  .column-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.25rem 0.25rem 0.5rem;
    border-bottom: 1px solid var(--border);
  }
  .column-header h2 {
    margin: 0;
    font-size: 1rem;
    color: var(--text-primary);
  }
  .count {
    background: var(--bg-primary);
    border-radius: 10px;
    padding: 0.1rem 0.5rem;
    font-size: 0.75rem;
    color: var(--text-muted);
  }
  .column-cards {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    flex: 1;
    min-height: 2rem;
  }
  .kanban-card {
    padding: 0.6rem 0.75rem;
    cursor: grab;
    position: relative;
    overflow: hidden;
  }
  .kanban-card:active {
    cursor: grabbing;
  }

  :global(.kanban-card.dragging) {
    opacity: 0.3;
    transform: scale(0.95);
    transition:
      opacity 0.2s,
      transform 0.2s;
  }

  .drop-indicator {
    height: 3px;
    background: var(--accent);
    border-radius: 3px;
    margin: -2px 0;
    animation: indicator-pulse 1s ease-in-out infinite;
  }

  @keyframes indicator-pulse {
    0%,
    100% {
      opacity: 1;
    }
    50% {
      opacity: 0.5;
    }
  }
  .card-color {
    position: absolute;
    top: 0;
    left: 0;
    width: 4px;
    height: 100%;
    border-radius: 4px 0 0 4px;
  }
  .card-body {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    padding-left: 0.25rem;
  }
  .card-title-row {
    display: flex;
    align-items: baseline;
    gap: 6px;
  }

  .card-priority {
    font-size: 0.65rem;
    font-weight: 700;
    font-family: 'JetBrains Mono', monospace;
    flex-shrink: 0;
  }

  .card-title {
    color: var(--text-primary);
    font-size: 0.9rem;
    font-weight: 500;
  }

  .card-desc {
    font-size: 0.72rem;
    color: var(--text-muted);
    margin: 2px 0 0;
    line-height: 1.4;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .card-meta {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 4px;
  }

  .card-assignee {
    font-size: 0.68rem;
    color: var(--accent);
    background: var(--accent-bg);
    padding: 1px 6px;
    border-radius: 8px;
  }

  .card-due {
    font-size: 0.72rem;
    color: var(--text-muted);
  }
  .card-due.overdue {
    color: var(--danger);
    font-weight: 600;
  }

  .desc-input {
    font-size: 0.82rem;
    font-family: inherit;
    border: 1px solid var(--border);
    border-radius: 6px;
    background: var(--bg-primary);
    color: var(--text-primary);
    padding: 6px 8px;
    resize: vertical;
  }

  .form-row {
    display: flex;
    gap: 6px;
  }

  .assignee-input {
    flex: 1;
    font-size: 0.82rem;
    font-family: inherit;
    border: 1px solid var(--border);
    border-radius: 6px;
    background: var(--bg-primary);
    color: var(--text-primary);
    padding: 4px 8px;
  }

  .priority-select {
    font-size: 0.78rem;
    font-family: inherit;
    border: 1px solid var(--border);
    border-radius: 6px;
    background: var(--bg-primary);
    color: var(--text-primary);
    padding: 4px 8px;
    cursor: pointer;
  }
  .card-actions {
    position: absolute;
    top: 0.4rem;
    right: 0.4rem;
    display: flex;
    gap: 0.2rem;
    opacity: 0;
    transition: opacity 0.15s;
  }
  .kanban-card:hover .card-actions {
    opacity: 1;
  }
  .btn-xs {
    padding: 0.15rem 0.4rem;
    border: 1px solid var(--border);
    border-radius: 4px;
    background: var(--bg-primary);
    color: var(--text-secondary);
    cursor: pointer;
    font-size: 0.7rem;
  }
  .btn-xs.btn-danger {
    color: var(--danger);
    border-color: var(--danger);
  }
  .add-form {
    padding: 0.75rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  .add-form input[type='text'],
  .add-form input[type='date'] {
    padding: 0.4rem 0.6rem;
    border: 1px solid var(--border);
    border-radius: 6px;
    background: var(--bg-primary);
    color: var(--text-primary);
    font-size: 0.85rem;
  }
  .color-row {
    display: flex;
    gap: 0.4rem;
  }
  .color-dot {
    width: 20px;
    height: 20px;
    border-radius: 50%;
    border: 2px solid transparent;
    cursor: pointer;
    padding: 0;
  }
  .color-dot.selected {
    border-color: var(--text-primary);
  }
  .add-actions {
    display: flex;
    gap: 0.5rem;
  }
  .btn-primary {
    background: var(--accent);
    color: #fff;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-weight: 600;
  }
  .btn-sm {
    padding: 0.3rem 0.6rem;
    font-size: 0.8rem;
    border: 1px solid var(--border);
    border-radius: 4px;
    background: var(--bg-secondary);
    color: var(--text-secondary);
    cursor: pointer;
  }
  .add-btn {
    padding: 0.5rem;
    border: 1px dashed var(--border);
    border-radius: 6px;
    background: transparent;
    color: var(--text-muted);
    cursor: pointer;
    font-size: 0.85rem;
  }
  .add-btn:hover {
    border-color: var(--accent);
    color: var(--accent);
  }
</style>
