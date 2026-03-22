<script lang="ts">
  import { toast } from '$lib/toast';

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

  function initDevice() {
    let id = localStorage.getItem('clipboard-device-id');
    if (!id) {
      id = crypto.randomUUID();
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
      toast.error('Failed to copy');
    }
  }

  function updateDeviceName() {
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
</script>

<div class="page">
  <div class="header">
    <h1>Clipboard Sync</h1>
    <div class="header-controls">
      <label class="auto-toggle">
        <input type="checkbox" bind:checked={autoRefresh} />
        Auto-refresh
      </label>
      <button class="btn-danger-sm" onclick={clearAll}>Clear All</button>
    </div>
  </div>

  <div class="device-bar card">
    <span class="device-label">Your device:</span>
    <input
      type="text"
      class="device-input"
      bind:value={deviceName}
      onblur={updateDeviceName}
      onkeydown={(e) => e.key === 'Enter' && updateDeviceName()}
    />
    <span class="device-id">{deviceId.slice(0, 8)}</span>
  </div>

  <div class="card paste-area">
    <textarea bind:value={newContent} placeholder="Paste or type content to share..." rows="3"></textarea>
    <button class="btn-primary" onclick={addEntry}>Share to Clipboard</button>
  </div>

  {#if entries.length === 0}
    <div class="card empty">
      <p>No clipboard entries yet. Paste something to get started.</p>
    </div>
  {:else}
    <div class="entries">
      {#each entries as entry (entry.id)}
        <div class="card entry" class:own={entry.deviceId === deviceId}>
          <div class="entry-header">
            <span class="entry-device">{entry.deviceName}</span>
            <span class="entry-time">{relativeTime(entry.timestamp)}</span>
          </div>
          <pre class="entry-content">{entry.content}</pre>
          <div class="entry-actions">
            <button class="btn-sm" onclick={() => copyToClipboard(entry.content)}>Copy</button>
            <button class="btn-sm btn-danger" onclick={() => deleteEntry(entry.id)}>Delete</button>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .page {
    padding: 1.5rem;
    max-width: 700px;
    margin: 0 auto;
  }
  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1.5rem;
    flex-wrap: wrap;
    gap: 0.5rem;
  }
  h1 {
    margin: 0;
    color: var(--text-primary);
  }
  .header-controls {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }
  .auto-toggle {
    display: flex;
    align-items: center;
    gap: 0.3rem;
    font-size: 0.85rem;
    color: var(--text-secondary);
    cursor: pointer;
  }
  .auto-toggle input {
    accent-color: var(--accent);
  }
  .btn-danger-sm {
    padding: 0.35rem 0.75rem;
    background: transparent;
    color: var(--danger);
    border: 1px solid var(--danger);
    border-radius: 6px;
    cursor: pointer;
    font-size: 0.8rem;
  }
  .device-bar {
    padding: 0.75rem 1rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 1rem;
  }
  .device-label {
    color: var(--text-secondary);
    font-size: 0.85rem;
    white-space: nowrap;
  }
  .device-input {
    padding: 0.3rem 0.5rem;
    border: 1px solid var(--border);
    border-radius: 4px;
    background: var(--bg-primary);
    color: var(--text-primary);
    font-size: 0.85rem;
    width: 140px;
  }
  .device-id {
    font-family: monospace;
    color: var(--text-muted);
    font-size: 0.75rem;
    margin-left: auto;
  }
  .paste-area {
    padding: 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    margin-bottom: 1.5rem;
  }
  textarea {
    padding: 0.75rem;
    border: 1px solid var(--border);
    border-radius: 6px;
    background: var(--bg-primary);
    color: var(--text-primary);
    font-size: 0.9rem;
    resize: vertical;
    font-family: inherit;
  }
  .btn-primary {
    padding: 0.5rem 1rem;
    background: var(--accent);
    color: #fff;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-weight: 600;
    font-size: 0.9rem;
    align-self: flex-start;
  }
  .entries {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }
  .entry {
    padding: 0.75rem 1rem;
  }
  .entry.own {
    border-left: 3px solid var(--accent);
  }
  .entry-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.5rem;
  }
  .entry-device {
    font-size: 0.8rem;
    font-weight: 600;
    color: var(--text-secondary);
  }
  .entry-time {
    font-size: 0.75rem;
    color: var(--text-muted);
  }
  .entry-content {
    padding: 0.5rem 0.75rem;
    background: var(--bg-primary);
    border-radius: 6px;
    font-size: 0.85rem;
    color: var(--text-primary);
    white-space: pre-wrap;
    word-break: break-word;
    margin: 0;
    max-height: 200px;
    overflow-y: auto;
    font-family: monospace;
  }
  .entry-actions {
    display: flex;
    gap: 0.35rem;
    margin-top: 0.5rem;
  }
  .btn-sm {
    padding: 0.25rem 0.5rem;
    border: 1px solid var(--border);
    border-radius: 4px;
    background: var(--bg-secondary);
    color: var(--text-secondary);
    cursor: pointer;
    font-size: 0.75rem;
  }
  .btn-danger {
    color: var(--danger);
    border-color: var(--danger);
  }
  .empty {
    padding: 2rem;
    text-align: center;
    color: var(--text-muted);
  }
</style>
