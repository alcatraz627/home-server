# Extending Home Server

How to add new features, widgets, file renderers, and operator tasks.

---

## Adding a New Widget

A widget is a page + API + server helper. Follow the existing pattern:

### 1. Server Helper

Create `src/lib/server/mywidget.ts`:

```typescript
// Pure Node.js — no SvelteKit imports
// Export interfaces and functions

export interface MyData {
  id: string;
  name: string;
  value: number;
}

export function getMyData(): MyData[] {
  // System calls, file reads, network requests, etc.
  return [];
}

export function updateMyData(id: string, value: number): boolean {
  // Mutations go here
  return true;
}
```

**Rules:**
- One file per domain
- Export types/interfaces for use in API routes and pages
- No cross-imports between server helpers
- Handle errors gracefully — return error objects, don't throw

### 2. API Route

Create `src/routes/api/mywidget/+server.ts`:

```typescript
import { json } from '@sveltejs/kit';
import { getMyData, updateMyData } from '$lib/server/mywidget';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
  const data = getMyData();
  return json(data);
};

export const PUT: RequestHandler = async ({ request }) => {
  const { id, value } = await request.json();
  const ok = updateMyData(id, value);
  if (!ok) return json({ error: 'Failed' }, { status: 400 });
  return json({ ok: true });
};
```

**Rules:**
- Keep routes thin — logic lives in server helpers
- Use standard HTTP methods: GET (read), POST (create), PUT (update), PATCH (partial update), DELETE (remove)
- Return JSON with appropriate status codes

### 3. Page Server Load

Create `src/routes/mywidget/+page.server.ts`:

```typescript
import { getMyData } from '$lib/server/mywidget';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
  const items = getMyData();
  return { items };
};
```

### 4. Page Component

Create `src/routes/mywidget/+page.svelte`:

```svelte
<script lang="ts">
  import type { PageData } from './$types';
  import type { MyData } from '$lib/server/mywidget';

  let { data } = $props<{ data: PageData }>();
  // svelte-ignore state_referenced_locally
  const { items: initialItems } = data;
  let items = $state<MyData[]>(initialItems);

  async function refresh() {
    const res = await fetch('/api/mywidget');
    items = await res.json();
  }
</script>

<svelte:head>
  <title>My Widget | Home Server</title>
</svelte:head>

<div class="header">
  <h2>My Widget</h2>
  <button class="btn" onclick={refresh}>Refresh</button>
</div>

<!-- Your UI here -->
```

### 5. Register in Dashboard & Nav

In `src/routes/+page.svelte`, add to the `widgets` array:

```typescript
{
  id: 'mywidget',
  title: 'My Widget',
  href: '/mywidget',
  description: 'What it does',
  status: 'active'
}
```

In `src/lib/constants/nav.ts`, add to the appropriate group:

```typescript
{ href: '/mywidget', label: 'My Widget', icon: '◆' }
```

---

## Adding a File Renderer

File preview is pluggable — add a new renderer without touching the page component.

### 1. Create Renderer

Create `src/lib/renderers/myformat.ts`:

```typescript
import type { DocumentRenderer, RenderResult } from './index';

export const myFormatRenderer: DocumentRenderer = {
  name: 'myformat',

  canRender(mime: string, filename: string): boolean {
    // Return true if this renderer handles the file
    return mime === 'application/x-myformat'
      || filename.endsWith('.myf');
  },

  async render(data: ArrayBuffer, filename: string): Promise<RenderResult> {
    // Process the raw file data
    const text = new TextDecoder().decode(data);

    // Return HTML, text, or structured data
    return {
      type: 'html',
      content: `<div class="my-preview">${processMyFormat(text)}</div>`
    };
  }
};
```

**RenderResult types:**
- `{ type: 'html', content: string }` — rendered with `{@html}`
- `{ type: 'text', content: string }` — rendered in `<pre>`
- `{ type: 'data', sheets: SheetData[] }` — rendered by DataTable component

### 2. Register in Index

In `src/lib/renderers/index.ts`, import and add to the `RENDERERS` array:

```typescript
import { myFormatRenderer } from './myformat';

const RENDERERS: DocumentRenderer[] = [
  excelRenderer,
  wordRenderer,
  myFormatRenderer,  // Add before text — more specific first
  markdownRenderer,
  jsonRenderer,
  textRenderer,
];
```

### 3. Add MIME Type (Optional)

If your format needs a custom MIME type, add it to `src/lib/server/files.ts`:

```typescript
const MIME_MAP: Record<string, string> = {
  // ... existing entries
  '.myf': 'application/x-myformat',
};
```

### 4. Add Styles (Optional)

Add scoped styles in the files page for your renderer's HTML output:

```css
.rendered-doc :global(.my-preview) {
  /* Your styles */
}
```

---

## Adding an Operator Task

Tasks can be created via the UI or directly in `~/.home-server/tasks.json`:

```json
[
  {
    "id": "disk-check",
    "name": "Disk Space Check",
    "command": "df -h / | awk 'NR==2 {if ($5+0 > 90) {print \"ALERT: \" $5 \" used\"; exit 1}}'",
    "schedule": "0 */6 * * *",
    "timeout": 30,
    "maxRetries": 0,
    "notify": true,
    "enabled": true
  }
]
```

**Fields:**
- `command` — any shell command (runs via `sh -c`)
- `schedule` — standard cron expression (null for manual-only)
- `timeout` — seconds before SIGKILL
- `maxRetries` — retries with exponential backoff on failure
- `notify` — send ntfy.sh notification on completion

Restart the server after editing the JSON directly (the scheduler re-reads on startup).

---

## Adding a Backup Config

Similar to tasks, backups can be created via UI or `~/.home-server/backups.json`:

```json
[
  {
    "id": "phone-photos",
    "name": "Phone Photos",
    "sourcePath": "/Volumes/phone/DCIM/",
    "destPath": "/Volumes/ExternalDrive/backups/photos/",
    "schedule": "0 2 * * *",
    "excludes": [".thumbnails", ".cache", "*.tmp"],
    "enabled": true
  }
]
```

The backup engine uses `rsync -avz --progress --stats` with the specified excludes.

---

## Using the DataTable Component

`DataTable.svelte` is a generic reusable component for tabular data:

```svelte
<script>
  import DataTable from '$lib/components/DataTable.svelte';

  const headers = ['Name', 'Age', 'City'];
  const rows = [
    ['Alice', '30', 'London'],
    ['Bob', '25', 'Paris'],
  ];
</script>

<DataTable {headers} {rows} pageSize={25} />
```

**Props:**
- `headers: string[]` — column headers
- `rows: string[][]` — row data (all strings)
- `pageSize?: number` — rows per page (default: 50)

**Built-in features:** column sorting, global search, per-column filters, pagination.

---

## Theme-Aware Components

Always use CSS custom properties for colors:

```css
.my-component {
  background: var(--bg-secondary);
  color: var(--text-primary);
  border: 1px solid var(--border);
}

.my-component:hover {
  border-color: var(--accent);
}
```

Available tokens: `--bg-primary`, `--bg-secondary`, `--bg-inset`, `--bg-hover`, `--border`, `--border-subtle`, `--text-primary`, `--text-secondary`, `--text-muted`, `--text-faint`, `--accent`, `--success`, `--danger`, `--warning`, `--purple`.
