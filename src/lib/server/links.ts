import crypto from 'node:crypto';
import fs from 'node:fs';
import { CONFIG_DIR, PATHS } from './paths';
import { createLogger } from './logger';
import type { LinkableModule, ItemLink } from '$lib/types/productivity';

export type { LinkableModule, ItemLink };

const log = createLogger('links');

function ensureDir() {
  if (!fs.existsSync(CONFIG_DIR)) fs.mkdirSync(CONFIG_DIR, { recursive: true });
}

export function readLinks(): ItemLink[] {
  ensureDir();
  if (!fs.existsSync(PATHS.links)) return [];
  try {
    const data = JSON.parse(fs.readFileSync(PATHS.links, 'utf-8'));
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function writeLinks(links: ItemLink[]) {
  ensureDir();
  fs.writeFileSync(PATHS.links, JSON.stringify(links, null, 2));
}

/** Get all links involving a specific item (as source OR target) */
export function getLinksForItem(type: LinkableModule, id: string): ItemLink[] {
  return readLinks().filter(
    (l) => (l.sourceType === type && l.sourceId === id) || (l.targetType === type && l.targetId === id),
  );
}

/** Create a bidirectional link between two items */
export function createLink(
  sourceType: LinkableModule,
  sourceId: string,
  targetType: LinkableModule,
  targetId: string,
  label?: string,
): ItemLink {
  const all = readLinks();

  // Prevent duplicates (same pair regardless of direction)
  const exists = all.some(
    (l) =>
      (l.sourceType === sourceType &&
        l.sourceId === sourceId &&
        l.targetType === targetType &&
        l.targetId === targetId) ||
      (l.sourceType === targetType &&
        l.sourceId === targetId &&
        l.targetType === sourceType &&
        l.targetId === sourceId),
  );
  if (exists) {
    const found = all.find(
      (l) =>
        (l.sourceType === sourceType &&
          l.sourceId === sourceId &&
          l.targetType === targetType &&
          l.targetId === targetId) ||
        (l.sourceType === targetType &&
          l.sourceId === targetId &&
          l.targetType === sourceType &&
          l.targetId === sourceId),
    )!;
    return found;
  }

  const link: ItemLink = {
    id: crypto.randomUUID().slice(0, 8),
    sourceType,
    sourceId,
    targetType,
    targetId,
    label,
    createdAt: new Date().toISOString(),
  };
  all.push(link);
  writeLinks(all);
  log.info('Link created', { id: link.id, source: `${sourceType}:${sourceId}`, target: `${targetType}:${targetId}` });
  return link;
}

/** Delete a link by id */
export function deleteLink(id: string): boolean {
  const all = readLinks();
  const filtered = all.filter((l) => l.id !== id);
  if (filtered.length === all.length) return false;
  writeLinks(filtered);
  log.info('Link deleted', { id });
  return true;
}

/** Delete all links involving a specific item (used when item is deleted) */
export function deleteLinksForItem(type: LinkableModule, id: string): number {
  const all = readLinks();
  const filtered = all.filter(
    (l) => !(l.sourceType === type && l.sourceId === id) && !(l.targetType === type && l.targetId === id),
  );
  const removed = all.length - filtered.length;
  if (removed > 0) {
    writeLinks(filtered);
    log.info('Links cleaned up', { type, id, removed });
  }
  return removed;
}

/** Get linked item references in a display-friendly format */
export function getLinkedItems(
  type: LinkableModule,
  id: string,
): { type: LinkableModule; id: string; linkId: string }[] {
  const links = getLinksForItem(type, id);
  return links.map((l) => {
    // Return the "other" end of the link
    if (l.sourceType === type && l.sourceId === id) {
      return { type: l.targetType, id: l.targetId, linkId: l.id };
    }
    return { type: l.sourceType, id: l.sourceId, linkId: l.id };
  });
}
