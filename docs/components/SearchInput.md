# SearchInput Component

## Problem

20+ search inputs across 12 pages, each with different styling, placeholder text, and debounce behavior. Some have labels, some don't. No consistent search icon or clear button.

## Spec

### File

`src/lib/components/SearchInput.svelte`

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `value` | `string` (bindable) | `''` | Search query |
| `placeholder` | `string` | `'Search...'` | Placeholder text |
| `debounce` | `number` | `0` | Debounce delay in ms (0 = instant) |
| `icon` | `boolean` | `true` | Show search icon on left |
| `clearable` | `boolean` | `true` | Show clear (x) button when value is non-empty |
| `size` | `'sm' \| 'md'` | `'md'` | Input size |
| `class` | `string` | `''` | Additional CSS |
| `oninput` | event handler | — | Fires on value change (after debounce) |

### Features

- Search icon (magnifying glass from Icon registry) on left
- Clear button (x) on right when value is non-empty
- Debounced `oninput` for async search
- Consistent sizing with other form inputs
- Focus ring with accent color

### Usage

```svelte
<SearchInput bind:value={filter} placeholder="Filter processes..." />
<SearchInput bind:value={query} debounce={300} placeholder="Search all files..." />
```

### Migration

Replace inline `<input type="text" placeholder="Filter..."` patterns in: processes, bookmarks, keeper, wifi, files, tasks, tailscale, kanban, dns, ports, wol, benchmarks
