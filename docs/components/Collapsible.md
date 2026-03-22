# Collapsible Component

## Problem

40+ collapsible sections across 16 files, all using the same state-driven pattern (`let expanded = $state(false)` → `{#if expanded}`) with inconsistent animation. No shared component.

## Spec

### File

`src/lib/components/Collapsible.svelte`

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `open` | `boolean` (bindable) | `false` | Whether content is visible |
| `title` | `string` | `''` | Header text (if using built-in header) |
| `icon` | `string` | `'chevron-right'` | Icon from registry (rotates when open) |
| `animated` | `boolean` | `true` | Smooth max-height transition |
| `header` | snippet | — | Custom header content (overrides title) |
| `children` | snippet | — | Collapsible body content |

### Features

- Chevron icon that rotates 90deg when open
- Smooth `max-height` + opacity CSS transition
- Click header to toggle
- Optional custom header via snippet
- ARIA: `aria-expanded` on trigger

### Usage

```svelte
<!-- Simple -->
<Collapsible title="Advanced Options" bind:open={showAdvanced}>
  <div>Form fields here...</div>
</Collapsible>

<!-- Custom header -->
<Collapsible bind:open={expanded}>
  {#snippet header()}
    <div class="custom-header">
      <span>Details</span>
      <Badge variant="info">3 items</Badge>
    </div>
  {/snippet}
  <div>Content...</div>
</Collapsible>
```

### Migration

Replace inline expand/collapse patterns in: tasks, keeper, backups, processes, tailscale, wifi, network, benchmarks, docs, settings panel, sidebar groups
