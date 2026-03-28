<script lang="ts">
  import type { PageData } from './$types';
  import { onMount } from 'svelte';
  import { useShortcuts, SHORTCUT_DEFAULTS } from '$lib/shortcuts';
  import { toast } from '$lib/toast';
  import { postJson } from '$lib/api';

  import Icon from '$lib/components/Icon.svelte';
  import PageHeader from '$lib/components/PageHeader.svelte';
  import LinkedItems from '$lib/components/LinkedItems.svelte';
  import TagInput from '$lib/components/TagInput.svelte';
  import type { KanbanCard, KanbanColumn, ChecklistItem } from '$lib/types/productivity';

  type Column = KanbanColumn;

  const COLUMNS: { key: Column; label: string; icon: string; accent: string }[] = [
    { key: 'todo', label: 'To Do', icon: 'circle', accent: 'var(--text-muted)' },
    { key: 'doing', label: 'In Progress', icon: 'clock', accent: 'var(--accent)' },
    { key: 'done', label: 'Done', icon: 'check', accent: 'var(--success, #22c55e)' },
    { key: 'archive', label: 'Archive', icon: 'archive', accent: 'var(--text-faint)' },
  ];

  const PRIORITIES: { value: 'P1' | 'P2' | 'P3' | ''; label: string; color: string; icon: string }[] = [
    { value: '', label: 'None', color: 'var(--text-faint)', icon: '' },
    { value: 'P1', label: 'P1 Urgent', color: 'var(--danger)', icon: 'alarm-clock' },
    { value: 'P2', label: 'P2 High', color: 'var(--warning)', icon: 'arrow-up' },
    { value: 'P3', label: 'P3 Low', color: 'var(--text-muted)', icon: 'arrow-down' },
  ];

  let showArchive = $state(false);

  const COLORS = ['#ef4444', '#f59e0b', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];

  let { data } = $props<{ data: PageData }>();
  let cards = $state<KanbanCard[]>([]);
  $effect(() => {
    cards = data.cards ?? [];
  });

  let addingTo = $state<Column | null>(null);
  let newTitle = $state('');
  let newDescription = $state('');
  let newColor = $state('');
  let newDueDate = $state('');
  let newPriority = $state<'P1' | 'P2' | 'P3' | ''>('');
  let newAssignee = $state('');
  let newTags = $state<string[]>([]);
  let newChecklist = $state<ChecklistItem[]>([]);
  let newChecklistText = $state('');
  let confirmDeleteId = $state<string | null>(null);
  let editingId = $state<string | null>(null);
  let editTitle = $state('');
  let editDescription = $state('');
  let editColor = $state('');
  let editDueDate = $state('');
  let editPriority = $state<'P1' | 'P2' | 'P3' | ''>('');
  let editAssignee = $state('');
  let editTags = $state<string[]>([]);
  let editChecklist = $state<ChecklistItem[]>([]);
  let editChecklistText = $state('');
  let dragCardId = $state<string | null>(null);
  let dragOverCol = $state<Column | null>(null);

  let visibleColumns = $derived(showArchive ? COLUMNS : COLUMNS.filter((c) => c.key !== 'archive'));

  let totalCards = $derived(cards.filter((c) => c.column !== 'archive').length);

  onMount(() => {
    return useShortcuts([
      {
        ...SHORTCUT_DEFAULTS.find((d) => d.id === 'kanban:new-task')!,
        handler: () => {
          addingTo = 'todo';
          newTitle = '';
          newDescription = '';
          newColor = '';
          newDueDate = '';
          newPriority = '';
          newAssignee = '';
          newTags = [];
          newChecklist = [];
          newChecklistText = '';
        },
      },
    ]);
  });

  function columnCards(col: Column): KanbanCard[] {
    return cards.filter((c) => c.column === col).sort((a, b) => a.order - b.order);
  }

  async function addCard(col: Column) {
    if (!newTitle.trim()) {
      toast.error('Title is required');
      return;
    }
    try {
      const res = await postJson('/api/kanban', {
        title: newTitle.trim(),
        description: newDescription.trim(),
        color: newColor,
        dueDate: newDueDate,
        priority: newPriority,
        assignee: newAssignee.trim(),
        tags: newTags,
        checklist: newChecklist,
        column: col,
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
      newTags = [];
      newChecklist = [];
      newChecklistText = '';
      addingTo = null;
      toast.success('Card added');
    } catch {
      toast.error('Failed to add card');
    }
  }

  async function deleteCard(id: string) {
    try {
      const res = await postJson('/api/kanban', { _action: 'delete', id });
      if (!res.ok) throw new Error();
      cards = cards.filter((c) => c.id !== id);
      confirmDeleteId = null;
      if (editingId === id) editingId = null;
      toast.success('Card deleted');
    } catch {
      toast.error('Failed to delete card');
    }
  }

  function startEdit(card: KanbanCard) {
    editingId = card.id;
    editTitle = card.title;
    editDescription = card.description;
    editColor = card.color;
    editDueDate = card.dueDate ?? '';
    editPriority = card.priority;
    editAssignee = card.assignee;
    editTags = [...(card.tags ?? [])];
    editChecklist = (card.checklist ?? []).map((item) => ({ ...item }));
    editChecklistText = '';
  }

  function cancelEdit() {
    editingId = null;
  }

  async function updateCard() {
    if (!editingId) return;
    if (!editTitle.trim()) {
      toast.error('Title is required');
      return;
    }
    try {
      const res = await postJson('/api/kanban', {
        _action: 'update',
        id: editingId,
        title: editTitle.trim(),
        description: editDescription.trim(),
        color: editColor,
        dueDate: editDueDate || null,
        priority: editPriority,
        assignee: editAssignee.trim(),
        tags: editTags,
        checklist: editChecklist,
      });
      if (!res.ok) throw new Error();
      const updated = await res.json();
      cards = cards.map((c) => (c.id === updated.id ? { ...c, ...updated } : c));
      editingId = null;
      toast.success('Card updated');
    } catch {
      toast.error('Failed to update card');
    }
  }

  async function moveCard(cardId: string, toCol: Column) {
    const card = cards.find((c) => c.id === cardId);
    if (!card || card.column === toCol) return;

    // Optimistic update
    cards = cards.map((c) => (c.id === cardId ? { ...c, column: toCol } : c));

    try {
      const res = await postJson('/api/kanban', {
        _action: 'move',
        id: cardId,
        column: toCol,
        order: cards.filter((c) => c.column === toCol).length,
      });
      if (!res.ok) throw new Error();
    } catch {
      // Revert optimistic update
      cards = cards.map((c) => (c.id === cardId ? { ...c, column: card.column } : c));
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

    const colEl = (e.currentTarget as HTMLElement).querySelector('.column-cards');
    if (colEl) {
      const cardEls = Array.from(colEl.querySelectorAll('.kanban-card:not(.dragging)'));
      let idx = cardEls.length;
      for (let i = 0; i < cardEls.length; i++) {
        const rect = cardEls[i].getBoundingClientRect();
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

  async function createReminderFromCard(card: KanbanCard) {
    if (!card.dueDate) {
      toast.error('Set a due date first to create a reminder');
      return;
    }
    try {
      const datetime = new Date(`${card.dueDate}T09:00`).toISOString();
      const res = await postJson('/api/reminders', {
        title: card.title,
        description: card.description || `Kanban card due: ${card.title}`,
        datetime,
        channels: ['browser'],
      });
      if (!res.ok) throw new Error();
      const reminder = await res.json();

      // Auto-link the kanban card to the new reminder
      await postJson('/api/links', {
        sourceType: 'kanban',
        sourceId: card.id,
        targetType: 'reminder',
        targetId: reminder.id,
      });

      toast.success('Reminder created & linked');
    } catch {
      toast.error('Failed to create reminder');
    }
  }

  function formatDate(d: string): string {
    return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  function autofocus(node: HTMLElement) {
    requestAnimationFrame(() => node.focus());
  }

  /** Toggle a checklist item's done state directly on the card (no edit mode needed) */
  async function toggleChecklistItem(card: KanbanCard, itemIndex: number) {
    const checklist = (card.checklist ?? []).map((item, i) => (i === itemIndex ? { ...item, done: !item.done } : item));
    // Optimistic update
    cards = cards.map((c) => (c.id === card.id ? { ...c, checklist } : c));
    try {
      const res = await postJson('/api/kanban', { _action: 'update', id: card.id, checklist });
      if (!res.ok) throw new Error();
    } catch {
      // Revert
      cards = cards.map((c) => (c.id === card.id ? card : c));
      toast.error('Failed to update checklist');
    }
  }

  function addChecklistItem(list: ChecklistItem[], text: string): ChecklistItem[] | null {
    const trimmed = text.trim();
    if (!trimmed) return null;
    return [...list, { text: trimmed, done: false }];
  }

  function removeChecklistItem(list: ChecklistItem[], index: number): ChecklistItem[] {
    return list.filter((_, i) => i !== index);
  }

  function isOverdue(d: string | null): boolean {
    if (!d) return false;
    return new Date(d) < new Date(new Date().toDateString());
  }

  function priorityColor(p: string): string {
    return PRIORITIES.find((x) => x.value === p)?.color || 'inherit';
  }
</script>

<svelte:head>
  <title>Kanban | Home Server</title>
</svelte:head>

<div class="page page-lg">
  <PageHeader title="Kanban Board" description="Drag-and-drop task management across columns." icon="kanban">
    {#snippet titleExtra()}
      <span class="total-badge">{totalCards}</span>
    {/snippet}
    {#snippet children()}
      <label class="archive-toggle">
        <input type="checkbox" bind:checked={showArchive} />
        <Icon name="archive" size={13} />
        Archive
      </label>
    {/snippet}
  </PageHeader>

  <div class="board" style="grid-template-columns: repeat({visibleColumns.length}, 1fr);">
    {#each visibleColumns as col}
      <div
        class="column"
        class:drag-over={dragOverCol === col.key}
        style="--col-accent: {col.accent}"
        ondragover={(e) => handleDragOver(e, col.key)}
        ondragleave={handleDragLeave}
        ondrop={(e) => handleDrop(e, col.key)}
        role="list"
      >
        <div class="column-header">
          <div class="column-title">
            <Icon name={col.icon} size={14} />
            <h2>{col.label}</h2>
          </div>
          <span class="count">{columnCards(col.key).length}</span>
        </div>

        <div class="column-cards">
          {#each columnCards(col.key) as card, i (card.id)}
            {#if dragOverCol === col.key && dragInsertIndex === i}
              <div class="drop-indicator"></div>
            {/if}
            {#if editingId === card.id}
              <!-- svelte-ignore a11y_no_static_element_interactions -->
              <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
              <div
                class="card kanban-card edit-form"
                data-card-id={card.id}
                role="listitem"
                onkeydown={(e) => {
                  if (e.key === 'Escape') cancelEdit();
                }}
              >
                {#if editColor}
                  <div class="card-color" style="background:{editColor}"></div>
                {/if}
                <div class="edit-body">
                  <input
                    type="text"
                    bind:value={editTitle}
                    placeholder="Title"
                    class="edit-input edit-title"
                    use:autofocus
                    onkeydown={(e) => {
                      if (e.key === 'Enter') updateCard();
                      if (e.key === 'Escape') cancelEdit();
                    }}
                  />
                  <textarea bind:value={editDescription} placeholder="Description" rows="2" class="edit-input"
                  ></textarea>
                  <div class="edit-row">
                    <input type="text" bind:value={editAssignee} placeholder="Assignee" class="edit-input" />
                    <select bind:value={editPriority} class="edit-select">
                      {#each PRIORITIES as p}
                        <option value={p.value}>{p.label}</option>
                      {/each}
                    </select>
                  </div>
                  <TagInput bind:tags={editTags} placeholder="Add tag..." />
                  <div class="color-row">
                    <span class="color-label">Color</span>
                    {#each COLORS as c}
                      <button
                        class="color-dot"
                        class:selected={editColor === c}
                        style="background:{c}"
                        aria-label="Color {c}"
                        onclick={() => (editColor = editColor === c ? '' : c)}
                      ></button>
                    {/each}
                  </div>
                  <div class="edit-row">
                    <input type="date" bind:value={editDueDate} class="edit-input" />
                  </div>
                  <!-- Checklist -->
                  <div class="checklist-section">
                    <span class="checklist-label"><Icon name="check" size={11} /> Checklist</span>
                    {#if editChecklist.length > 0}
                      <div class="checklist-progress-row">
                        <div class="checklist-progress-bar">
                          <div
                            class="checklist-progress-fill"
                            style="width: {(editChecklist.filter((i) => i.done).length / editChecklist.length) * 100}%"
                          ></div>
                        </div>
                        <span class="checklist-progress-text"
                          >{editChecklist.filter((i) => i.done).length}/{editChecklist.length}</span
                        >
                      </div>
                      {#each editChecklist as item, i}
                        <div class="checklist-item">
                          <label class="checklist-check">
                            <input
                              type="checkbox"
                              checked={item.done}
                              onchange={() => (editChecklist[i].done = !editChecklist[i].done)}
                            />
                            <span class:done={item.done}>{item.text}</span>
                          </label>
                          <button
                            class="checklist-remove"
                            title="Remove"
                            onclick={() => (editChecklist = removeChecklistItem(editChecklist, i))}
                          >
                            <Icon name="close" size={10} />
                          </button>
                        </div>
                      {/each}
                    {/if}
                    <div class="checklist-add-row">
                      <input
                        type="text"
                        bind:value={editChecklistText}
                        placeholder="Add item..."
                        class="edit-input checklist-add-input"
                        onkeydown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            const result = addChecklistItem(editChecklist, editChecklistText);
                            if (result) {
                              editChecklist = result;
                              editChecklistText = '';
                            }
                          }
                        }}
                      />
                      <button
                        class="btn-xs"
                        onclick={() => {
                          const result = addChecklistItem(editChecklist, editChecklistText);
                          if (result) {
                            editChecklist = result;
                            editChecklistText = '';
                          }
                        }}
                      >
                        <Icon name="plus" size={11} />
                      </button>
                    </div>
                  </div>
                  <div class="edit-actions">
                    <button class="btn-primary btn-sm" onclick={updateCard}>
                      <Icon name="save" size={13} /> Save
                    </button>
                    <button class="btn-sm" onclick={cancelEdit}>Cancel</button>
                    {#if editDueDate}
                      <button
                        class="btn-sm btn-remind"
                        onclick={() =>
                          createReminderFromCard({
                            ...card,
                            dueDate: editDueDate,
                            title: editTitle,
                            description: editDescription,
                          })}
                        title="Create a reminder for the due date"
                      >
                        <Icon name="bell" size={12} /> Remind
                      </button>
                    {/if}
                    <button class="btn-sm btn-danger-outline" onclick={() => deleteCard(card.id)} title="Delete card">
                      <Icon name="delete" size={12} />
                    </button>
                  </div>
                </div>
              </div>
            {:else}
              <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
              <!-- svelte-ignore a11y_click_events_have_key_events -->
              <div
                class="card kanban-card"
                data-card-id={card.id}
                draggable="true"
                ondragstart={(e) => handleDragStart(e, card.id)}
                ondragend={handleDragEnd}
                onclick={() => startEdit(card)}
                role="listitem"
              >
                {#if card.color}
                  <div class="card-color" style="background:{card.color}"></div>
                {/if}
                <div class="card-body">
                  <div class="card-title-row">
                    {#if card.priority}
                      <span class="card-priority" style="color: {priorityColor(card.priority)}">
                        {card.priority}
                      </span>
                    {/if}
                    <span class="card-title">{card.title}</span>
                  </div>
                  {#if card.description}
                    <p class="card-desc">{card.description}</p>
                  {/if}
                  {#if (card.tags ?? []).length > 0}
                    <div class="card-tags">
                      {#each card.tags as tag}
                        <span class="card-tag">{tag}</span>
                      {/each}
                    </div>
                  {/if}
                  {#if (card.checklist ?? []).length > 0}
                    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
                    <div
                      class="card-checklist"
                      onclick={(e) => e.stopPropagation()}
                      onkeydown={(e) => e.stopPropagation()}
                      role="group"
                    >
                      <div class="checklist-progress-row">
                        <div class="checklist-progress-bar">
                          <div
                            class="checklist-progress-fill"
                            style="width: {(card.checklist.filter((i) => i.done).length / card.checklist.length) *
                              100}%"
                          ></div>
                        </div>
                        <span class="checklist-progress-text"
                          >{card.checklist.filter((i) => i.done).length}/{card.checklist.length}</span
                        >
                      </div>
                      {#each card.checklist as item, i}
                        <label class="checklist-check compact">
                          <input type="checkbox" checked={item.done} onchange={() => toggleChecklistItem(card, i)} />
                          <span class:done={item.done}>{item.text}</span>
                        </label>
                      {/each}
                    </div>
                  {/if}
                  <div class="card-meta">
                    {#if card.assignee}
                      <span class="card-assignee">
                        <Icon name="user" size={10} />
                        {card.assignee}
                      </span>
                    {/if}
                    {#if card.dueDate}
                      <span class="card-due" class:overdue={isOverdue(card.dueDate)}>
                        <Icon name="calendar" size={10} />
                        {formatDate(card.dueDate)}
                      </span>
                    {/if}
                  </div>
                  <LinkedItems itemType="kanban" itemId={card.id} />
                </div>
                <div class="card-actions">
                  {#if confirmDeleteId === card.id}
                    <button
                      class="btn-xs btn-danger"
                      onclick={(e) => {
                        e.stopPropagation();
                        deleteCard(card.id);
                      }}>Yes</button
                    >
                    <button
                      class="btn-xs"
                      onclick={(e) => {
                        e.stopPropagation();
                        confirmDeleteId = null;
                      }}>No</button
                    >
                  {:else}
                    <button
                      class="btn-xs btn-danger"
                      onclick={(e) => {
                        e.stopPropagation();
                        confirmDeleteId = card.id;
                      }}><Icon name="close" size={11} /></button
                    >
                  {/if}
                </div>
              </div>
            {/if}
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
              class="edit-input edit-title"
              use:autofocus
              onkeydown={(e) => e.key === 'Enter' && addCard(col.key)}
            />
            <textarea bind:value={newDescription} placeholder="Description (optional)" rows="2" class="edit-input"
            ></textarea>
            <div class="edit-row">
              <input type="text" bind:value={newAssignee} placeholder="Assignee" class="edit-input" />
              <select bind:value={newPriority} class="edit-select">
                {#each PRIORITIES as p}
                  <option value={p.value}>{p.label}</option>
                {/each}
              </select>
            </div>
            <TagInput bind:tags={newTags} placeholder="Add tag..." />
            <div class="color-row">
              <span class="color-label">Color</span>
              {#each COLORS as c}
                <button
                  class="color-dot"
                  class:selected={newColor === c}
                  style="background:{c}"
                  aria-label="Color {c}"
                  onclick={() => (newColor = newColor === c ? '' : c)}
                ></button>
              {/each}
            </div>
            <input type="date" bind:value={newDueDate} class="edit-input" />
            <!-- Checklist -->
            <div class="checklist-section">
              <span class="checklist-label"><Icon name="check" size={11} /> Checklist</span>
              {#each newChecklist as item, i}
                <div class="checklist-item">
                  <label class="checklist-check">
                    <input
                      type="checkbox"
                      checked={item.done}
                      onchange={() => (newChecklist[i].done = !newChecklist[i].done)}
                    />
                    <span class:done={item.done}>{item.text}</span>
                  </label>
                  <button
                    class="checklist-remove"
                    title="Remove"
                    onclick={() => (newChecklist = removeChecklistItem(newChecklist, i))}
                  >
                    <Icon name="close" size={10} />
                  </button>
                </div>
              {/each}
              <div class="checklist-add-row">
                <input
                  type="text"
                  bind:value={newChecklistText}
                  placeholder="Add item..."
                  class="edit-input checklist-add-input"
                  onkeydown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      const result = addChecklistItem(newChecklist, newChecklistText);
                      if (result) {
                        newChecklist = result;
                        newChecklistText = '';
                      }
                    }
                  }}
                />
                <button
                  class="btn-xs"
                  onclick={() => {
                    const result = addChecklistItem(newChecklist, newChecklistText);
                    if (result) {
                      newChecklist = result;
                      newChecklistText = '';
                    }
                  }}
                >
                  <Icon name="plus" size={11} />
                </button>
              </div>
            </div>
            <div class="edit-actions">
              <button class="btn-primary btn-sm" onclick={() => addCard(col.key)}>
                <Icon name="plus" size={13} /> Add
              </button>
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
              newTags = [];
              newChecklist = [];
              newChecklistText = '';
            }}
          >
            <Icon name="plus" size={14} /> Add Card
          </button>
        {/if}
      </div>
    {/each}
  </div>
</div>

<style>
  .page {
    max-width: 1200px;
  }

  .total-badge {
    font-size: 0.68rem;
    font-weight: 600;
    color: var(--text-muted);
    background: var(--bg-hover);
    padding: 2px 8px;
    border-radius: 10px;
  }

  .archive-toggle {
    display: flex;
    align-items: center;
    gap: 5px;
    font-size: 0.78rem;
    color: var(--text-muted);
    cursor: pointer;
  }

  .board {
    display: grid;
    gap: 0.75rem;
    min-height: 60vh;
  }

  @media (max-width: 700px) {
    .board {
      grid-template-columns: 1fr !important;
    }
  }

  .column {
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 0.6rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    transition: border-color 0.15s;
  }

  .column.drag-over {
    border-color: var(--accent);
    background: color-mix(in srgb, var(--accent) 4%, var(--bg-secondary));
  }

  .column-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.2rem 0.3rem 0.45rem;
    border-bottom: 2px solid color-mix(in srgb, var(--col-accent) 30%, transparent);
  }

  .column-title {
    display: flex;
    align-items: center;
    gap: 6px;
    color: var(--col-accent);
  }

  .column-header h2 {
    margin: 0;
    font-size: 0.85rem;
    font-weight: 600;
    color: var(--text-primary);
  }

  .count {
    background: var(--bg-primary);
    border-radius: 10px;
    padding: 0.1rem 0.5rem;
    font-size: 0.72rem;
    color: var(--text-muted);
    font-weight: 600;
  }

  .column-cards {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    flex: 1;
    min-height: 2rem;
  }

  .kanban-card {
    padding: 0.55rem 0.65rem;
    cursor: grab;
    position: relative;
    overflow: hidden;
    transition:
      box-shadow 0.15s,
      transform 0.1s;
  }

  .kanban-card:hover:not(.edit-form) {
    box-shadow:
      0 2px 8px rgba(0, 0, 0, 0.08),
      0 0 0 1px var(--border);
    transform: translateY(-1px);
  }

  .kanban-card:active:not(.edit-form) {
    cursor: grabbing;
    transform: translateY(0);
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
    margin: -1px 0;
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
    width: 3px;
    height: 100%;
    border-radius: 4px 0 0 4px;
  }

  .card-body {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    padding-left: 0.2rem;
  }

  .card-title-row {
    display: flex;
    align-items: baseline;
    gap: 6px;
  }

  .card-priority {
    font-size: 0.6rem;
    font-weight: 700;
    font-family: 'JetBrains Mono', monospace;
    flex-shrink: 0;
  }

  .card-title {
    color: var(--text-primary);
    font-size: 0.85rem;
    font-weight: 500;
    line-height: 1.3;
  }

  .card-desc {
    font-size: 0.72rem;
    color: var(--text-muted);
    margin: 2px 0 0;
    line-height: 1.4;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .card-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 3px;
    margin-top: 3px;
  }

  .card-tag {
    font-size: 0.6rem;
    color: var(--purple, #8b5cf6);
    background: color-mix(in srgb, var(--purple, #8b5cf6) 10%, transparent);
    padding: 1px 6px;
    border-radius: 6px;
    white-space: nowrap;
  }

  .card-meta {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 4px;
  }

  .card-assignee {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    font-size: 0.65rem;
    color: var(--accent);
    background: var(--accent-bg);
    padding: 1px 6px;
    border-radius: 8px;
  }

  .card-due {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    font-size: 0.68rem;
    color: var(--text-muted);
  }

  .card-due.overdue {
    color: var(--danger);
    font-weight: 600;
  }

  /* Edit form shared styles */
  .edit-form {
    cursor: default;
  }

  .edit-body {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    padding-left: 0.2rem;
  }

  .edit-input {
    padding: 0.35rem 0.5rem;
    border: 1px solid var(--border);
    border-radius: 6px;
    background: var(--bg-primary);
    color: var(--text-primary);
    font-size: 0.8rem;
    font-family: inherit;
    resize: vertical;
  }

  .edit-title {
    font-weight: 500;
    font-size: 0.88rem;
  }

  .edit-row {
    display: flex;
    gap: 6px;
  }

  .edit-row .edit-input {
    flex: 1;
  }

  .edit-select {
    font-size: 0.78rem;
    font-family: inherit;
    border: 1px solid var(--border);
    border-radius: 6px;
    background: var(--bg-primary);
    color: var(--text-primary);
    padding: 4px 8px;
    cursor: pointer;
  }

  .color-row {
    display: flex;
    align-items: center;
    gap: 0.35rem;
  }

  .color-label {
    font-size: 0.65rem;
    color: var(--text-faint);
    margin-right: 4px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .color-dot {
    width: 18px;
    height: 18px;
    border-radius: 50%;
    border: 2px solid transparent;
    cursor: pointer;
    padding: 0;
    transition: border-color 0.15s;
  }

  .color-dot.selected {
    border-color: var(--text-primary);
  }

  .color-dot:hover:not(.selected) {
    border-color: var(--text-muted);
  }

  .edit-actions {
    display: flex;
    gap: 0.4rem;
    margin-top: 0.15rem;
  }

  .card-actions {
    position: absolute;
    top: 0.35rem;
    right: 0.35rem;
    display: flex;
    gap: 0.2rem;
    opacity: 0;
    transition: opacity 0.15s;
  }

  .kanban-card:hover .card-actions {
    opacity: 1;
  }

  .btn-xs {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0.15rem 0.35rem;
    border: 1px solid var(--border);
    border-radius: 4px;
    background: var(--bg-primary);
    color: var(--text-secondary);
    cursor: pointer;
    font-size: 0.7rem;
  }

  .btn-xs.btn-danger {
    color: var(--danger);
    border-color: color-mix(in srgb, var(--danger) 40%, transparent);
  }

  .add-form {
    padding: 0.6rem;
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }

  .btn-primary {
    display: flex;
    align-items: center;
    gap: 4px;
    background: var(--accent);
    color: #fff;
    border: none;
    border-radius: 5px;
    cursor: pointer;
    font-weight: 600;
  }

  .btn-sm {
    display: flex;
    align-items: center;
    gap: 3px;
    padding: 0.3rem 0.6rem;
    font-size: 0.78rem;
    border: 1px solid var(--border);
    border-radius: 4px;
    background: var(--bg-secondary);
    color: var(--text-secondary);
    cursor: pointer;
  }

  .btn-remind {
    margin-left: auto;
    color: var(--accent);
    border-color: var(--accent);
  }

  .btn-danger-outline {
    color: var(--danger);
    border-color: color-mix(in srgb, var(--danger) 40%, transparent);
  }

  .btn-danger-outline:hover {
    background: var(--danger-bg);
  }

  .add-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    padding: 0.45rem;
    border: 1px dashed var(--border);
    border-radius: 6px;
    background: transparent;
    color: var(--text-muted);
    cursor: pointer;
    font-size: 0.8rem;
    transition:
      border-color 0.15s,
      color 0.15s;
  }

  .add-btn:hover {
    border-color: var(--accent);
    color: var(--accent);
  }

  /* Checklist */
  .checklist-section {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .checklist-label {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 0.65rem;
    color: var(--text-faint);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .card-checklist {
    display: flex;
    flex-direction: column;
    gap: 2px;
    margin-top: 4px;
  }

  .checklist-progress-row {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .checklist-progress-bar {
    flex: 1;
    height: 3px;
    background: var(--border);
    border-radius: 2px;
    overflow: hidden;
  }

  .checklist-progress-fill {
    height: 100%;
    background: var(--success, #22c55e);
    border-radius: 2px;
    transition: width 0.2s ease;
  }

  .checklist-progress-text {
    font-size: 0.6rem;
    color: var(--text-faint);
    font-family: 'JetBrains Mono', monospace;
    white-space: nowrap;
  }

  .checklist-item {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .checklist-check {
    display: flex;
    align-items: center;
    gap: 5px;
    font-size: 0.75rem;
    color: var(--text-secondary);
    cursor: pointer;
    flex: 1;
  }

  .checklist-check.compact {
    font-size: 0.68rem;
    gap: 4px;
  }

  .checklist-check .done {
    text-decoration: line-through;
    color: var(--text-faint);
  }

  .checklist-check input[type='checkbox'] {
    width: 13px;
    height: 13px;
    accent-color: var(--success, #22c55e);
    cursor: pointer;
  }

  .checklist-remove {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 2px;
    border: none;
    background: transparent;
    color: var(--text-faint);
    cursor: pointer;
    border-radius: 3px;
    opacity: 0;
    transition: all 0.1s;
  }

  .checklist-item:hover .checklist-remove {
    opacity: 1;
  }

  .checklist-remove:hover {
    color: var(--danger);
    background: var(--danger-bg);
  }

  .checklist-add-row {
    display: flex;
    gap: 4px;
    margin-top: 2px;
  }

  .checklist-add-input {
    flex: 1;
    font-size: 0.75rem !important;
    padding: 0.25rem 0.4rem !important;
  }
</style>
