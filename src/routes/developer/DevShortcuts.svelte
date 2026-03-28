<script lang="ts">
  import { onMount } from 'svelte';
  import Button from '$lib/components/Button.svelte';
  import Badge from '$lib/components/Badge.svelte';
  import {
    getAllShortcuts,
    setCustomKey,
    resetCustomKey,
    resetAllKeys,
    SHORTCUT_DEFAULTS,
    type ShortcutDef,
  } from '$lib/shortcuts';

  type DisplayShortcut = ShortcutDef & { currentKey: string; customized: boolean };

  let shortcuts = $state<DisplayShortcut[]>([]);
  let capturingId = $state<string | null>(null);
  let capturedKey = $state('');

  function reload() {
    shortcuts = getAllShortcuts();
  }

  onMount(reload);

  // Group shortcuts by page
  const pages = $derived(() => {
    const map = new Map<string, DisplayShortcut[]>();
    for (const s of shortcuts) {
      if (!map.has(s.page)) map.set(s.page, []);
      map.get(s.page)!.push(s);
    }
    return map;
  });

  const hasCustomizations = $derived(shortcuts.some((s) => s.customized));

  function startCapture(id: string) {
    capturingId = id;
    capturedKey = '';
  }

  function cancelCapture() {
    capturingId = null;
    capturedKey = '';
  }

  const MODIFIER_KEYS = new Set(['Shift', 'Control', 'Alt', 'Meta', 'CapsLock', 'Tab', 'Dead']);

  function handleCaptureKeydown(e: KeyboardEvent) {
    if (!capturingId) return;
    e.preventDefault();
    e.stopPropagation();

    if (e.key === 'Escape') {
      cancelCapture();
      return;
    }

    if (MODIFIER_KEYS.has(e.key)) return;

    capturedKey = e.key;
    setCustomKey(capturingId, e.key);
    reload();
    setTimeout(cancelCapture, 120);
  }

  function doReset(id: string) {
    resetCustomKey(id);
    reload();
  }

  function doResetAll() {
    resetAllKeys();
    reload();
  }

  function formatKey(key: string): string {
    if (key === '/') return '/';
    if (key === '?') return '?';
    if (key === 'Enter') return '↵';
    if (key === 'Escape') return 'Esc';
    if (key === 'ArrowUp') return '↑';
    if (key === 'ArrowDown') return '↓';
    return key.length === 1 ? key.toUpperCase() : key;
  }
</script>

<svelte:window onkeydown={handleCaptureKeydown} />

<!-- Key capture overlay -->
{#if capturingId !== null}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="capture-overlay">
    <div class="capture-modal">
      <p class="capture-prompt">Press a key to bind</p>
      <div class="capture-key-preview">{capturedKey ? formatKey(capturedKey) : '…'}</div>
      <Button size="sm" onclick={cancelCapture}>Cancel</Button>
    </div>
  </div>
{/if}

<div class="shortcuts-wrap">
  <div class="shortcuts-header">
    {#if hasCustomizations}
      <Button size="sm" onclick={doResetAll}>Reset all to defaults</Button>
    {/if}
  </div>
  <p class="shortcuts-desc">View and customize keyboard shortcuts. Click a key badge to rebind it.</p>

  {#each [...pages()] as [page, items]}
    <div class="shortcut-group">
      <h3 class="group-title">{page}</h3>
      <div class="shortcut-table">
        {#each items as s}
          <div class="shortcut-row">
            <div class="shortcut-info">
              <span class="shortcut-desc">{s.description}</span>
              <span class="shortcut-cat">{s.category}</span>
            </div>
            <div class="shortcut-key-col">
              {#if s.customized}
                <span class="default-key"
                  >{formatKey(SHORTCUT_DEFAULTS.find((d) => d.id === s.id)?.defaultKey ?? '')}</span
                >
                <span class="key-arrow">→</span>
              {/if}
              <button
                class="key-badge"
                class:customized={s.customized}
                onclick={() => startCapture(s.id)}
                title="Click to rebind"
              >
                {formatKey(s.currentKey)}
              </button>
              {#if s.customized}
                <button class="reset-key-btn" onclick={() => doReset(s.id)} title="Reset to default"> ↺ </button>
              {/if}
            </div>
          </div>
        {/each}
      </div>
    </div>
  {/each}
</div>

<style>
  .shortcuts-wrap {
    max-width: 680px;
  }

  .shortcuts-header {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    margin-bottom: 4px;
  }

  .shortcuts-desc {
    font-size: 0.82rem;
    color: var(--text-muted);
    margin: 0 0 16px;
  }

  .shortcut-group {
    margin-bottom: 28px;
  }

  .group-title {
    font-size: 0.72rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.07em;
    color: var(--text-faint);
    margin: 0 0 8px;
    padding-bottom: 6px;
    border-bottom: 1px solid var(--border);
  }

  .shortcut-table {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .shortcut-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 10px;
    border-radius: 6px;
    transition: background 0.1s;
  }

  .shortcut-row:hover {
    background: var(--bg-hover);
  }

  .shortcut-info {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .shortcut-desc {
    font-size: 0.82rem;
  }

  .shortcut-cat {
    font-size: 0.65rem;
    color: var(--text-faint);
    background: var(--bg-hover);
    padding: 1px 6px;
    border-radius: 3px;
  }

  .shortcut-key-col {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .key-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 28px;
    height: 26px;
    padding: 0 8px;
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.75rem;
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: 5px;
    color: var(--text-primary);
    cursor: pointer;
    transition:
      background 0.15s,
      border-color 0.15s;
    box-shadow: 0 1px 0 var(--border);
  }

  .key-badge:hover {
    background: var(--bg-hover);
    border-color: var(--accent);
    color: var(--accent);
  }

  .key-badge.customized {
    border-color: var(--accent);
    color: var(--accent);
    background: color-mix(in srgb, var(--accent) 8%, var(--bg-secondary));
  }

  .default-key {
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.72rem;
    color: var(--text-faint);
    text-decoration: line-through;
  }

  .key-arrow {
    font-size: 0.7rem;
    color: var(--text-faint);
  }

  .reset-key-btn {
    background: none;
    border: none;
    cursor: pointer;
    color: var(--text-faint);
    font-size: 0.85rem;
    padding: 2px 4px;
    border-radius: 3px;
    transition: color 0.15s;
  }

  .reset-key-btn:hover {
    color: var(--danger);
  }

  /* Capture overlay */
  .capture-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 200;
  }

  .capture-modal {
    background: var(--bg-primary);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 28px 36px;
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
    min-width: 200px;
  }

  .capture-prompt {
    font-size: 0.82rem;
    color: var(--text-secondary);
    margin: 0;
  }

  .capture-key-preview {
    font-family: 'JetBrains Mono', monospace;
    font-size: 2rem;
    font-weight: 700;
    min-width: 60px;
    min-height: 56px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--bg-secondary);
    border: 2px solid var(--accent);
    border-radius: 8px;
    color: var(--accent);
    padding: 0 16px;
  }
</style>
