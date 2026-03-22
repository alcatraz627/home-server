<script lang="ts">
  import type { PageData } from './$types';
  import type { LayoutData } from './$types';
  import { onMount } from 'svelte';
  import { stars } from '$lib/stars';
  import { browser } from '$app/environment';
  import Icon from '$lib/components/Icon.svelte';
  import Button from '$lib/components/Button.svelte';
  import Modal from '$lib/components/Modal.svelte';
  import { goto } from '$app/navigation';

  let { data } = $props<{ data: PageData & LayoutData }>();

  // ── Dashboard section config ─────────────────────────────────────────────
  const DASHBOARD_SECTIONS = [
    { key: 'system-stats', label: 'System Stats' },
    { key: 'tasks', label: 'Tasks' },
    { key: 'backups', label: 'Backups' },
    { key: 'keeper', label: 'Keeper' },
    { key: 'disk', label: 'Disk' },
    { key: 'activity-timeline', label: 'Activity Timeline' },
    { key: 'top-processes', label: 'Top Processes' },
    { key: 'quick-nav', label: 'Quick Nav' },
    { key: 'quick-actions', label: 'Quick Actions' },
    { key: 'starred-files', label: 'Starred Files' },
  ] as const;

  type SectionKey = (typeof DASHBOARD_SECTIONS)[number]['key'];
  type SectionSize = 'small' | 'medium' | 'large';

  interface SectionLayout {
    id: string;
    order: number;
    visible: boolean;
    size: SectionSize;
  }

  const DASH_LAYOUT_KEY = 'hs:dashboard-layout';

  const DEFAULT_SIZES: Record<SectionKey, SectionSize> = {
    'system-stats': 'medium',
    tasks: 'small',
    backups: 'small',
    keeper: 'small',
    disk: 'medium',
    'activity-timeline': 'medium',
    'top-processes': 'medium',
    'quick-nav': 'medium',
    'quick-actions': 'large',
    'starred-files': 'medium',
  };

  function loadDashLayout(): SectionLayout[] {
    if (!browser)
      return DASHBOARD_SECTIONS.map((s, i) => ({
        id: s.key,
        order: i,
        visible: true,
        size: DEFAULT_SIZES[s.key],
      }));
    try {
      const raw = localStorage.getItem(DASH_LAYOUT_KEY);
      if (raw) {
        const parsed: SectionLayout[] = JSON.parse(raw);
        // Ensure all sections exist (handle new sections added later)
        const existingIds = new Set(parsed.map((p) => p.id));
        let maxOrder = Math.max(...parsed.map((p) => p.order));
        for (const s of DASHBOARD_SECTIONS) {
          if (!existingIds.has(s.key)) {
            parsed.push({ id: s.key, order: ++maxOrder, visible: true, size: DEFAULT_SIZES[s.key] });
          }
        }
        // Backfill size for old layouts missing it
        for (const p of parsed) {
          if (!p.size) p.size = DEFAULT_SIZES[p.id as SectionKey] ?? 'medium';
        }
        // Remove sections that no longer exist
        const validKeys = DASHBOARD_SECTIONS.map((s) => s.key);
        return parsed
          .filter((p) => validKeys.includes(p.id as any))
          .sort((a, b) => a.order - b.order) as SectionLayout[];
      }
    } catch {}
    return DASHBOARD_SECTIONS.map((s, i) => ({
      id: s.key,
      order: i,
      visible: true,
      size: DEFAULT_SIZES[s.key],
    }));
  }

  let dashLayout = $state<SectionLayout[]>(loadDashLayout());
  let settingsModalOpen = $state(false);

  // Pending state for modal edits (apply on confirm)
  let pendingLayout = $state<SectionLayout[]>([]);

  function openSettingsModal() {
    pendingLayout = dashLayout.map((s) => ({ ...s }));
    settingsModalOpen = true;
  }

  function applySettings() {
    // Re-assign order values based on current position
    pendingLayout.forEach((s, i) => (s.order = i));
    dashLayout = [...pendingLayout];
    saveDashLayout();
    settingsModalOpen = false;
  }

  function saveDashLayout() {
    if (browser) localStorage.setItem(DASH_LAYOUT_KEY, JSON.stringify(dashLayout));
  }

  function isSectionVisible(key: SectionKey): boolean {
    const item = dashLayout.find((s) => s.id === key);
    return item ? item.visible : true;
  }

  function getSectionSize(key: SectionKey): SectionSize {
    const item = dashLayout.find((s) => s.id === key);
    return item?.size ?? 'medium';
  }

  function setSectionSize(key: SectionKey, size: SectionSize) {
    const item = dashLayout.find((s) => s.id === key);
    if (item) {
      item.size = size;
      dashLayout = [...dashLayout];
      saveDashLayout();
    }
  }

  let orderedSections = $derived([...dashLayout].sort((a, b) => a.order - b.order));

  function sectionLabel(key: string): string {
    return DASHBOARD_SECTIONS.find((s) => s.key === key)?.label ?? key;
  }

  function sizeToSpan(size: SectionSize): string {
    switch (size) {
      case 'small':
        return 'span 1';
      case 'medium':
        return 'span 2';
      case 'large':
        return 'span 3';
    }
  }

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
    saveDashLayout();
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

  // Starred files for quick-access
  let starredFiles = $state<string[]>([]);

  onMount(() => {
    starredFiles = stars.getStarred('file');
    const unsub = stars.subscribe(() => {
      starredFiles = stars.getStarred('file');
    });
    return unsub;
  });
  let dashboard = $state(data.dashboard);
  let system = $state(data.system);

  // Live refresh every 30s
  let refreshTimer: ReturnType<typeof setInterval> | null = null;

  onMount(() => {
    refreshTimer = setInterval(async () => {
      try {
        const res = await fetch('/?_data=routes%2F_page');
        if (res.ok) {
          const fresh = await res.json();
          if (fresh.dashboard) dashboard = fresh.dashboard;
          if (fresh.system) system = fresh.system;
        }
      } catch {}
    }, 30000);
    return () => {
      if (refreshTimer) clearInterval(refreshTimer);
    };
  });

  function formatRelativeTime(iso: string): string {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  }

  const memColor = $derived(
    system.memUsedPercent >= 90 ? 'var(--danger)' : system.memUsedPercent >= 70 ? 'var(--warning)' : 'var(--success)',
  );

  const loadColor = $derived.by(() => {
    const ratio = system.loadAvg / system.cpuCount;
    return ratio >= 0.9 ? 'var(--danger)' : ratio >= 0.7 ? 'var(--warning)' : 'var(--success)';
  });

  function diskUsagePercent(d: { usePercent: string }): number {
    return parseInt(d.usePercent) || 0;
  }

  function diskColor(pct: number): string {
    return pct > 90 ? 'var(--danger)' : pct > 70 ? 'var(--warning)' : 'var(--success)';
  }

  const widgets = [
    { href: '/files', icon: 'folder', label: 'Files' },
    { href: '/lights', icon: 'sun', label: 'Lights' },
    { href: '/processes', icon: 'cpu', label: 'Processes' },
    { href: '/tailscale', icon: 'network', label: 'Tailscale' },
    { href: '/keeper', icon: 'bookmark', label: 'Keeper' },
    { href: '/terminal', icon: 'terminal', label: 'Terminal' },
  ];

  const SIZE_OPTIONS: SectionSize[] = ['small', 'medium', 'large'];
  const SIZE_LABELS: Record<SectionSize, string> = { small: 'S', medium: 'M', large: 'L' };
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
<Modal bind:open={settingsModalOpen} title="Dashboard Settings" width="480px">
  <div class="settings-list">
    {#each pendingLayout as s, i (s.id)}
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
        <label class="settings-vis">
          <input
            type="checkbox"
            checked={s.visible}
            onchange={() => {
              s.visible = !s.visible;
              pendingLayout = [...pendingLayout];
            }}
          />
        </label>
        <span class="settings-label">{sectionLabel(s.id)}</span>
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
      </div>
    {/each}
  </div>
  {#snippet footer()}
    <Button size="sm" onclick={() => (settingsModalOpen = false)}>Cancel</Button>
    <Button size="sm" onclick={applySettings}>Apply</Button>
  {/snippet}
</Modal>

<!-- Dashboard Grid -->
<div class="dashboard-grid">
  {#each orderedSections as section (section.id)}
    {#if section.visible}
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div
        class="dashboard-section size-{section.size}"
        class:drag-over={dragOverId === section.id}
        class:dragging={draggedId === section.id}
        style="grid-column: {sizeToSpan(section.size)}"
        draggable="true"
        ondragstart={(e) => onDragStart(e, section.id)}
        ondragover={(e) => onDragOver(e, section.id)}
        ondragleave={onDragLeave}
        ondrop={(e) => onDrop(e, section.id)}
        ondragend={onDragEnd}
        role="listitem"
      >
        <div class="section-drag-header">
          <span class="drag-handle" title="Drag to reorder">
            <Icon name="grip" size={14} />
          </span>
          <span class="section-drag-label">{sectionLabel(section.id)}</span>
          <div class="section-size-toggle">
            {#each SIZE_OPTIONS as sz}
              <button
                class="size-btn-inline"
                class:active={section.size === sz}
                onclick={() => setSectionSize(section.id as SectionKey, sz)}
                title="{sz} size"
              >
                {SIZE_LABELS[sz]}
              </button>
            {/each}
          </div>
        </div>

        {#if section.id === 'quick-actions'}
          <div class="quick-actions">
            <Button size="sm" onclick={() => goto('/lights')}>
              <Icon name="search" size={12} /> Scan Lights
            </Button>
            <Button size="sm" onclick={() => goto('/backups')}>
              <Icon name="save" size={12} /> Run Backup
            </Button>
            <Button size="sm" onclick={() => goto('/terminal')}>
              <Icon name="terminal" size={12} /> New Terminal
            </Button>
            <Button
              size="sm"
              onclick={async () => {
                try {
                  const res = await fetch('/?_data=routes%2F_page');
                  if (res.ok) {
                    const fresh = await res.json();
                    if (fresh.dashboard) dashboard = fresh.dashboard;
                    if (fresh.system) system = fresh.system;
                  }
                } catch {}
              }}
            >
              <Icon name="refresh" size={12} /> Refresh Stats
            </Button>
          </div>
        {:else if section.id === 'system-stats'}
          {@const sectionSize = section.size}
          {#if sectionSize === 'small'}
            <!-- Compact: just numbers -->
            <div class="stats-compact">
              <div class="stat-compact-item">
                <span class="stat-compact-label">MEM</span>
                <span class="stat-compact-value" style="color: {memColor}">{system.memUsedPercent}%</span>
              </div>
              <div class="stat-compact-item">
                <span class="stat-compact-label">CPU</span>
                <span class="stat-compact-value" style="color: {loadColor}">{system.loadAvg}</span>
              </div>
              <div class="stat-compact-item">
                <span class="stat-compact-label">UP</span>
                <span class="stat-compact-value">{system.uptime}h</span>
              </div>
            </div>
          {:else if sectionSize === 'large'}
            <!-- Large: numbers + bars + mini charts -->
            <div class="stats-row">
              <div class="stat-card card-stagger" style="animation-delay: 0ms">
                <div class="stat-header">Memory</div>
                <div class="stat-value" style="color: {memColor}">{system.memUsedPercent}%</div>
                <div class="stat-bar">
                  <div class="stat-fill" style="width: {system.memUsedPercent}%; background: {memColor}"></div>
                </div>
                <svg class="stat-sparkline" viewBox="0 0 60 20" preserveAspectRatio="none">
                  <rect
                    x="0"
                    y={20 - (system.memUsedPercent / 100) * 20}
                    width="60"
                    height={(system.memUsedPercent / 100) * 20}
                    fill={memColor}
                    opacity="0.2"
                    rx="2"
                  />
                  <line
                    x1="0"
                    y1={20 - (system.memUsedPercent / 100) * 20}
                    x2="60"
                    y2={20 - (system.memUsedPercent / 100) * 20}
                    stroke={memColor}
                    stroke-width="1.5"
                  />
                </svg>
                <div class="stat-detail">{system.memTotal} GB total</div>
              </div>

              <div class="stat-card card-stagger" style="animation-delay: 40ms">
                <div class="stat-header">CPU Load</div>
                <div class="stat-value" style="color: {loadColor}">{system.loadAvg}</div>
                <div class="stat-bar">
                  <div
                    class="stat-fill"
                    style="width: {Math.min(100, (system.loadAvg / system.cpuCount) * 100)}%; background: {loadColor}"
                  ></div>
                </div>
                <svg class="stat-sparkline" viewBox="0 0 60 20" preserveAspectRatio="none">
                  <rect
                    x="0"
                    y={20 - (Math.min(100, (system.loadAvg / system.cpuCount) * 100) / 100) * 20}
                    width="60"
                    height={(Math.min(100, (system.loadAvg / system.cpuCount) * 100) / 100) * 20}
                    fill={loadColor}
                    opacity="0.2"
                    rx="2"
                  />
                  <line
                    x1="0"
                    y1={20 - (Math.min(100, (system.loadAvg / system.cpuCount) * 100) / 100) * 20}
                    x2="60"
                    y2={20 - (Math.min(100, (system.loadAvg / system.cpuCount) * 100) / 100) * 20}
                    stroke={loadColor}
                    stroke-width="1.5"
                  />
                </svg>
                <div class="stat-detail">{system.cpuCount} cores</div>
              </div>

              <div class="stat-card card-stagger" style="animation-delay: 80ms">
                <div class="stat-header">Uptime</div>
                <div class="stat-value">{system.uptime}h</div>
                <div class="stat-detail">{Math.floor(system.uptime / 24)}d {system.uptime % 24}h</div>
              </div>
            </div>
          {:else}
            <!-- Medium: numbers + bars (default/current) -->
            <div class="stats-row">
              <div class="stat-card card-stagger" style="animation-delay: 0ms">
                <div class="stat-header">Memory</div>
                <div class="stat-value" style="color: {memColor}">{system.memUsedPercent}%</div>
                <div class="stat-bar">
                  <div class="stat-fill" style="width: {system.memUsedPercent}%; background: {memColor}"></div>
                </div>
                <div class="stat-detail">{system.memTotal} GB total</div>
              </div>

              <div class="stat-card card-stagger" style="animation-delay: 40ms">
                <div class="stat-header">CPU Load</div>
                <div class="stat-value" style="color: {loadColor}">{system.loadAvg}</div>
                <div class="stat-bar">
                  <div
                    class="stat-fill"
                    style="width: {Math.min(100, (system.loadAvg / system.cpuCount) * 100)}%; background: {loadColor}"
                  ></div>
                </div>
                <div class="stat-detail">{system.cpuCount} cores</div>
              </div>

              <div class="stat-card card-stagger" style="animation-delay: 80ms">
                <div class="stat-header">Uptime</div>
                <div class="stat-value">{system.uptime}h</div>
                <div class="stat-detail">{Math.floor(system.uptime / 24)}d {system.uptime % 24}h</div>
              </div>
            </div>
          {/if}
        {:else if section.id === 'disk'}
          {@const sectionSize = section.size}
          {#if sectionSize === 'small'}
            <!-- Compact: just usage % per mount -->
            <div class="stats-compact">
              {#each dashboard.disk as d}
                {@const pct = diskUsagePercent(d)}
                {@const color = diskColor(pct)}
                <div class="stat-compact-item">
                  <span class="stat-compact-label">{d.mount}</span>
                  <span class="stat-compact-value" style="color: {color}">{d.usePercent}</span>
                </div>
              {/each}
            </div>
          {:else}
            <!-- Medium/Large: usage bars -->
            <div class="stats-row">
              {#each dashboard.disk as d, i}
                {@const pct = diskUsagePercent(d)}
                {@const color = diskColor(pct)}
                <div class="stat-card card-stagger" style="animation-delay: {i * 40}ms">
                  <div class="stat-header">Disk <code>{d.mount}</code></div>
                  <div class="stat-value" style="color: {color}">{d.usePercent}</div>
                  <div class="stat-bar">
                    <div class="stat-fill" style="width: {d.usePercent}; background: {color}"></div>
                  </div>
                  {#if sectionSize === 'large'}
                    <svg class="disk-sparkline" viewBox="0 0 60 20" preserveAspectRatio="none">
                      <rect
                        x="0"
                        y={20 - (pct / 100) * 20}
                        width="60"
                        height={(pct / 100) * 20}
                        fill={color}
                        opacity="0.2"
                        rx="2"
                      />
                      <line
                        x1="0"
                        y1={20 - (pct / 100) * 20}
                        x2="60"
                        y2={20 - (pct / 100) * 20}
                        stroke={color}
                        stroke-width="1.5"
                      />
                    </svg>
                  {/if}
                  <div class="stat-detail">
                    {d.used} / {d.total}
                    {#if d.fstype}<span class="disk-fstype">{d.fstype}</span>{/if}
                  </div>
                  {#if d.device}
                    <div class="stat-device" title={d.device}>{d.device.split('/').pop()}</div>
                  {/if}
                </div>
              {/each}
            </div>
          {/if}
        {:else if section.id === 'tasks'}
          {@const sectionSize = section.size}
          <div class="status-grid">
            <a href="/tasks" class="status-card card-stagger" style="animation-delay: 0ms">
              {#if sectionSize !== 'small'}
                <div class="status-icon"><Icon name="settings" size={18} /></div>
              {/if}
              <div class="status-body">
                {#if sectionSize !== 'small'}<h3>Tasks</h3>{/if}
                <div class="status-metrics">
                  {#if dashboard.tasks.running > 0}
                    <span class="metric running">{dashboard.tasks.running} running</span>
                  {/if}
                  {#if dashboard.tasks.failed > 0}
                    <span class="metric failed">{dashboard.tasks.failed} failed</span>
                  {/if}
                  <span class="metric">{dashboard.tasks.scheduled} scheduled</span>
                  {#if sectionSize !== 'small'}
                    <span class="metric muted">{dashboard.tasks.total} total</span>
                  {/if}
                </div>
              </div>
            </a>
          </div>
        {:else if section.id === 'backups'}
          {@const sectionSize = section.size}
          <div class="status-grid">
            <a href="/backups" class="status-card card-stagger" style="animation-delay: 0ms">
              {#if sectionSize !== 'small'}
                <div class="status-icon"><Icon name="rotate" size={18} /></div>
              {/if}
              <div class="status-body">
                {#if sectionSize !== 'small'}<h3>Backups</h3>{/if}
                <div class="status-metrics">
                  <span class="metric muted">{dashboard.backups.total} configs</span>
                  {#if dashboard.backups.lastRun}
                    <span
                      class="metric"
                      class:success={dashboard.backups.lastRun.status === 'success'}
                      class:failed={dashboard.backups.lastRun.status === 'failed'}
                    >
                      {#if sectionSize !== 'small'}{dashboard.backups.lastRun.name}:
                      {/if}{dashboard.backups.lastRun.status}
                    </span>
                    {#if sectionSize !== 'small'}
                      <span class="metric muted">{formatRelativeTime(dashboard.backups.lastRun.time)}</span>
                    {/if}
                  {:else}
                    <span class="metric muted">No runs yet</span>
                  {/if}
                </div>
              </div>
            </a>
          </div>
        {:else if section.id === 'keeper'}
          {@const sectionSize = section.size}
          <div class="status-grid">
            <a href="/keeper" class="status-card card-stagger" style="animation-delay: 0ms">
              {#if sectionSize !== 'small'}
                <div class="status-icon"><Icon name="bookmark" size={18} /></div>
              {/if}
              <div class="status-body">
                {#if sectionSize !== 'small'}<h3>Keeper</h3>{/if}
                <div class="status-metrics">
                  {#if dashboard.keeper['in-progress']}
                    <span class="metric running">{dashboard.keeper['in-progress']} in progress</span>
                  {/if}
                  {#if dashboard.keeper.ready}
                    <span class="metric accent">{dashboard.keeper.ready} ready</span>
                  {/if}
                  {#if sectionSize !== 'small'}
                    {#if dashboard.keeper.backlog}
                      <span class="metric muted">{dashboard.keeper.backlog} backlog</span>
                    {/if}
                    {#if dashboard.keeper.done}
                      <span class="metric success">{dashboard.keeper.done} done</span>
                    {/if}
                  {/if}
                </div>
              </div>
            </a>
          </div>
        {:else if section.id === 'activity-timeline'}
          <div class="detail-card">
            <h3 class="section-title">Recent Activity</h3>
            {#if dashboard.recentRuns.length > 0}
              <div class="timeline">
                {#each section.size === 'small' ? dashboard.recentRuns.slice(0, 3) : dashboard.recentRuns as run}
                  <div class="timeline-item">
                    <span
                      class="timeline-dot"
                      style="background: {run.status === 'success'
                        ? 'var(--success)'
                        : run.status === 'failed' || run.status === 'timeout'
                          ? 'var(--danger)'
                          : 'var(--warning)'}"
                    ></span>
                    <div class="timeline-content">
                      <span class="timeline-name">{run.name}</span>
                      <span class="timeline-meta">
                        {run.status}
                        {#if run.duration}
                          · {run.duration < 1000 ? run.duration + 'ms' : (run.duration / 1000).toFixed(1) + 's'}{/if}
                        · {formatRelativeTime(run.time)}
                      </span>
                    </div>
                  </div>
                {/each}
              </div>
            {:else}
              <p class="detail-empty">No recent task runs</p>
            {/if}
          </div>
        {:else if section.id === 'top-processes'}
          <div class="detail-card">
            <h3 class="section-title">Top Processes</h3>
            {#if dashboard.topProcesses.length > 0}
              <div class="top-procs">
                {#each section.size === 'small' ? dashboard.topProcesses.slice(0, 3) : dashboard.topProcesses as proc}
                  <div class="proc-row">
                    <span class="proc-name">{proc.name}</span>
                    {#if section.size !== 'small'}
                      <div class="proc-bars">
                        <div class="proc-bar">
                          <div class="proc-fill proc-cpu" style="width: {Math.min(100, proc.cpu)}%"></div>
                        </div>
                        <div class="proc-bar">
                          <div class="proc-fill proc-mem" style="width: {Math.min(100, proc.mem)}%"></div>
                        </div>
                      </div>
                    {/if}
                    <span class="proc-vals">{proc.cpu.toFixed(1)}% · {proc.mem.toFixed(1)}%</span>
                  </div>
                {/each}
                {#if section.size !== 'small'}
                  <div class="proc-legend">
                    <span><span class="legend-dot" style="background: var(--accent)"></span> CPU</span>
                    <span><span class="legend-dot" style="background: var(--purple)"></span> MEM</span>
                  </div>
                {/if}
              </div>
            {:else}
              <p class="detail-empty">No process data</p>
            {/if}
          </div>
        {:else if section.id === 'starred-files'}
          {#if starredFiles.length > 0}
            <h3 class="section-title">Starred Files</h3>
            <div class="starred-files">
              {#each section.size === 'small' ? starredFiles.slice(0, 4) : starredFiles as filePath, i}
                <a
                  href="/files?path={encodeURIComponent(filePath)}"
                  class="starred-file card-stagger"
                  style="animation-delay: {i * 30}ms"
                  title={filePath}
                >
                  <span class="starred-icon">★</span>
                  <span class="starred-name">{filePath.split('/').pop()}</span>
                  {#if section.size !== 'small'}
                    <span class="starred-path">{filePath.split('/').slice(0, -1).join('/')}</span>
                  {/if}
                </a>
              {/each}
            </div>
          {/if}
        {:else if section.id === 'quick-nav'}
          <h3 class="section-title">Quick Access</h3>
          <div class="nav-grid">
            {#each widgets as w, i}
              <a href={w.href} class="nav-card card-stagger" style="animation-delay: {i * 40}ms">
                <span class="nav-icon"><Icon name={w.icon} size={18} /></span>
                <span>{w.label}</span>
              </a>
            {/each}
          </div>
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
  h3 {
    font-size: 1rem;
  }
  .section-title {
    margin: 0 0 12px;
    color: var(--text-muted);
    font-size: 0.8rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
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

  /* ── Quick Actions ──────────────────────────────────────────────────── */
  .quick-actions {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }

  /* ── System Stats ───────────────────────────────────────────────────── */
  .stats-row {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(150px, 100%), 1fr));
    gap: 12px;
  }

  .stats-compact {
    display: flex;
    flex-wrap: wrap;
    gap: 8px 16px;
  }

  .stat-compact-item {
    display: flex;
    align-items: baseline;
    gap: 6px;
  }

  .stat-compact-label {
    font-size: 0.65rem;
    color: var(--text-faint);
    text-transform: uppercase;
    letter-spacing: 0.04em;
    font-weight: 600;
  }

  .stat-compact-value {
    font-size: 1.1rem;
    font-weight: 700;
    font-family: 'JetBrains Mono', monospace;
  }

  .stat-card {
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 14px;
  }

  .stat-header {
    font-size: 0.7rem;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.04em;
    margin-bottom: 6px;
  }

  .stat-header code {
    font-size: 0.65rem;
    text-transform: none;
    letter-spacing: 0;
  }

  .stat-value {
    font-size: 1.4rem;
    font-weight: 700;
    font-family: 'JetBrains Mono', monospace;
    line-height: 1.2;
  }

  .stat-bar {
    height: 4px;
    background: var(--border-subtle);
    border-radius: 2px;
    margin: 8px 0 6px;
    overflow: hidden;
  }

  .stat-fill {
    height: 100%;
    border-radius: 2px;
    transition: width 0.3s;
  }

  .stat-detail {
    font-size: 0.65rem;
    color: var(--text-faint);
    font-family: 'JetBrains Mono', monospace;
    display: flex;
    align-items: center;
    gap: 4px;
    flex-wrap: wrap;
  }

  .stat-sparkline,
  .disk-sparkline {
    width: 60px;
    height: 20px;
    margin: 4px 0 2px;
  }

  .disk-fstype {
    font-size: 0.55rem;
    color: var(--text-faint);
    background: var(--bg-inset);
    padding: 1px 3px;
    border-radius: 3px;
  }

  .stat-device {
    font-size: 0.55rem;
    color: var(--text-faint);
    font-family: 'JetBrains Mono', monospace;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    margin-top: 2px;
  }

  /* ── Status Cards ───────────────────────────────────────────────────── */
  .status-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 12px;
  }

  .status-card {
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 14px 16px;
    display: flex;
    gap: 12px;
    align-items: flex-start;
    text-decoration: none;
    color: inherit;
    transition: border-color 0.15s;
  }

  .status-card:hover {
    border-color: var(--accent);
  }

  .status-icon {
    font-size: 1.3rem;
    width: 28px;
    text-align: center;
    flex-shrink: 0;
    padding-top: 2px;
  }

  .status-body {
    flex: 1;
    min-width: 0;
  }
  .status-body h3 {
    font-size: 0.9rem;
    margin-bottom: 6px;
  }

  .status-metrics {
    display: flex;
    flex-wrap: wrap;
    gap: 4px 10px;
  }
  .metric {
    font-size: 0.75rem;
    color: var(--text-secondary);
  }
  .metric.muted {
    color: var(--text-faint);
  }
  .metric.running {
    color: var(--warning);
  }
  .metric.failed {
    color: var(--danger);
  }
  .metric.success {
    color: var(--success);
  }
  .metric.accent {
    color: var(--accent);
  }

  /* ── Activity & Processes ───────────────────────────────────────────── */
  .detail-card {
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 14px;
  }

  .detail-empty {
    font-size: 0.75rem;
    color: var(--text-faint);
    text-align: center;
    padding: 16px;
  }

  /* Timeline */
  .timeline {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .timeline-item {
    display: flex;
    align-items: flex-start;
    gap: 10px;
  }

  .timeline-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
    margin-top: 4px;
  }

  .timeline-content {
    display: flex;
    flex-direction: column;
    gap: 1px;
  }

  .timeline-name {
    font-size: 0.78rem;
    color: var(--text-primary);
  }

  .timeline-meta {
    font-size: 0.65rem;
    color: var(--text-faint);
    font-family: 'JetBrains Mono', monospace;
  }

  /* Top Processes */
  .top-procs {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .proc-row {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .proc-name {
    font-size: 0.75rem;
    width: 100px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--text-secondary);
    flex-shrink: 0;
  }

  .proc-bars {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .proc-bar {
    height: 3px;
    background: var(--border-subtle);
    border-radius: 2px;
    overflow: hidden;
  }

  .proc-fill {
    height: 100%;
    border-radius: 2px;
    transition: width 0.3s;
  }

  .proc-cpu {
    background: var(--accent);
  }

  .proc-mem {
    background: var(--purple);
  }

  .proc-vals {
    font-size: 0.6rem;
    color: var(--text-faint);
    font-family: 'JetBrains Mono', monospace;
    white-space: nowrap;
    width: 80px;
    text-align: right;
    flex-shrink: 0;
  }

  .proc-legend {
    display: flex;
    gap: 12px;
    justify-content: flex-end;
    margin-top: 4px;
    font-size: 0.6rem;
    color: var(--text-faint);
  }

  .legend-dot {
    display: inline-block;
    width: 6px;
    height: 6px;
    border-radius: 50%;
    margin-right: 3px;
    vertical-align: middle;
  }

  /* ── Quick Nav ──────────────────────────────────────────────────────── */
  .nav-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
    gap: 10px;
  }

  .nav-card {
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 14px;
    text-decoration: none;
    color: var(--text-secondary);
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 0.85rem;
    transition:
      border-color 0.15s,
      color 0.15s;
  }

  .nav-card:hover {
    border-color: var(--accent);
    color: var(--text-primary);
  }

  .nav-icon {
    font-size: 1.1rem;
  }

  /* ── Starred Files ──────────────────────────────────────────────────── */
  .starred-files {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }

  .starred-file {
    display: flex;
    align-items: center;
    gap: 6px;
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 6px 12px;
    text-decoration: none;
    color: var(--text-secondary);
    font-size: 0.8rem;
    transition:
      border-color 0.15s,
      color 0.15s;
    max-width: 280px;
    overflow: hidden;
  }

  .starred-file:hover {
    border-color: var(--purple);
    color: var(--text-primary);
  }

  .starred-icon {
    color: var(--purple);
    font-size: 0.75rem;
    flex-shrink: 0;
  }

  .starred-name {
    font-weight: 500;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .starred-path {
    font-size: 0.6rem;
    color: var(--text-faint);
    font-family: 'JetBrains Mono', monospace;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    display: none;
  }

  @media (min-width: 640px) {
    .starred-path {
      display: inline;
      max-width: 120px;
    }
  }

  /* ── Settings Modal ─────────────────────────────────────────────────── */
  .settings-list {
    display: flex;
    flex-direction: column;
    gap: 4px;
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

  .settings-vis {
    flex-shrink: 0;
    display: flex;
    align-items: center;
  }

  .settings-vis input[type='checkbox'] {
    accent-color: var(--accent);
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

  /* ── Responsive ─────────────────────────────────────────────────────── */
  @media (max-width: 767px) {
    .dashboard-grid {
      grid-template-columns: 1fr;
    }

    .dashboard-section {
      grid-column: span 1 !important;
    }

    .stats-row {
      grid-template-columns: repeat(2, 1fr);
    }

    .status-grid {
      grid-template-columns: 1fr;
    }

    .section-size-toggle {
      display: none;
    }
  }
</style>
