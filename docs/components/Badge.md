# Badge Component

## Problem

50+ status badge instances with inconsistent implementations. Some use inline styles, some use per-page CSS classes (`.status-running`, `.tag`, `.pill`), some use raw colored spans. No unified API.

## Spec

### File

`src/lib/components/Badge.svelte`

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `variant` | `'success' \| 'danger' \| 'warning' \| 'info' \| 'default' \| 'accent' \| 'purple'` | `'default'` | Color variant |
| `size` | `'sm' \| 'md'` | `'sm'` | Badge size |
| `dot` | `boolean` | `false` | Show colored dot indicator before text |
| `pulse` | `boolean` | `false` | Animate the dot with pulse effect |
| `pill` | `boolean` | `true` | Pill shape (full border-radius) |
| `children` | snippet | — | Badge text content |

### Variant Colors

| Variant | Background | Text |
|---------|-----------|------|
| `success` | `var(--success-bg)` | `var(--success)` |
| `danger` | `var(--danger-bg)` | `var(--danger)` |
| `warning` | `var(--warning-bg)` | `var(--warning)` |
| `info` | `var(--accent-bg)` | `var(--accent)` |
| `default` | `var(--bg-hover)` | `var(--text-muted)` |
| `accent` | `var(--accent-bg)` | `var(--accent)` |
| `purple` | `var(--purple-bg)` | `var(--purple)` |

### Size Scale

| Size | Padding | Font Size |
|------|---------|-----------|
| `sm` | `1px 8px` | `0.65rem` |
| `md` | `3px 10px` | `0.75rem` |

### Usage Examples

```svelte
<Badge variant="success">Online</Badge>
<Badge variant="danger" dot>Failed</Badge>
<Badge variant="warning" dot pulse>Running</Badge>
<Badge>Draft</Badge>
<Badge variant="info" size="md">3 scheduled</Badge>
```

### Migration

Replace these patterns across all pages:
- `<span class="status" style="color: var(--success)">running</span>` → `<Badge variant="success" dot pulse>Running</Badge>`
- `<span class="tag">tag-name</span>` → `<Badge>tag-name</Badge>`
- `<span class="dot online"></span> Online` → `<Badge variant="success" dot>Online</Badge>`
- All inline-styled status indicators
