import { SK_DASHBOARD_LAYOUT, SK_DASHBOARD_LAYOUT_V2 } from '$lib/constants/storage-keys';

/**
 * Widget Registry — defines all available widget types for the dashboard builder.
 *
 * Each widget type specifies its rendering mode, default size, data source,
 * and display configuration. The dashboard layout references widget types by ID
 * and can override per-instance settings (size, label, endpoint params).
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export type WidgetSize = 'small' | 'medium' | 'large';

export type WidgetRenderMode =
  | 'metric' // Single value with optional bar/sparkline
  | 'status' // Icon + label + status metrics (links to a page)
  | 'status-list' // List of name/status pairs
  | 'table' // Tabular data rows
  | 'timeline' // Chronological event list
  | 'processes' // Top processes with CPU/MEM bars
  | 'nav-grid' // Quick navigation card grid
  | 'actions' // Quick action buttons
  | 'file-list' // Starred/recent file links
  | 'disk'; // Disk usage bars (special case of metric array)

/** Static definition of a widget type in the registry */
export interface WidgetTypeDef {
  id: string;
  label: string;
  icon: string;
  description: string;
  renderMode: WidgetRenderMode;
  defaultSize: WidgetSize;
  /** API endpoint to fetch data from (null = client-side only, e.g. nav-grid) */
  endpoint: string | null;
  /** Which page this widget links to (if any) */
  href?: string;
  /** Whether multiple instances make sense */
  allowMultiple: boolean;
  /** Categories for the add-widget picker */
  category: 'system' | 'apps' | 'data' | 'navigation';
}

/** A widget instance placed on the dashboard */
export interface WidgetInstance {
  /** Unique instance ID (e.g. "system-stats" or "metric-cpu-1") */
  id: string;
  /** References a WidgetTypeDef.id */
  typeId: string;
  order: number;
  visible: boolean;
  size: WidgetSize;
  /** Optional per-instance label override */
  label?: string;
}

// ── Registry ──────────────────────────────────────────────────────────────────

export const WIDGET_TYPES: WidgetTypeDef[] = [
  {
    id: 'system-stats',
    label: 'System Stats',
    icon: 'cpu',
    description: 'CPU load, memory usage, and uptime',
    renderMode: 'metric',
    defaultSize: 'medium',
    endpoint: null, // Uses layout server data
    category: 'system',
    allowMultiple: false,
  },
  {
    id: 'disk',
    label: 'Disk Usage',
    icon: 'hard-drive',
    description: 'Mounted volume usage with progress bars',
    renderMode: 'disk',
    defaultSize: 'medium',
    endpoint: null,
    category: 'system',
    allowMultiple: false,
  },
  {
    id: 'top-processes',
    label: 'Top Processes',
    icon: 'activity',
    description: 'Top 5 processes by CPU/memory',
    renderMode: 'processes',
    defaultSize: 'medium',
    endpoint: null,
    href: '/processes',
    category: 'system',
    allowMultiple: false,
  },
  {
    id: 'activity-timeline',
    label: 'Activity Timeline',
    icon: 'clock',
    description: 'Recent task and backup runs',
    renderMode: 'timeline',
    defaultSize: 'medium',
    endpoint: null,
    category: 'system',
    allowMultiple: false,
  },
  {
    id: 'tasks',
    label: 'Tasks',
    icon: 'settings',
    description: 'Task runner status summary',
    renderMode: 'status',
    defaultSize: 'small',
    endpoint: null,
    href: '/tasks',
    category: 'apps',
    allowMultiple: false,
  },
  {
    id: 'backups',
    label: 'Backups',
    icon: 'rotate',
    description: 'Backup job status and last run',
    renderMode: 'status',
    defaultSize: 'small',
    endpoint: null,
    href: '/backups',
    category: 'apps',
    allowMultiple: false,
  },
  {
    id: 'keeper',
    label: 'Keeper',
    icon: 'bookmark',
    description: 'Keeper task board summary',
    renderMode: 'status',
    defaultSize: 'small',
    endpoint: null,
    href: '/keeper',
    category: 'apps',
    allowMultiple: false,
  },
  {
    id: 'notifications',
    label: 'Notifications',
    icon: 'bell',
    description: 'Unread notification count',
    renderMode: 'status',
    defaultSize: 'small',
    endpoint: null,
    href: '/notifications',
    category: 'apps',
    allowMultiple: false,
  },
  {
    id: 'notes',
    label: 'Notes',
    icon: 'file-text',
    description: 'Note count',
    renderMode: 'status',
    defaultSize: 'small',
    endpoint: null,
    href: '/notes',
    category: 'data',
    allowMultiple: false,
  },
  {
    id: 'docker',
    label: 'Docker',
    icon: 'docker',
    description: 'Container status summary',
    renderMode: 'status',
    defaultSize: 'small',
    endpoint: null,
    href: '/docker',
    category: 'apps',
    allowMultiple: false,
  },
  {
    id: 'services',
    label: 'Services',
    icon: 'activity',
    description: 'Health-check monitored services',
    renderMode: 'status',
    defaultSize: 'small',
    endpoint: null,
    href: '/services',
    category: 'apps',
    allowMultiple: false,
  },
  {
    id: 'quick-nav',
    label: 'Quick Nav',
    icon: 'grid',
    description: 'Quick access navigation cards',
    renderMode: 'nav-grid',
    defaultSize: 'medium',
    endpoint: null,
    category: 'navigation',
    allowMultiple: false,
  },
  {
    id: 'quick-actions',
    label: 'Quick Actions',
    icon: 'zap',
    description: 'One-click action buttons',
    renderMode: 'actions',
    defaultSize: 'large',
    endpoint: null,
    category: 'navigation',
    allowMultiple: false,
  },
  {
    id: 'starred-files',
    label: 'Starred Files',
    icon: 'star',
    description: 'Quick access to starred files',
    renderMode: 'file-list',
    defaultSize: 'medium',
    endpoint: null,
    category: 'data',
    allowMultiple: false,
  },
  {
    id: 'productivity',
    label: 'Productivity',
    icon: 'zap',
    description: 'Kanban, reminders, notes & bookmarks at a glance',
    renderMode: 'status',
    defaultSize: 'medium',
    endpoint: null,
    href: '/activity',
    category: 'data',
    allowMultiple: false,
  },
];

/** Lookup a widget type definition by ID */
export function getWidgetType(typeId: string): WidgetTypeDef | undefined {
  return WIDGET_TYPES.find((w) => w.id === typeId);
}

/** Get widget types grouped by category */
export function getWidgetsByCategory(): Record<string, WidgetTypeDef[]> {
  const grouped: Record<string, WidgetTypeDef[]> = {};
  for (const w of WIDGET_TYPES) {
    (grouped[w.category] ??= []).push(w);
  }
  return grouped;
}

// ── Layout helpers ────────────────────────────────────────────────────────────

const DASH_LAYOUT_KEY = SK_DASHBOARD_LAYOUT_V2;

/** Default layout using all widget types */
export function createDefaultLayout(): WidgetInstance[] {
  return WIDGET_TYPES.map((w, i) => ({
    id: w.id,
    typeId: w.id,
    order: i,
    visible: true,
    size: w.defaultSize,
  }));
}

/** Preset templates */
export interface DashboardPreset {
  id: string;
  label: string;
  description: string;
  icon: string;
  widgets: Pick<WidgetInstance, 'typeId' | 'size' | 'visible'>[];
}

export const DASHBOARD_PRESETS: DashboardPreset[] = [
  {
    id: 'default',
    label: 'Default',
    description: 'All widgets in standard layout',
    icon: 'grid',
    widgets: WIDGET_TYPES.map((w) => ({ typeId: w.id, size: w.defaultSize, visible: true })),
  },
  {
    id: 'server-monitor',
    label: 'Server Monitor',
    description: 'System stats, processes, disk, and services',
    icon: 'cpu',
    widgets: [
      { typeId: 'system-stats', size: 'large', visible: true },
      { typeId: 'disk', size: 'medium', visible: true },
      { typeId: 'top-processes', size: 'medium', visible: true },
      { typeId: 'docker', size: 'small', visible: true },
      { typeId: 'services', size: 'small', visible: true },
      { typeId: 'activity-timeline', size: 'medium', visible: true },
    ],
  },
  {
    id: 'minimal',
    label: 'Minimal',
    description: 'Just the essentials — stats, nav, notifications',
    icon: 'minus',
    widgets: [
      { typeId: 'system-stats', size: 'medium', visible: true },
      { typeId: 'notifications', size: 'small', visible: true },
      { typeId: 'quick-nav', size: 'medium', visible: true },
      { typeId: 'quick-actions', size: 'medium', visible: true },
    ],
  },
  {
    id: 'ops',
    label: 'Ops Dashboard',
    description: 'Tasks, backups, keeper, and activity',
    icon: 'settings',
    widgets: [
      { typeId: 'tasks', size: 'medium', visible: true },
      { typeId: 'backups', size: 'medium', visible: true },
      { typeId: 'keeper', size: 'medium', visible: true },
      { typeId: 'activity-timeline', size: 'large', visible: true },
      { typeId: 'notifications', size: 'small', visible: true },
      { typeId: 'top-processes', size: 'medium', visible: true },
    ],
  },
];

/** Load layout from localStorage (with migration from v1) */
export function loadLayout(): WidgetInstance[] {
  if (typeof window === 'undefined') return createDefaultLayout();
  try {
    // Try v2 first
    const raw = localStorage.getItem(DASH_LAYOUT_KEY);
    if (raw) {
      const parsed: WidgetInstance[] = JSON.parse(raw);
      return reconcileLayout(parsed);
    }
    // Migrate from v1 format
    const v1Raw = localStorage.getItem(SK_DASHBOARD_LAYOUT);
    if (v1Raw) {
      const v1: { id: string; order: number; visible: boolean; size: string }[] = JSON.parse(v1Raw);
      const migrated: WidgetInstance[] = v1.map((s) => ({
        id: s.id,
        typeId: s.id,
        order: s.order,
        visible: s.visible,
        size: (s.size as WidgetSize) || 'medium',
      }));
      const result = reconcileLayout(migrated);
      saveLayout(result);
      return result;
    }
  } catch {}
  return createDefaultLayout();
}

/** Ensure all registered types are present, remove stale ones */
function reconcileLayout(layout: WidgetInstance[]): WidgetInstance[] {
  const validTypeIds = new Set(WIDGET_TYPES.map((w) => w.id));
  const existingTypeIds = new Set(layout.map((w) => w.typeId));
  let maxOrder = Math.max(0, ...layout.map((w) => w.order));

  // Add missing widget types
  for (const wt of WIDGET_TYPES) {
    if (!existingTypeIds.has(wt.id)) {
      layout.push({
        id: wt.id,
        typeId: wt.id,
        order: ++maxOrder,
        visible: true,
        size: wt.defaultSize,
      });
    }
  }

  // Backfill size
  for (const w of layout) {
    if (!w.size) w.size = getWidgetType(w.typeId)?.defaultSize ?? 'medium';
  }

  // Remove types that no longer exist in registry
  return layout.filter((w) => validTypeIds.has(w.typeId)).sort((a, b) => a.order - b.order);
}

/** Persist layout to localStorage */
export function saveLayout(layout: WidgetInstance[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(DASH_LAYOUT_KEY, JSON.stringify(layout));
}

/** Apply a preset template */
export function applyPreset(preset: DashboardPreset): WidgetInstance[] {
  return preset.widgets.map((w, i) => ({
    id: `${w.typeId}-${i}`,
    typeId: w.typeId,
    order: i,
    visible: w.visible,
    size: w.size,
  }));
}
