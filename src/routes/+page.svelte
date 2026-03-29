<script lang="ts">
  import type { PageData } from './$types';
  import type { LayoutData } from './$types';
  import { onMount } from 'svelte';
  import { stars } from '$lib/stars';
  import { browser } from '$app/environment';
  import { useShortcuts } from '$lib/shortcuts';
  import { createAutoRefresh } from '$lib/auto-refresh.svelte';
  import Icon from '$lib/components/Icon.svelte';
  import Button from '$lib/components/Button.svelte';
  import Modal from '$lib/components/Modal.svelte';
  import DashboardWidget from '$lib/components/DashboardWidget.svelte';
  import {
    type WidgetInstance,
    type WidgetSize,
    WIDGET_TYPES,
    DASHBOARD_PRESETS,
    getWidgetType,
    getWidgetsByCategory,
    loadLayout,
    saveLayout,
    applyPreset,
    createDefaultLayout,
  } from '$lib/widgets/registry';

  let { data } = $props<{ data: PageData & LayoutData }>();

  // ── Widget layout state ─────────────────────────────────────────────────
  let dashLayout = $state<WidgetInstance[]>(loadLayout());
  let settingsModalOpen = $state(false);
  let settingsTab = $state<'layout' | 'presets' | 'add'>('layout');

  // Pending state for modal edits (apply on confirm)
  let pendingLayout = $state<WidgetInstance[]>([]);

  function openSettingsModal() {
    pendingLayout = dashLayout.map((s) => ({ ...s }));
    settingsTab = 'layout';
    settingsModalOpen = true;
  }

  function applySettings() {
    pendingLayout.forEach((s, i) => (s.order = i));
    dashLayout = [...pendingLayout];
    saveLayout(dashLayout);
    settingsModalOpen = false;
  }

  function applyPresetTemplate(presetId: string) {
    const preset = DASHBOARD_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    pendingLayout = applyPreset(preset);
    settingsTab = 'layout';
  }

  function addWidgetToLayout(typeId: string) {
    const typeDef = getWidgetType(typeId);
    if (!typeDef) return;
    // Check if already in pending layout
    const existing = pendingLayout.find((w) => w.typeId === typeId);
    if (existing) {
      existing.visible = true;
      pendingLayout = [...pendingLayout];
    } else {
      const maxOrder = Math.max(0, ...pendingLayout.map((w) => w.order));
      pendingLayout = [
        ...pendingLayout,
        {
          id: `${typeId}-${Date.now()}`,
          typeId,
          order: maxOrder + 1,
          visible: true,
          size: typeDef.defaultSize,
        },
      ];
    }
    settingsTab = 'layout';
  }

  function removeWidget(id: string) {
    const item = pendingLayout.find((w) => w.id === id);
    if (item) {
      item.visible = false;
      pendingLayout = [...pendingLayout];
    }
  }

  function setSectionSize(id: string, size: WidgetSize) {
    const item = dashLayout.find((s) => s.id === id);
    if (item) {
      item.size = size;
      dashLayout = [...dashLayout];
      saveLayout(dashLayout);
    }
  }

  let orderedWidgets = $derived([...dashLayout].sort((a, b) => a.order - b.order));

  function sizeToSpan(size: WidgetSize): string {
    switch (size) {
      case 'small':
        return 'span 1';
      case 'medium':
        return 'span 2';
      case 'large':
        return 'span 3';
    }
  }

  function widgetLabel(w: WidgetInstance): string {
    return w.label ?? getWidgetType(w.typeId)?.label ?? w.typeId;
  }

  // Available widgets not currently visible in pending layout
  let availableWidgets = $derived.by(() => {
    const visibleTypeIds = new Set(pendingLayout.filter((w) => w.visible).map((w) => w.typeId));
    return WIDGET_TYPES.filter((wt) => !visibleTypeIds.has(wt.id));
  });

  const widgetsByCategory = getWidgetsByCategory();
  const CATEGORY_LABELS: Record<string, string> = {
    system: 'System',
    apps: 'Applications',
    data: 'Data',
    navigation: 'Navigation',
  };

  // ── Drag-and-drop state (live grid) ──────────────────────────────────────
  let draggedId = $state<string | null>(null);
  let dragOverId = $state<string | null>(null);

  function onDragStart(e: DragEvent, id: string) {
    draggedId = id;
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', id);
    }
  }

  function onDragOver(e: DragEvent, id: string) {
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
    dragOverId = id;
  }

  function onDragLeave() {
    dragOverId = null;
  }

  function onDrop(e: DragEvent, targetId: string) {
    e.preventDefault();
    dragOverId = null;
    if (!draggedId || draggedId === targetId) {
      draggedId = null;
      return;
    }
    const fromIdx = dashLayout.findIndex((s) => s.id === draggedId);
    const toIdx = dashLayout.findIndex((s) => s.id === targetId);
    if (fromIdx === -1 || toIdx === -1) {
      draggedId = null;
      return;
    }
    const updated = [...dashLayout];
    const [moved] = updated.splice(fromIdx, 1);
    updated.splice(toIdx, 0, moved);
    updated.forEach((s, i) => (s.order = i));
    dashLayout = updated;
    saveLayout(dashLayout);
    draggedId = null;
  }

  function onDragEnd() {
    draggedId = null;
    dragOverId = null;
  }

  // ── Modal drag-and-drop state ────────────────────────────────────────────
  let modalDraggedId = $state<string | null>(null);
  let modalDragOverId = $state<string | null>(null);

  function onModalDragStart(e: DragEvent, id: string) {
    modalDraggedId = id;
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', id);
    }
  }

  function onModalDragOver(e: DragEvent, id: string) {
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
    modalDragOverId = id;
  }

  function onModalDragLeave() {
    modalDragOverId = null;
  }

  function onModalDrop(e: DragEvent, targetId: string) {
    e.preventDefault();
    modalDragOverId = null;
    if (!modalDraggedId || modalDraggedId === targetId) {
      modalDraggedId = null;
      return;
    }
    const fromIdx = pendingLayout.findIndex((s) => s.id === modalDraggedId);
    const toIdx = pendingLayout.findIndex((s) => s.id === targetId);
    if (fromIdx === -1 || toIdx === -1) {
      modalDraggedId = null;
      return;
    }
    const updated = [...pendingLayout];
    const [moved] = updated.splice(fromIdx, 1);
    updated.splice(toIdx, 0, moved);
    updated.forEach((s, i) => (s.order = i));
    pendingLayout = updated;
    modalDraggedId = null;
  }

  function onModalDragEnd() {
    modalDraggedId = null;
    modalDragOverId = null;
  }

  // ── Data ─────────────────────────────────────────────────────────────────
  let starredFiles = $state<string[]>([]);

  onMount(() => {
    starredFiles = stars.getStarred('file');
    const unsub = stars.subscribe(() => {
      starredFiles = stars.getStarred('file');
    });
    return unsub;
  });

  let dashboard: typeof data.dashboard = $state(undefined as unknown as typeof data.dashboard);
  let system: typeof data.system = $state(undefined as unknown as typeof data.system);
  $effect.pre(() => {
    dashboard = data.dashboard;
    system = data.system;
  });

  async function refreshData() {
    try {
      const res = await fetch('/?_data=routes%2F_page');
      if (res.ok) {
        const fresh = await res.json();
        if (fresh.dashboard) dashboard = fresh.dashboard;
        if (fresh.system) system = fresh.system;
      }
    } catch {}
  }

  // Live refresh every 30s
  const autoRefresh = createAutoRefresh(refreshData, 30000);

  onMount(() => {
    const unsub = useShortcuts([
      {
        id: 'dashboard:refresh',
        page: 'Dashboard',
        description: 'Refresh dashboard data',
        defaultKey: 'r',
        category: 'Actions',
        handler: refreshData,
      },
      {
        id: 'dashboard:settings',
        page: 'Dashboard',
        description: 'Open dashboard settings',
        defaultKey: 'e',
        category: 'Navigation',
        handler: openSettingsModal,
      },
    ]);
    return unsub;
  });

  /** One-line text summary per widget — powers the collapsed section header */
  function getWidgetSummary(typeId: string): string {
    if (!dashboard || !system) return 'Loading…';
    switch (typeId) {
      case 'system-stats':
        return `MEM ${system.memUsedPercent}% · CPU ${system.loadAvg} · UP ${system.uptime}h`;
      case 'disk':
        return dashboard.disk
          .map((d: { mount: string; usePercent: string }) => `${d.mount} ${d.usePercent}`)
          .join(' · ');
      case 'tasks': {
        const t = dashboard.tasks;
        const parts: string[] = [];
        if (t.running) parts.push(`${t.running} running`);
        if (t.failed) parts.push(`${t.failed} failed`);
        parts.push(`${t.scheduled} scheduled`);
        return parts.join(' · ');
      }
      case 'backups':
        return dashboard.backups.lastRun
          ? `${dashboard.backups.total} configs · last: ${dashboard.backups.lastRun.status}`
          : `${dashboard.backups.total} configs`;
      case 'keeper': {
        const k = dashboard.keeper;
        const parts: string[] = [];
        if (k['in-progress']) parts.push(`${k['in-progress']} active`);
        if (k.ready) parts.push(`${k.ready} ready`);
        if (k.backlog) parts.push(`${k.backlog} backlog`);
        return parts.join(' · ') || 'No items';
      }
      case 'notifications':
        return dashboard.notifications > 0 ? `${dashboard.notifications} unread` : 'All caught up';
      case 'notes':
        return `${dashboard.notes} note${dashboard.notes !== 1 ? 's' : ''}`;
      case 'docker':
        return dashboard.docker.total > 0
          ? `${dashboard.docker.running} running · ${dashboard.docker.total} total`
          : 'No containers';
      case 'services':
        return dashboard.services.total > 0
          ? `${dashboard.services.healthy} healthy · ${dashboard.services.total} monitored`
          : 'None configured';
      case 'top-processes':
        return dashboard.topProcesses.length > 0
          ? dashboard.topProcesses
              .slice(0, 3)
              .map((p: { name: string }) => p.name)
              .join(', ')
          : 'No data';
      case 'activity-timeline':
        return dashboard.recentRuns.length > 0 ? `${dashboard.recentRuns.length} recent runs` : 'No activity';
      case 'starred-files':
        return starredFiles.length > 0 ? `${starredFiles.length} starred` : 'None';
      default:
        return '';
    }
  }

  const navWidgets = [
    { href: '/files', icon: 'folder', label: 'Files' },
    { href: '/lights', icon: 'sun', label: 'Lights' },
    { href: '/processes', icon: 'cpu', label: 'Processes' },
    { href: '/tailscale', icon: 'network', label: 'Tailscale' },
    { href: '/keeper', icon: 'bookmark', label: 'Keeper' },
    { href: '/terminal', icon: 'terminal', label: 'Terminal' },
  ];

  const SIZE_OPTIONS: WidgetSize[] = ['small', 'medium', 'large'];
  const SIZE_LABELS: Record<WidgetSize, string> = { small: 'S', medium: 'M', large: 'L' };
</script>

<svelte:head>
  <title>Dashboard | Home Server</title>
</svelte:head>

<div class="page-header-row">
  <h2 class="page-title">Dashboard</h2>
  <button class="icon-btn" aria-label="Dashboard settings" onclick={openSettingsModal}>
    <Icon name="settings" size={14} />
  </button>
</div>
<p class="page-desc">At-a-glance overview of your server's health, running tasks, and quick navigation to all tools.</p>

<!-- Dashboard Settings Modal -->
<Modal bind:open={settingsModalOpen} title="Dashboard Settings" width="520px">
  <!-- Tab bar -->
  <div class="settings-tabs">
    <button class="settings-tab" class:active={settingsTab === 'layout'} onclick={() => (settingsTab = 'layout')}>
      <Icon name="grid" size={13} /> Layout
    </button>
    <button class="settings-tab" class:active={settingsTab === 'presets'} onclick={() => (settingsTab = 'presets')}>
      <Icon name="layout" size={13} /> Presets
    </button>
    <button class="settings-tab" class:active={settingsTab === 'add'} onclick={() => (settingsTab = 'add')}>
      <Icon name="plus" size={13} /> Add Widget
    </button>
  </div>

  {#if settingsTab === 'layout'}
    <!-- Layout editor -->
    <div class="settings-list">
      {#each pendingLayout.filter((s) => s.visible) as s (s.id)}
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div
          class="settings-item"
          class:settings-drag-over={modalDragOverId === s.id}
          draggable="true"
          ondragstart={(e) => onModalDragStart(e, s.id)}
          ondragover={(e) => onModalDragOver(e, s.id)}
          ondragleave={onModalDragLeave}
          ondrop={(e) => onModalDrop(e, s.id)}
          ondragend={onModalDragEnd}
          role="listitem"
        >
          <span class="settings-grip" title="Drag to reorder">
            <Icon name="grip" size={14} />
          </span>
          {#if getWidgetType(s.typeId)}
            <span class="settings-icon"><Icon name={getWidgetType(s.typeId)?.icon ?? 'box'} size={13} /></span>
          {/if}
          <span class="settings-label">{widgetLabel(s)}</span>
          <div class="settings-size-btns">
            {#each SIZE_OPTIONS as sz}
              <button
                class="size-btn"
                class:active={s.size === sz}
                onclick={() => {
                  s.size = sz;
                  pendingLayout = [...pendingLayout];
                }}
              >
                {SIZE_LABELS[sz]}
              </button>
            {/each}
          </div>
          <button class="settings-remove" title="Remove widget" onclick={() => removeWidget(s.id)}>
            <Icon name="x" size={12} />
          </button>
        </div>
      {/each}
    </div>

    {#if pendingLayout.filter((s) => !s.visible).length > 0}
      <div class="settings-hidden-label">
        <Icon name="eye-off" size={12} />
        {pendingLayout.filter((s) => !s.visible).length} hidden widget{pendingLayout.filter((s) => !s.visible)
          .length !== 1
          ? 's'
          : ''}
        <button
          class="settings-show-all"
          onclick={() => {
            pendingLayout.forEach((s) => (s.visible = true));
            pendingLayout = [...pendingLayout];
          }}
        >
          Show all
        </button>
      </div>
    {/if}
  {:else if settingsTab === 'presets'}
    <!-- Preset templates -->
    <div class="presets-grid">
      {#each DASHBOARD_PRESETS as preset}
        <button class="preset-card" onclick={() => applyPresetTemplate(preset.id)}>
          <div class="preset-icon"><Icon name={preset.icon} size={18} /></div>
          <div class="preset-body">
            <div class="preset-name">{preset.label}</div>
            <div class="preset-desc">{preset.description}</div>
            <div class="preset-count">{preset.widgets.length} widget{preset.widgets.length !== 1 ? 's' : ''}</div>
          </div>
        </button>
      {/each}
    </div>
  {:else if settingsTab === 'add'}
    <!-- Add widget catalog -->
    {#if availableWidgets.length === 0}
      <div class="add-empty">
        <Icon name="check" size={18} />
        <span>All widgets are on the dashboard</span>
      </div>
    {:else}
      {#each Object.entries(CATEGORY_LABELS) as [catKey, catLabel]}
        {@const catWidgets = availableWidgets.filter((w) => w.category === catKey)}
        {#if catWidgets.length > 0}
          <div class="add-category">
            <h4 class="add-category-label">{catLabel}</h4>
            <div class="add-list">
              {#each catWidgets as wt}
                <button class="add-item" onclick={() => addWidgetToLayout(wt.id)}>
                  <span class="add-item-icon"><Icon name={wt.icon} size={14} /></span>
                  <div class="add-item-body">
                    <span class="add-item-name">{wt.label}</span>
                    <span class="add-item-desc">{wt.description}</span>
                  </div>
                  <Icon name="plus" size={14} />
                </button>
              {/each}
            </div>
          </div>
        {/if}
      {/each}
    {/if}
  {/if}

  {#snippet footer()}
    <Button size="sm" onclick={() => (settingsModalOpen = false)}>Cancel</Button>
    <Button size="sm" onclick={applySettings}>Apply</Button>
  {/snippet}
</Modal>

<!-- Dashboard Grid -->
<div class="dashboard-grid">
  {#each orderedWidgets as widget (widget.id)}
    {#if widget.visible}
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div
        class="dashboard-section size-{widget.size}"
        class:drag-over={dragOverId === widget.id}
        class:dragging={draggedId === widget.id}
        style="grid-column: {sizeToSpan(widget.size)}"
        draggable="true"
        ondragstart={(e) => onDragStart(e, widget.id)}
        ondragover={(e) => onDragOver(e, widget.id)}
        ondragleave={onDragLeave}
        ondrop={(e) => onDrop(e, widget.id)}
        ondragend={onDragEnd}
        role="listitem"
      >
        <div class="section-drag-header">
          <span class="drag-handle" title="Drag to reorder">
            <Icon name="grip" size={14} />
          </span>
          <span class="section-drag-label">{widgetLabel(widget)}</span>
          {#if dashboard && system && getWidgetSummary(widget.typeId)}
            <span class="section-summary">{getWidgetSummary(widget.typeId)}</span>
          {/if}
          <div class="section-size-toggle">
            {#each SIZE_OPTIONS as sz}
              <button
                class="size-btn-inline"
                class:active={widget.size === sz}
                onclick={() => setSectionSize(widget.id, sz)}
                title="{sz} size"
              >
                {SIZE_LABELS[sz]}
              </button>
            {/each}
          </div>
        </div>

        {#if dashboard && system}
          <DashboardWidget {widget} {dashboard} {system} {starredFiles} {navWidgets} onrefresh={refreshData} />
        {:else}
          <div class="widget-loading">Loading…</div>
        {/if}
      </div>
    {/if}
  {/each}
</div>

<style>
  .page-header-row {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 4px;
  }

  .page-header-row .page-title {
    margin-bottom: 0;
  }

  h2 {
    font-size: 1.3rem;
    margin-bottom: 16px;
  }

  /* ── Dashboard Grid ─────────────────────────────────────────────────── */
  .dashboard-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(320px, 100%), 1fr));
    gap: 16px;
  }

  @media (max-width: 400px) {
    .dashboard-grid {
      grid-template-columns: 1fr;
    }
  }

  /* ── Section sizing ─────────────────────────────────────────────────── */
  .dashboard-section {
    position: relative;
    transition:
      opacity 0.15s,
      transform 0.15s;
    min-width: 0;
  }

  .dashboard-section.dragging {
    opacity: 0.4;
  }

  .dashboard-section.drag-over {
    border-top: 2px solid var(--accent);
  }

  .widget-loading {
    padding: 2rem;
    text-align: center;
    color: var(--text-muted);
    font-size: 0.85rem;
  }

  /* ── Drag header ────────────────────────────────────────────────────── */
  .section-drag-header {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 4px;
    padding: 2px 0;
  }

  .drag-handle {
    cursor: grab;
    color: var(--text-faint);
    display: inline-flex;
    align-items: center;
    padding: 2px;
    border-radius: 3px;
    transition:
      color 0.15s,
      background 0.15s;
    flex-shrink: 0;
  }

  .drag-handle:hover {
    color: var(--text-secondary);
    background: var(--bg-inset);
  }

  .drag-handle:active {
    cursor: grabbing;
  }

  .section-drag-label {
    font-size: 0.68rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--text-faint);
    user-select: none;
    flex: 1;
  }

  .section-summary {
    font-size: 0.6rem;
    color: var(--text-faint);
    font-family: 'JetBrains Mono', monospace;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 200px;
  }

  /* ── Size toggle (inline in header) ─────────────────────────────────── */
  .section-size-toggle {
    display: flex;
    gap: 2px;
    margin-left: auto;
  }

  .size-btn-inline {
    background: none;
    border: 1px solid var(--border-subtle);
    border-radius: 3px;
    color: var(--text-faint);
    font-size: 0.6rem;
    font-weight: 600;
    padding: 1px 5px;
    cursor: pointer;
    line-height: 1.4;
    transition:
      border-color 0.15s,
      color 0.15s,
      background 0.15s;
  }

  .size-btn-inline:hover {
    border-color: var(--border);
    color: var(--text-secondary);
  }

  .size-btn-inline.active {
    background: var(--accent);
    border-color: var(--accent);
    color: var(--bg-primary);
  }

  /* ── Settings Modal Tabs ─────────────────────────────────────────────── */
  .settings-tabs {
    display: flex;
    gap: 2px;
    margin-bottom: 12px;
    border-bottom: 1px solid var(--border-subtle);
    padding-bottom: 8px;
  }

  .settings-tab {
    display: flex;
    align-items: center;
    gap: 5px;
    background: none;
    border: none;
    padding: 6px 12px;
    font-size: 0.78rem;
    font-family: inherit;
    color: var(--text-muted);
    border-radius: 6px;
    cursor: pointer;
    transition:
      color 0.15s,
      background 0.15s;
  }

  .settings-tab:hover {
    color: var(--text-secondary);
    background: var(--bg-inset);
  }

  .settings-tab.active {
    color: var(--accent);
    background: var(--bg-inset);
    font-weight: 600;
  }

  /* ── Settings Layout List ────────────────────────────────────────────── */
  .settings-list {
    display: flex;
    flex-direction: column;
    gap: 4px;
    max-height: 400px;
    overflow-y: auto;
  }

  .settings-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 8px;
    border-radius: 6px;
    border: 1px solid transparent;
    transition:
      background 0.15s,
      border-color 0.15s;
  }

  .settings-item:hover {
    background: var(--bg-inset);
  }

  .settings-item.settings-drag-over {
    border-color: var(--accent);
  }

  .settings-grip {
    cursor: grab;
    color: var(--text-faint);
    display: inline-flex;
    align-items: center;
    flex-shrink: 0;
  }

  .settings-grip:active {
    cursor: grabbing;
  }

  .settings-icon {
    color: var(--text-muted);
    display: inline-flex;
    flex-shrink: 0;
  }

  .settings-label {
    flex: 1;
    font-size: 0.8rem;
    color: var(--text-secondary);
  }

  .settings-size-btns {
    display: flex;
    gap: 2px;
  }

  .size-btn {
    background: none;
    border: 1px solid var(--border-subtle);
    border-radius: 3px;
    color: var(--text-faint);
    font-size: 0.65rem;
    font-weight: 600;
    padding: 2px 7px;
    cursor: pointer;
    line-height: 1.4;
    transition:
      border-color 0.15s,
      color 0.15s,
      background 0.15s;
  }

  .size-btn:hover {
    border-color: var(--border);
    color: var(--text-secondary);
  }

  .size-btn.active {
    background: var(--accent);
    border-color: var(--accent);
    color: var(--bg-primary);
  }

  .settings-remove {
    background: none;
    border: none;
    color: var(--text-faint);
    cursor: pointer;
    padding: 2px;
    border-radius: 3px;
    display: inline-flex;
    transition:
      color 0.15s,
      background 0.15s;
  }

  .settings-remove:hover {
    color: var(--danger);
    background: var(--danger-bg);
  }

  .settings-hidden-label {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 0.72rem;
    color: var(--text-faint);
    padding: 8px 4px 0;
  }

  .settings-show-all {
    background: none;
    border: none;
    color: var(--accent);
    font-size: 0.72rem;
    font-family: inherit;
    cursor: pointer;
    padding: 0;
    text-decoration: underline;
  }

  .settings-show-all:hover {
    color: var(--text-primary);
  }

  /* ── Presets Grid ────────────────────────────────────────────────────── */
  .presets-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 8px;
  }

  .preset-card {
    display: flex;
    gap: 10px;
    align-items: flex-start;
    padding: 12px;
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: 8px;
    cursor: pointer;
    text-align: left;
    font-family: inherit;
    transition:
      border-color 0.15s,
      background 0.15s;
  }

  .preset-card:hover {
    border-color: var(--accent);
    background: var(--bg-hover);
  }

  .preset-icon {
    color: var(--accent);
    flex-shrink: 0;
    padding-top: 2px;
  }

  .preset-body {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .preset-name {
    font-size: 0.82rem;
    font-weight: 600;
    color: var(--text-primary);
  }

  .preset-desc {
    font-size: 0.7rem;
    color: var(--text-muted);
  }

  .preset-count {
    font-size: 0.62rem;
    color: var(--text-faint);
    font-family: 'JetBrains Mono', monospace;
    margin-top: 2px;
  }

  /* ── Add Widget Catalog ──────────────────────────────────────────────── */
  .add-empty {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 20px;
    justify-content: center;
    color: var(--success);
    font-size: 0.82rem;
  }

  .add-category {
    margin-bottom: 12px;
  }

  .add-category-label {
    font-size: 0.65rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--text-faint);
    margin: 0 0 6px;
  }

  .add-list {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .add-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 10px;
    background: none;
    border: 1px solid var(--border-subtle);
    border-radius: 6px;
    cursor: pointer;
    font-family: inherit;
    text-align: left;
    transition:
      border-color 0.15s,
      background 0.15s;
    width: 100%;
  }

  .add-item:hover {
    border-color: var(--accent);
    background: var(--bg-hover);
  }

  .add-item-icon {
    color: var(--text-muted);
    flex-shrink: 0;
    display: inline-flex;
  }

  .add-item-body {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 1px;
    min-width: 0;
  }

  .add-item-name {
    font-size: 0.78rem;
    color: var(--text-primary);
    font-weight: 500;
  }

  .add-item-desc {
    font-size: 0.65rem;
    color: var(--text-faint);
  }

  /* ── Responsive ─────────────────────────────────────────────────────── */
  @media (max-width: 767px) {
    .dashboard-grid {
      grid-template-columns: 1fr;
    }

    .dashboard-section {
      grid-column: span 1 !important;
    }

    .section-size-toggle {
      display: none;
    }
  }
</style>
