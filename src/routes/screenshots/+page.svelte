<script lang="ts">
  import type { PageData } from './$types';
  import { toast } from '$lib/toast';

  interface Screenshot {
    filename: string;
    size: number;
    timestamp: string;
  }

  let { data } = $props<{ data: PageData }>();
  let screenshots = $state<Screenshot[]>(data.screenshots ?? []);

  let capturing = $state(false);
  let modalImage = $state<string | null>(null);
  let confirmDeleteFile = $state<string | null>(null);

  async function capture() {
    capturing = true;
    try {
      const res = await fetch('/api/screenshots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ _action: 'capture' }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Capture failed');
      }
      const shot = await res.json();
      screenshots = [shot, ...screenshots];
      toast.success('Screenshot captured');
    } catch (err: any) {
      toast.error(err.message || 'Failed to capture screenshot');
    } finally {
      capturing = false;
    }
  }

  async function deleteScreenshot(filename: string) {
    try {
      const res = await fetch('/api/screenshots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ _action: 'delete', filename }),
      });
      if (!res.ok) throw new Error();
      screenshots = screenshots.filter((s) => s.filename !== filename);
      confirmDeleteFile = null;
      toast.success('Screenshot deleted');
    } catch {
      toast.error('Failed to delete screenshot');
    }
  }

  function formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  }

  function formatTime(ts: string): string {
    return new Date(ts).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  }

  function imageUrl(filename: string): string {
    return `/api/screenshots?action=image&file=${encodeURIComponent(filename)}`;
  }
</script>

<div class="page">
  <div class="header">
    <h1>Screenshots</h1>
    <button class="btn-primary" onclick={capture} disabled={capturing}>
      {capturing ? 'Capturing...' : 'Take Screenshot'}
    </button>
  </div>

  {#if screenshots.length === 0}
    <div class="card empty">
      <p>No screenshots yet. Click "Take Screenshot" to capture one.</p>
    </div>
  {:else}
    <div class="gallery">
      {#each screenshots as shot (shot.filename)}
        <div class="card gallery-item">
          <button class="thumb-btn" onclick={() => (modalImage = shot.filename)}>
            <img src={imageUrl(shot.filename)} alt={shot.filename} class="thumbnail" loading="lazy" />
          </button>
          <div class="item-info">
            <span class="item-time">{formatTime(shot.timestamp)}</span>
            <span class="item-size">{formatSize(shot.size)}</span>
          </div>
          <div class="item-actions">
            {#if confirmDeleteFile === shot.filename}
              <button class="btn-xs btn-danger" onclick={() => deleteScreenshot(shot.filename)}>Confirm</button>
              <button class="btn-xs" onclick={() => (confirmDeleteFile = null)}>Cancel</button>
            {:else}
              <button class="btn-xs btn-danger" onclick={() => (confirmDeleteFile = shot.filename)}>Delete</button>
            {/if}
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>

{#if modalImage}
  <div class="modal-overlay" onclick={() => (modalImage = null)} role="dialog" aria-modal="true">
    <div class="modal-content" onclick={(e) => e.stopPropagation()}>
      <img src={imageUrl(modalImage)} alt={modalImage} class="modal-image" />
      <button class="modal-close" onclick={() => (modalImage = null)}>Close</button>
    </div>
  </div>
{/if}

<style>
  .page {
    padding: 1.5rem;
    max-width: 1000px;
    margin: 0 auto;
  }
  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1.5rem;
  }
  h1 {
    margin: 0;
    color: var(--text-primary);
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
  }
  .btn-primary:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
  .gallery {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    gap: 1rem;
  }
  .gallery-item {
    padding: 0;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }
  .thumb-btn {
    background: none;
    border: none;
    padding: 0;
    cursor: pointer;
    display: block;
    width: 100%;
  }
  .thumbnail {
    width: 100%;
    height: 160px;
    object-fit: cover;
    display: block;
    background: var(--bg-primary);
  }
  .item-info {
    padding: 0.6rem 0.75rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .item-time {
    font-size: 0.8rem;
    color: var(--text-secondary);
  }
  .item-size {
    font-size: 0.75rem;
    color: var(--text-muted);
  }
  .item-actions {
    padding: 0 0.75rem 0.6rem;
    display: flex;
    gap: 0.3rem;
  }
  .btn-xs {
    padding: 0.2rem 0.5rem;
    border: 1px solid var(--border);
    border-radius: 4px;
    background: var(--bg-secondary);
    color: var(--text-secondary);
    cursor: pointer;
    font-size: 0.7rem;
  }
  .btn-danger {
    color: var(--danger);
    border-color: var(--danger);
  }
  .empty {
    padding: 3rem;
    text-align: center;
    color: var(--text-muted);
  }
  .modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.85);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    padding: 2rem;
  }
  .modal-content {
    max-width: 95vw;
    max-height: 95vh;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
  }
  .modal-image {
    max-width: 100%;
    max-height: 85vh;
    object-fit: contain;
    border-radius: 8px;
  }
  .modal-close {
    padding: 0.5rem 1.5rem;
    background: var(--bg-secondary);
    color: var(--text-primary);
    border: 1px solid var(--border);
    border-radius: 6px;
    cursor: pointer;
    font-size: 0.9rem;
  }
</style>
