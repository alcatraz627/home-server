/**
 * Unit tests for the Dashboard Widget Registry
 *
 * Tests widget type lookups, layout creation, reconciliation, and presets.
 *
 * Run: npx vitest run tests/unit/widget-registry.test.ts
 */
import { describe, it, expect } from 'vitest';
import {
  WIDGET_TYPES,
  getWidgetType,
  getWidgetsByCategory,
  createDefaultLayout,
  DASHBOARD_PRESETS,
  applyPreset,
  type WidgetInstance,
} from '../../src/lib/widgets/registry';

// ── WIDGET_TYPES ────────────────────────────────────────────────────────

describe('WIDGET_TYPES', () => {
  it('has at least 10 widget types', () => {
    expect(WIDGET_TYPES.length).toBeGreaterThanOrEqual(10);
  });

  it('all types have required fields', () => {
    for (const w of WIDGET_TYPES) {
      expect(w.id).toBeTruthy();
      expect(w.label).toBeTruthy();
      expect(w.icon).toBeTruthy();
      expect(w.description).toBeTruthy();
      expect(w.renderMode).toBeTruthy();
      expect(w.defaultSize).toMatch(/^(small|medium|large)$/);
      expect(w.category).toMatch(/^(system|apps|data|navigation)$/);
      expect(typeof w.allowMultiple).toBe('boolean');
    }
  });

  it('has unique IDs', () => {
    const ids = WIDGET_TYPES.map((w) => w.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('includes productivity widget', () => {
    const prod = WIDGET_TYPES.find((w) => w.id === 'productivity');
    expect(prod).toBeDefined();
    expect(prod!.category).toBe('data');
    expect(prod!.href).toBe('/activity');
  });
});

// ── getWidgetType ───────────────────────────────────────────────────────

describe('getWidgetType', () => {
  it('finds existing widget types', () => {
    expect(getWidgetType('system-stats')).toBeDefined();
    expect(getWidgetType('kanban')).toBeUndefined(); // no kanban widget
    expect(getWidgetType('disk')).toBeDefined();
  });

  it('returns undefined for non-existent type', () => {
    expect(getWidgetType('does-not-exist')).toBeUndefined();
    expect(getWidgetType('')).toBeUndefined();
  });
});

// ── getWidgetsByCategory ────────────────────────────────────────────────

describe('getWidgetsByCategory', () => {
  it('groups widgets by category', () => {
    const grouped = getWidgetsByCategory();
    expect(Object.keys(grouped)).toContain('system');
    expect(Object.keys(grouped)).toContain('apps');
    expect(Object.keys(grouped)).toContain('data');
    expect(Object.keys(grouped)).toContain('navigation');
  });

  it('each group contains widgets of that category', () => {
    const grouped = getWidgetsByCategory();
    for (const [cat, widgets] of Object.entries(grouped)) {
      for (const w of widgets) {
        expect(w.category).toBe(cat);
      }
    }
  });

  it('total count across categories equals WIDGET_TYPES length', () => {
    const grouped = getWidgetsByCategory();
    const total = Object.values(grouped).reduce((sum, arr) => sum + arr.length, 0);
    expect(total).toBe(WIDGET_TYPES.length);
  });
});

// ── createDefaultLayout ─────────────────────────────────────────────────

describe('createDefaultLayout', () => {
  it('creates a layout entry for every widget type', () => {
    const layout = createDefaultLayout();
    expect(layout.length).toBe(WIDGET_TYPES.length);
  });

  it('all entries are visible by default', () => {
    const layout = createDefaultLayout();
    for (const w of layout) {
      expect(w.visible).toBe(true);
    }
  });

  it('uses sequential order', () => {
    const layout = createDefaultLayout();
    layout.forEach((w, i) => {
      expect(w.order).toBe(i);
    });
  });

  it('each entry references a valid type', () => {
    const layout = createDefaultLayout();
    const typeIds = new Set(WIDGET_TYPES.map((w) => w.id));
    for (const w of layout) {
      expect(typeIds.has(w.typeId)).toBe(true);
    }
  });

  it('uses the default size from the type definition', () => {
    const layout = createDefaultLayout();
    for (const w of layout) {
      const typeDef = getWidgetType(w.typeId);
      expect(w.size).toBe(typeDef!.defaultSize);
    }
  });
});

// ── DASHBOARD_PRESETS ───────────────────────────────────────────────────

describe('DASHBOARD_PRESETS', () => {
  it('has at least 3 presets', () => {
    expect(DASHBOARD_PRESETS.length).toBeGreaterThanOrEqual(3);
  });

  it('all presets have required fields', () => {
    for (const p of DASHBOARD_PRESETS) {
      expect(p.id).toBeTruthy();
      expect(p.label).toBeTruthy();
      expect(p.description).toBeTruthy();
      expect(p.icon).toBeTruthy();
      expect(p.widgets.length).toBeGreaterThan(0);
    }
  });

  it('preset widgets reference valid type IDs', () => {
    const typeIds = new Set(WIDGET_TYPES.map((w) => w.id));
    for (const p of DASHBOARD_PRESETS) {
      for (const w of p.widgets) {
        expect(typeIds.has(w.typeId)).toBe(true);
      }
    }
  });

  it('default preset includes all widget types', () => {
    const defaultPreset = DASHBOARD_PRESETS.find((p) => p.id === 'default');
    expect(defaultPreset).toBeDefined();
    expect(defaultPreset!.widgets.length).toBe(WIDGET_TYPES.length);
  });
});

// ── applyPreset ─────────────────────────────────────────────────────────

describe('applyPreset', () => {
  it('creates instances from preset', () => {
    const preset = DASHBOARD_PRESETS[0];
    const layout = applyPreset(preset);
    expect(layout.length).toBe(preset.widgets.length);
  });

  it('assigns sequential order', () => {
    const preset = DASHBOARD_PRESETS[0];
    const layout = applyPreset(preset);
    layout.forEach((w, i) => {
      expect(w.order).toBe(i);
    });
  });

  it('preserves size from preset', () => {
    const preset = DASHBOARD_PRESETS.find((p) => p.id === 'server-monitor')!;
    const layout = applyPreset(preset);
    // Server monitor has system-stats at 'large'
    const systemStats = layout.find((w) => w.typeId === 'system-stats');
    expect(systemStats?.size).toBe('large');
  });

  it('generates unique instance IDs', () => {
    const preset = DASHBOARD_PRESETS[0];
    const layout = applyPreset(preset);
    const ids = layout.map((w) => w.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
