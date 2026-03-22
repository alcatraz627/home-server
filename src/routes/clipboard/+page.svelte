<script lang="ts">
  import { toast } from '$lib/toast';
  import Icon from '$lib/components/Icon.svelte';

  interface ClipEntry {
    id: string;
    content: string;
    deviceId: string;
    deviceName: string;
    timestamp: string;
  }

  let entries = $state<ClipEntry[]>([]);
  let newContent = $state('');
  let deviceId = $state('');
  let deviceName = $state('');
  let autoRefresh = $state(true);
  let refreshTimer: ReturnType<typeof setInterval> | null = null;
  let editingName = $state(false);

  function initDevice() {
    let id = localStorage.getItem('clipboard-device-id');
    if (!id) {
      id =
        typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : Math.random().toString(36).slice(2) + Date.now().toString(36);
      localStorage.setItem('clipboard-device-id', id);
    }
    deviceId = id;

    let name = localStorage.getItem('clipboard-device-name');
    if (!name) {
      name = `Device ${id.slice(0, 4)}`;
      localStorage.setItem('clipboard-device-name', name);
    }
    deviceName = name;
  }

  async function fetchEntries() {
    try {
      const res = await fetch('/api/clipboard');
      if (res.ok) entries = await res.json();
    } catch {
      // silent
    }
  }

  function startAutoRefresh() {
    stopAutoRefresh();
    if (autoRefresh) {
      refreshTimer = setInterval(fetchEntries, 2000);
    }
  }

  function stopAutoRefresh() {
    if (refreshTimer) {
      clearInterval(refreshTimer);
      refreshTimer = null;
    }
  }

  import { onMount } from 'svelte';
  import { browser } from '$app/environment';

  onMount(() => {
    initDevice();
    fetchEntries();
    if (autoRefresh) startAutoRefresh();
    return () => stopAutoRefresh();
  });

  $effect(() => {
    if (!browser) return;
    // Only react to autoRefresh toggle
    const shouldRefresh = autoRefresh;
    if (shouldRefresh) {
      startAutoRefresh();
    } else {
      stopAutoRefresh();
    }
  });

  async function addEntry() {
    if (!newContent.trim()) {
      toast.error('Enter some content');
      return;
    }
    try {
      const res = await fetch('/api/clipboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: newContent.trim(),
          deviceId,
          deviceName,
        }),
      });
      if (!res.ok) throw new Error();
      const entry = await res.json();
      entries = [entry, ...entries.filter((e) => e.id !== entry.id)];
      newContent = '';
      toast.success('Added to clipboard');
    } catch {
      toast.error('Failed to add');
    }
  }

  async function deleteEntry(id: string) {
    try {
      await fetch('/api/clipboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ _action: 'delete', id }),
      });
      entries = entries.filter((e) => e.id !== id);
    } catch {
      toast.error('Failed to delete');
    }
  }

  async function clearAll() {
    try {
      await fetch('/api/clipboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ _action: 'clear' }),
      });
      entries = [];
      toast.success('Clipboard cleared');
    } catch {
      toast.error('Failed to clear');
    }
  }

  async function copyToClipboard(content: string) {
    try {
      await navigator.clipboard.writeText(content);
      toast.success('Copied to clipboard');
    } catch {
      // Fallback for older browsers / non-secure contexts
      try {
        const textarea = document.createElement('textarea');
        textarea.value = content;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        toast.success('Copied to clipboard');
      } catch {
        toast.error('Failed to copy');
      }
    }
  }

  function updateDeviceName() {
    editingName = false;
    localStorage.setItem('clipboard-device-name', deviceName);
    toast.success('Device name updated');
  }

  function relativeTime(ts: string): string {
    const diff = Date.now() - new Date(ts).getTime();
    const secs = Math.floor(diff / 1000);
    if (secs < 60) return `${secs}s ago`;
    const mins = Math.floor(secs / 60);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  }

  function truncate(text: string, maxLen = 200): string {
    if (text.length <= maxLen) return text;
    return text.slice(0, maxLen) + '...';
  }

  // Group entries by device
  let groupedEntries = $derived.by(() => {
    const groups = new Map<string, { deviceName: string; deviceId: string; entries: ClipEntry[] }>();
    for (const entry of entries) {
      const key = entry.deviceId;
      if (!groups.has(key)) {
        groups.set(key, { deviceName: entry.deviceName, deviceId: entry.deviceId, entries: [] });
      }
      groups.get(key)!.entries.push(entry);
    }
    // Put current device first
    const sorted = [...groups.entries()].sort(([a], [b]) => {
      if (a === deviceId) return -1;
      if (b === deviceId) return 1;
      return 0;
    });
    return sorted.map(([, group]) => group);
  });

  let copiedId = $state<string | null>(null);

  function handleCopy(entry: ClipEntry) {
    copyToClipboard(entry.content);
    copiedId = entry.id;
    setTimeout(() => {
      copiedId = null;
    }, 2000);
  }
</script>

<div class="page">
  <h2 class="page-title">Clipboard</h2>
  <p class="page-desc">Share text and content between devices on your network. Entries sync automatically.</p>

  <!-- Device identity card -->
  <div class="device-card card">
    <div class="device-top">
      <div class="device-identity">
        {#if editingName}
          <input
            type="text"
            class="device-name-input"
            bind:value={deviceName}
            onblur={updateDeviceName}
            onkeydown={(e) => e.key === 'Enter' && updateDeviceName()}
          />
        {:else}
          <!-- svelte-ignore a11y_click_events_have_key_events -->
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <span class="device-name" ondblclick={() => (editingName = true)}>{deviceName}</span>
        {/if}
        <span class="this-device-badge">This device</span>
      </div>
      <span class="device-id-tag">{deviceId.slice(0, 8)}</span>
    </div>
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <p class="device-hint" ondblclick={() => (editingName = true)}>Double-click name to edit</p>
  </div>

  <!-- Paste area -->
  <div class="card paste-area">
    <div class="paste-header">
      <h2>Share Content</h2>
      <div class="paste-controls">
        <label class="auto-toggle">
          <input type="checkbox" bind:checked={autoRefresh} />
          Auto-refresh
        </label>
      </div>
    </div>
    <textarea bind:value={newContent} placeholder="Paste or type content to share across devices..." rows="5"
    ></textarea>
    <div class="paste-actions">
      <button class="btn-primary" onclick={addEntry} disabled={!newContent.trim()}> Share to Clipboard </button>
      {#if entries.length > 0}
        <button class="btn-danger-sm" onclick={clearAll}>Clear All</button>
      {/if}
    </div>
  </div>

  <!-- Entries -->
  {#if entries.length === 0}
    <div class="card empty-state">
      <div class="empty-icon"><Icon name="clipboard" size={36} /></div>
      <h3>No entries yet</h3>
      <p>Paste content in the text area above to share it across your devices.</p>
      <div class="empty-tips">
        <div class="tip">
          <span class="tip-num">1</span>
          <span>Paste or type content above and click "Share to Clipboard"</span>
        </div>
        <div class="tip">
          <span class="tip-num">2</span>
          <span>Open this page on another device to see shared entries</span>
        </div>
        <div class="tip">
          <span class="tip-num">3</span>
          <span>Click "Copy" on any entry to copy it to your device clipboard</span>
        </div>
      </div>
    </div>
  {:else}
    {#each groupedEntries as group}
      <div class="device-group">
        <div class="group-header">
          <span class="group-device-name">{group.deviceName}</span>
          {#if group.deviceId === deviceId}
            <span class="group-self-badge">You</span>
          {/if}
          <span class="group-count">{group.entries.length} {group.entries.length === 1 ? 'entry' : 'entries'}</span>
        </div>
        <div class="group-entries">
          {#each group.entries as entry (entry.id)}
            <div class="card entry-card" class:own={entry.deviceId === deviceId}>
              <div class="entry-header">
                <span class="entry-time">{relativeTime(entry.timestamp)}</span>
                <div class="entry-actions">
                  <button class="btn-copy" class:copied={copiedId === entry.id} onclick={() => handleCopy(entry)}>
                    {copiedId === entry.id ? 'Copied!' : 'Copy'}
                  </button>
                  <button class="btn-delete" onclick={() => deleteEntry(entry.id)}>Delete</button>
                </div>
              </div>
              <pre class="entry-content">{truncate(entry.content)}</pre>
              {#if entry.content.length > 200}
                <span class="entry-full-hint">{entry.content.length} chars total</span>
              {/if}
            </div>
          {/each}
        </div>
      </div>
    {/each}
  {/if}
</div>

<style>
  .page {
    padding: 1.5rem;
    max-width: 700px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  /* Device identity card */
  .device-card {
    padding: 1rem 1.25rem;
  }
  .device-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .device-identity {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  .device-name {
    font-size: 1.1rem;
    font-weight: 700;
    color: var(--text-primary);
    cursor: pointer;
  }
  .device-name:hover {
    color: var(--accent);
  }
  .device-name-input {
    padding: 0.3rem 0.5rem;
    border: 1px solid var(--accent);
    border-radius: 4px;
    background: var(--bg-primary);
    color: var(--text-primary);
    font-size: 1.1rem;
    font-weight: 700;
    font-family: inherit;
    width: 180px;
  }
  .this-device-badge {
    font-size: 0.65rem;
    padding: 2px 8px;
    border-radius: 10px;
    background: color-mix(in srgb, var(--accent) 15%, transparent);
    color: var(--accent);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }
  .device-id-tag {
    font-family: monospace;
    color: var(--text-muted);
    font-size: 0.7rem;
    background: var(--bg-primary);
    padding: 2px 8px;
    border-radius: 4px;
  }
  .device-hint {
    font-size: 0.7rem;
    color: var(--text-faint);
    margin-top: 0.25rem;
    cursor: pointer;
  }

  /* Paste area */
  .paste-area {
    padding: 1.25rem;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }
  .paste-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .paste-header h2 {
    font-size: 1rem;
    margin: 0;
    color: var(--text-primary);
  }
  .paste-controls {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }
  .auto-toggle {
    display: flex;
    align-items: center;
    gap: 0.3rem;
    font-size: 0.75rem;
    color: var(--text-muted);
    cursor: pointer;
  }
  .auto-toggle input {
    accent-color: var(--accent);
  }
  textarea {
    padding: 0.85rem;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--bg-primary);
    color: var(--text-primary);
    font-size: 0.9rem;
    resize: vertical;
    font-family: inherit;
    min-height: 100px;
    line-height: 1.5;
  }
  textarea:focus {
    outline: none;
    border-color: var(--accent);
  }
  .paste-actions {
    display: flex;
    gap: 0.5rem;
    align-items: center;
  }
  .btn-primary {
    padding: 0.5rem 1.25rem;
    background: var(--accent);
    color: #fff;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-weight: 600;
    font-size: 0.85rem;
    font-family: inherit;
  }
  .btn-primary:disabled {
    opacity: 0.5;
    cursor: default;
  }
  .btn-danger-sm {
    padding: 0.4rem 0.75rem;
    background: transparent;
    color: var(--danger);
    border: 1px solid var(--danger);
    border-radius: 6px;
    cursor: pointer;
    font-size: 0.75rem;
    font-family: inherit;
    margin-left: auto;
  }

  /* Empty state */
  .empty-state {
    padding: 2.5rem 2rem;
    text-align: center;
  }
  .empty-icon {
    font-size: 2.5rem;
    color: var(--text-faint);
    margin-bottom: 0.75rem;
  }
  .empty-state h3 {
    font-size: 1.1rem;
    color: var(--text-secondary);
    margin-bottom: 0.5rem;
  }
  .empty-state > p {
    font-size: 0.85rem;
    color: var(--text-muted);
    margin-bottom: 1.5rem;
  }
  .empty-tips {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    text-align: left;
    max-width: 400px;
    margin: 0 auto;
  }
  .tip {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
    font-size: 0.8rem;
    color: var(--text-secondary);
  }
  .tip-num {
    width: 22px;
    height: 22px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    background: var(--accent-bg);
    color: var(--accent);
    font-size: 0.7rem;
    font-weight: 700;
    flex-shrink: 0;
  }

  /* Device groups */
  .device-group {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  .group-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0 0.25rem;
  }
  .group-device-name {
    font-size: 0.8rem;
    font-weight: 600;
    color: var(--text-secondary);
  }
  .group-self-badge {
    font-size: 0.6rem;
    padding: 1px 6px;
    border-radius: 8px;
    background: color-mix(in srgb, var(--success) 15%, transparent);
    color: var(--success);
    font-weight: 600;
  }
  .group-count {
    font-size: 0.7rem;
    color: var(--text-faint);
    margin-left: auto;
  }
  .group-entries {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  /* Entry cards */
  .entry-card {
    padding: 0.85rem 1rem;
    transition:
      border-color 0.15s,
      box-shadow 0.15s;
  }
  .entry-card.own {
    border-left: 3px solid var(--accent);
  }
  .entry-card:hover {
    border-color: var(--text-faint);
  }
  .entry-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.5rem;
  }
  .entry-time {
    font-size: 0.7rem;
    color: var(--text-faint);
    font-family: monospace;
  }
  .entry-actions {
    display: flex;
    gap: 0.35rem;
  }
  .btn-copy {
    padding: 0.25rem 0.65rem;
    border: 1px solid var(--accent);
    border-radius: 4px;
    background: color-mix(in srgb, var(--accent) 10%, transparent);
    color: var(--accent);
    cursor: pointer;
    font-size: 0.7rem;
    font-family: inherit;
    font-weight: 600;
    transition: all 0.15s;
  }
  .btn-copy:hover {
    background: color-mix(in srgb, var(--accent) 20%, transparent);
  }
  .btn-copy.copied {
    background: color-mix(in srgb, var(--success) 15%, transparent);
    border-color: var(--success);
    color: var(--success);
  }
  .btn-delete {
    padding: 0.25rem 0.5rem;
    border: 1px solid var(--border);
    border-radius: 4px;
    background: var(--bg-secondary);
    color: var(--text-muted);
    cursor: pointer;
    font-size: 0.7rem;
    font-family: inherit;
  }
  .btn-delete:hover {
    color: var(--danger);
    border-color: var(--danger);
  }
  .entry-content {
    padding: 0.6rem 0.75rem;
    background: var(--bg-primary);
    border-radius: 6px;
    font-size: 0.82rem;
    color: var(--text-primary);
    white-space: pre-wrap;
    word-break: break-word;
    margin: 0;
    max-height: 200px;
    overflow-y: auto;
    font-family: monospace;
    line-height: 1.5;
  }
  .entry-full-hint {
    font-size: 0.65rem;
    color: var(--text-faint);
    margin-top: 0.25rem;
    display: block;
  }
</style>
