# Button Component

## Problem

88 distinct button class variants across 36 files. Each page redefines its own button styles (`.btn-wake`, `.btn-start`, `.btn-fill-wifi`, `.template-run-btn`, etc.). No consistent sizing, spacing, or variant system.

## Spec

### File

`src/lib/components/Button.svelte`

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `variant` | `'default' \| 'primary' \| 'danger' \| 'ghost' \| 'accent'` | `'default'` | Visual style |
| `size` | `'xs' \| 'sm' \| 'md' \| 'lg'` | `'md'` | Button size |
| `icon` | `string \| undefined` | `undefined` | Icon name from `$lib/icons.ts` (renders left of text) |
| `iconOnly` | `boolean` | `false` | If true, renders only icon with no text padding |
| `loading` | `boolean` | `false` | Shows spinner, disables interaction |
| `disabled` | `boolean` | `false` | Disabled state |
| `confirm` | `boolean` | `false` | Two-click confirm pattern (first click shows "Sure?", second executes) |
| `confirmText` | `string` | `'Sure?'` | Text shown in confirm state |
| `class` | `string` | `''` | Additional CSS classes |
| `onclick` | event handler | — | Click handler |
| `children` | snippet | — | Button content (slot) |

### Size Scale

| Size | Padding | Font Size | Min Height |
|------|---------|-----------|------------|
| `xs` | `2px 6px` | `0.65rem` | `24px` |
| `sm` | `4px 10px` | `0.75rem` | `28px` |
| `md` | `6px 14px` | `0.82rem` | `34px` |
| `lg` | `8px 20px` | `0.9rem` | `40px` |

### Variants

| Variant | Background | Border | Text | Hover |
|---------|-----------|--------|------|-------|
| `default` | `var(--btn-bg)` | `var(--border)` | `var(--text-secondary)` | border → accent |
| `primary` | `var(--accent)` | `var(--accent)` | `white` | brightness(1.1) |
| `danger` | `transparent` | `var(--danger)` | `var(--danger)` | bg → danger-bg |
| `ghost` | `transparent` | `transparent` | `var(--text-muted)` | bg → bg-hover |
| `accent` | `var(--accent-bg)` | `var(--accent)` | `var(--accent)` | brightness(1.1) |

### Confirm Behavior

When `confirm` is true:
1. First click: button text changes to `confirmText`, style becomes danger variant
2. After 3 seconds without second click: reverts to original state
3. Second click within 3s: fires the `onclick` handler

### Usage Examples

```svelte
<Button>Default</Button>
<Button variant="primary" icon="save">Save</Button>
<Button variant="danger" size="sm" confirm>Delete</Button>
<Button icon="refresh" loading={refreshing}>Refresh</Button>
<Button variant="ghost" iconOnly icon="close" />
```

### Migration

Replace these patterns:
- `.btn` + `.btn-sm` → `<Button size="sm">`
- `.btn-primary` → `<Button variant="primary">`
- `.btn-danger` + confirm logic → `<Button variant="danger" confirm>`
- `.icon-btn` → `<Button variant="ghost" iconOnly icon="...">`
- All page-specific button classes (`.btn-wake`, `.template-run-btn`, etc.) → appropriate variant

### Files to Migrate (priority order)

1. `+layout.svelte` — navbar buttons
2. `files/+page.svelte` — action buttons
3. `tasks/+page.svelte` — run/delete/template buttons
4. `backups/+page.svelte` — trigger/edit/delete
5. `keeper/+page.svelte` — status/agent buttons
6. All remaining pages
