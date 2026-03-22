# PageHeader Component

## Problem

Every page has a header with title + optional description + optional action buttons. The pattern is consistent but repeated inline everywhere. A component would reduce boilerplate and ensure structure.

## Spec

### File

`src/lib/components/PageHeader.svelte`

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `title` | `string` | required | Page title (h2) |
| `description` | `string` | `''` | Page description text |
| `actions` | snippet | — | Action buttons (right-aligned) |

### Rendered Structure

```html
<div class="page-header">
  <div class="page-header-text">
    <h2 class="page-title">{title}</h2>
    {#if description}
      <p class="page-desc">{description}</p>
    {/if}
  </div>
  <div class="page-header-actions">
    {@render actions()}
  </div>
</div>
```

### Usage

```svelte
<PageHeader
  title="Backups"
  description="Manage rsync backup configurations with cron scheduling."
>
  {#snippet actions()}
    <Button icon="add" variant="primary">New Backup</Button>
    <Button icon="refresh" onclick={refresh}>Refresh</Button>
  {/snippet}
</PageHeader>
```

### Migration

All 25 route pages — replace inline `<h2 class="page-title">` + `<p class="page-desc">` + action button divs with `<PageHeader>`.
