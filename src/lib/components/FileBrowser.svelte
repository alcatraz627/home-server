<script lang="ts">
  import { fly } from 'svelte/transition';
  import Icon from '$lib/components/Icon.svelte';
  import { getErrorMessage } from '$lib/errors';

  interface Props {
    value: string;
    onselect: (path: string) => void;
    label?: string;
  }

  let { value, onselect, label = '' }: Props = $props();

  let open = $state(false);
  let currentPath = $state('');
  $effect(() => {
    currentPath = value || '';
  });
  let entries = $state<{ name: string; path: string; isDir: boolean; size: number }[]>([]);
  let loading = $state(false);
  let error = $state('');

  async function browse(dir: string) {
    loading = true;
    error = '';
    try {
      const res = await fetch(`/api/browse?path=${encodeURIComponent(dir)}`);
      const data = await res.json();
      currentPath = data.current;
      entries = data.entries;
      if (data.error) error = data.error;
    } catch (e: unknown) {
      error = getErrorMessage(e);
    }
    loading = false;
  }

  function openBrowser() {
    open = true;
    browse(value || '~');
  }

  function selectDir(path: string) {
    onselect(path);
    open = false;
  }

  function formatSize(bytes: number): string {
    if (bytes === 0) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  }
</script>

<button class="fb-trigger" onclick={openBrowser} type="button">
  {#if label}{label}{:else}<Icon name="folder-open" size={16} />{/if}
</button>

{#if open}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="fb-overlay" onclick={() => (open = false)}>
    <div class="fb-modal" onclick={(e) => e.stopPropagation()} transition:fly={{ y: 20, duration: 200 }}>
      <div class="fb-header">
        <span class="fb-title">Select Directory</span>
        <button class="fb-close" onclick={() => (open = false)}><Icon name="close" size={14} /></button>
      </div>

      <div class="fb-pathbar">
        <code class="fb-current">{currentPath}</code>
        <button class="fb-select-btn" onclick={() => selectDir(currentPath)}>Select this folder</button>
      </div>

      {#if error}
        <div class="fb-error">{error}</div>
      {/if}

      <div class="fb-list">
        {#if loading}
          <div class="fb-loading">Loading...</div>
        {:else}
          {#each entries as entry}
            {#if entry.isDir}
              <button class="fb-entry fb-dir" onclick={() => browse(entry.path)}>
                <span class="fb-icon"><Icon name="folder" size={14} /></span>
                <span class="fb-name">{entry.name}</span>
              </button>
            {:else}
              <div class="fb-entry fb-file">
                <span class="fb-icon"><Icon name="file" size={14} /></span>
                <span class="fb-name">{entry.name}</span>
                <span class="fb-size">{formatSize(entry.size)}</span>
              </div>
            {/if}
          {/each}
        {/if}
      </div>

      <div class="fb-footer">
        <button class="fb-cancel" onclick={() => (open = false)}>Cancel</button>
      </div>
    </div>
  </div>
{/if}

<style>
  .fb-trigger {
    padding: 4px 10px;
    font-size: 0.8rem;
    border-radius: 6px;
    border: 1px solid var(--border);
    background: var(--btn-bg);
    color: var(--accent);
    cursor: pointer;
    font-family: inherit;
    transition: all 0.15s;
  }

  .fb-trigger:hover {
    border-color: var(--accent);
    background: var(--accent-bg);
  }

  .fb-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    z-index: 1000;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
  }

  .fb-modal {
    width: 100%;
    max-width: 520px;
    max-height: 70vh;
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: 12px;
    box-shadow: 0 16px 48px rgba(0, 0, 0, 0.4);
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .fb-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 16px;
    border-bottom: 1px solid var(--border);
  }

  .fb-title {
    font-size: 0.9rem;
    font-weight: 600;
    color: var(--text-primary);
  }

  .fb-close {
    background: none;
    border: none;
    color: var(--text-faint);
    font-size: 1rem;
    cursor: pointer;
    padding: 4px 8px;
    border-radius: 4px;
  }

  .fb-close:hover {
    color: var(--danger);
    background: var(--danger-bg);
  }

  .fb-pathbar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 16px;
    gap: 10px;
    background: var(--bg-inset);
    border-bottom: 1px solid var(--border-subtle);
  }

  .fb-current {
    font-size: 0.7rem;
    color: var(--text-muted);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    flex: 1;
  }

  .fb-select-btn {
    font-size: 0.7rem;
    padding: 4px 12px;
    border-radius: 6px;
    border: 1px solid var(--accent);
    background: var(--accent);
    color: white;
    cursor: pointer;
    font-family: inherit;
    flex-shrink: 0;
    transition: filter 0.15s;
  }

  .fb-select-btn:hover {
    filter: brightness(1.15);
  }

  .fb-error {
    padding: 8px 16px;
    font-size: 0.75rem;
    color: var(--danger);
    background: var(--danger-bg);
  }

  .fb-list {
    flex: 1;
    overflow-y: auto;
    max-height: 400px;
  }

  .fb-loading {
    padding: 24px;
    text-align: center;
    font-size: 0.8rem;
    color: var(--text-muted);
  }

  .fb-entry {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 16px;
    font-size: 0.8rem;
    width: 100%;
    text-align: left;
    border: none;
    background: none;
    color: var(--text-primary);
    font-family: inherit;
  }

  .fb-dir {
    cursor: pointer;
    transition: background 0.1s;
  }

  .fb-dir:hover {
    background: var(--bg-hover);
  }

  .fb-file {
    color: var(--text-faint);
  }

  .fb-icon {
    font-size: 0.9rem;
    flex-shrink: 0;
  }

  .fb-name {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .fb-size {
    font-size: 0.65rem;
    color: var(--text-faint);
    font-family: 'JetBrains Mono', monospace;
    flex-shrink: 0;
  }

  .fb-footer {
    padding: 8px 16px;
    border-top: 1px solid var(--border);
    display: flex;
    justify-content: flex-end;
  }

  .fb-cancel {
    font-size: 0.75rem;
    padding: 4px 14px;
    border-radius: 6px;
    border: 1px solid var(--border);
    background: var(--btn-bg);
    color: var(--text-muted);
    cursor: pointer;
    font-family: inherit;
  }

  .fb-cancel:hover {
    border-color: var(--danger);
    color: var(--danger);
  }
</style>
