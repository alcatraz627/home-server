# Loading Component

## Problem

3 different loading patterns: skeleton cards (4 pages), "Loading..." text (5 pages), and disabled buttons with spinners (12 pages). No consistent loading UX. Users see blank pages during data fetch on many pages.

## Spec

### File

`src/lib/components/Loading.svelte`

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `variant` | `'skeleton' \| 'spinner' \| 'dots'` | `'skeleton'` | Loading visual type |
| `count` | `number` | `3` | Number of skeleton items to show |
| `height` | `string` | `'52px'` | Height of each skeleton item |
| `columns` | `number` | `1` | Grid columns for skeleton items |
| `text` | `string` | `''` | Optional loading text (shown below spinner/dots) |
| `class` | `string` | `''` | Additional CSS |

### Variants

**skeleton** — shows `count` shimmering placeholder rectangles in a grid. Uses existing `.skeleton-card` CSS.

**spinner** — shows a centered rotating circle with optional text below.

**dots** — shows 3 bouncing dots (same as AI chat typing indicator pattern).

### Usage

```svelte
{#if loading}
  <Loading count={4} columns={2} height="200px" />
{:else}
  <!-- actual content -->
{/if}

<Loading variant="spinner" text="Scanning networks..." />
<Loading variant="dots" />
```

### Migration

Add Loading component to pages that currently show blank during fetch: dashboard, lights, tailscale, processes, peripherals, wifi, bookmarks, kanban, wol, screenshots, benchmarks
