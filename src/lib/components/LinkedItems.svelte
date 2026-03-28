<script lang="ts">
  import { onMount } from 'svelte';
  import { postJson } from '$lib/api';
  import { toast } from '$lib/toast';
  import Icon from './Icon.svelte';
  import type { LinkableModule, ItemLink, LinkedRef } from '$lib/types/productivity';

  const MODULE_META: Record<LinkableModule, { icon: string; label: string; href: string }> = {
    note: { icon: 'file-text', label: 'Note', href: '/notes' },
    kanban: { icon: 'kanban', label: 'Card', href: '/kanban' },
    reminder: { icon: 'bell', label: 'Reminder', href: '/reminders' },
    bookmark: { icon: 'link', label: 'Bookmark', href: '/bookmarks' },
    keeper: { icon: 'bookmark', label: 'Feature', href: '/keeper' },
  };

  let { itemType, itemId } = $props<{ itemType: LinkableModule; itemId: string }>();

  let links = $state<ItemLink[]>([]);
  let titles = $state<Record<string, string>>({});
  let loading = $state(true);

  let linkedRefs = $derived<LinkedRef[]>(
    links.map((l) => {
      if (l.sourceType === itemType && l.sourceId === itemId) {
        return {
          type: l.targetType,
          id: l.targetId,
          linkId: l.id,
          title: titles[`${l.targetType}:${l.targetId}`],
        };
      }
      return {
        type: l.sourceType,
        id: l.sourceId,
        linkId: l.id,
        title: titles[`${l.sourceType}:${l.sourceId}`],
      };
    }),
  );

  onMount(() => {
    fetchLinks();
  });

  async function fetchLinks() {
    try {
      const res = await fetch(`/api/links?type=${itemType}&id=${itemId}`);
      if (res.ok) {
        links = await res.json();
        // Resolve titles for linked items
        if (links.length > 0) {
          await resolveLinkedTitles();
        }
      }
    } catch {
      // silently ignore
    } finally {
      loading = false;
    }
  }

  async function resolveLinkedTitles() {
    const refs = links.map((l) => {
      if (l.sourceType === itemType && l.sourceId === itemId) {
        return `${l.targetType}:${l.targetId}`;
      }
      return `${l.sourceType}:${l.sourceId}`;
    });

    try {
      const res = await fetch(`/api/resolve?items=${refs.join(',')}`);
      if (res.ok) {
        const resolved: { type: string; id: string; title: string }[] = await res.json();
        const map: Record<string, string> = {};
        for (const r of resolved) {
          map[`${r.type}:${r.id}`] = r.title;
        }
        titles = map;
      }
    } catch {
      // Fall back to showing IDs
    }
  }

  async function removeLink(linkId: string) {
    try {
      const res = await postJson('/api/links', { _action: 'delete', id: linkId });
      if (!res.ok) throw new Error();
      links = links.filter((l) => l.id !== linkId);
      toast.success('Link removed');
    } catch {
      toast.error('Failed to remove link');
    }
  }
</script>

{#if !loading && linkedRefs.length > 0}
  <div class="linked-items">
    {#each linkedRefs as ref}
      {@const meta = MODULE_META[ref.type]}
      <div class="linked-chip">
        <a href={meta.href} class="chip-link" title="{meta.label}: {ref.title ?? ref.id}">
          <Icon name={meta.icon} size={11} />
          <span class="chip-type">{meta.label}</span>
          <span class="chip-title">{ref.title ?? ref.id.slice(0, 6)}</span>
        </a>
        <button class="chip-remove" title="Remove link" onclick={() => removeLink(ref.linkId)}>
          <Icon name="close" size={9} />
        </button>
      </div>
    {/each}
  </div>
{/if}

<style>
  .linked-items {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    margin-top: 4px;
  }

  .linked-chip {
    display: inline-flex;
    align-items: center;
    border: 1px solid var(--border);
    border-radius: 6px;
    overflow: hidden;
    font-size: 0.65rem;
    background: var(--bg-secondary);
  }

  .chip-link {
    display: flex;
    align-items: center;
    gap: 3px;
    padding: 2px 6px;
    color: var(--text-secondary);
    text-decoration: none;
    transition: color 0.1s;
  }

  .chip-link:hover {
    color: var(--accent);
  }

  .chip-type {
    font-weight: 600;
  }

  .chip-title {
    color: var(--text-faint);
    font-size: 0.62rem;
    max-width: 120px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .chip-remove {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 2px 4px;
    border: none;
    border-left: 1px solid var(--border);
    background: transparent;
    color: var(--text-faint);
    cursor: pointer;
    transition: all 0.1s;
  }

  .chip-remove:hover {
    background: var(--danger-bg);
    color: var(--danger);
  }
</style>
