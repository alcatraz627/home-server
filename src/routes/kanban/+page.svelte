<script lang="ts">
  import type { PageData } from './$types';
  import { toast } from '$lib/toast';

  interface KanbanCard {
    id: string;
    title: string;
    color: string;
    dueDate: string | null;
    column: 'todo' | 'doing' | 'done';
    order: number;
    createdAt: string;
  }

  type Column = 'todo' | 'doing' | 'done';

  const COLUMNS: { key: Column; label: string }[] = [
    { key: 'todo', label: 'To Do' },
    { key: 'doing', label: 'Doing' },
    { key: 'done', label: 'Done' },
  ];

  const COLORS = ['#ef4444', '#f59e0b', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899'];

  let { data } = $props<{ data: PageData }>();
  let cards = $state<KanbanCard[]>(data.cards ?? []);

  let addingTo = $state<Column | null>(null);
  let newTitle = $state('');
  let newColor = $state('');
  let newDueDate = $state('');
  let confirmDeleteId = $state<string | null>(null);
  let dragCardId = $state<string | null>(null);
  let dragOverCol = $state<Column | null>(null);

  function columnCards(col: Column): KanbanCard[] {
    return cards.filter((c) => c.column === col).sort((a, b) => a.order - b.order);
  }

  async function addCard(col: Column) {
    if (!newTitle.trim()) {
      toast.error('Title is required');
      return;
    }
    try {
      const res = await fetch('/api/kanban', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newTitle.trim(),
          color: newColor,
          dueDate: newDueDate,
          column: col,
        }),
      });
      if (!res.ok) throw new Error();
      const card = await res.json();
      cards = [...cards, card];
      newTitle = '';
      newColor = '';
      newDueDate = '';
      addingTo = null;
      toast.success('Card added');
    } catch {
      toast.error('Failed to add card');
    }
  }

  async function deleteCard(id: string) {
    try {
      const res = await fetch('/api/kanban', {
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
      const res = await fetch('/api/kanban', {
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

  function handleDragStart(e: DragEvent, cardId: string) {
    dragCardId = cardId;
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', cardId);
    }
  }

  function handleDragOver(e: DragEvent, col: Column) {
    e.preventDefault();
    dragOverCol = col;
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
  }

  function handleDragLeave() {
    dragOverCol = null;
  }

  function handleDrop(e: DragEvent, col: Column) {
    e.preventDefault();
    dragOverCol = null;
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
  <h1>Kanban Board</h1>

  <div class="board">
    {#each COLUMNS as col}
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
            <div
              class="card kanban-card card-stagger"
              style="animation-delay: {i * 40}ms"
              draggable="true"
              ondragstart={(e) => handleDragStart(e, card.id)}
              role="listitem"
            >
              {#if card.color}
                <div class="card-color" style="background:{card.color}"></div>
              {/if}
              <div class="card-body">
                <span class="card-title">{card.title}</span>
                {#if card.dueDate}
                  <span class="card-due" class:overdue={isOverdue(card.dueDate)}>
                    {formatDate(card.dueDate)}
                  </span>
                {/if}
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
        </div>

        {#if addingTo === col.key}
          <div class="card add-form">
            <input
              type="text"
              bind:value={newTitle}
              placeholder="Card title..."
              onkeydown={(e) => e.key === 'Enter' && addCard(col.key)}
            />
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
              newColor = '';
              newDueDate = '';
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
  .board {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
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
    opacity: 0.8;
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
  .card-title {
    color: var(--text-primary);
    font-size: 0.9rem;
    font-weight: 500;
  }
  .card-due {
    font-size: 0.75rem;
    color: var(--text-muted);
  }
  .card-due.overdue {
    color: var(--danger);
    font-weight: 600;
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
