import fs from 'node:fs';
import { CONFIG_DIR, PATHS } from './paths';
import { createLogger } from './logger';
import type { Tag } from '$lib/types/productivity';

export type { Tag };

const log = createLogger('tags');

function ensureDir() {
  if (!fs.existsSync(CONFIG_DIR)) fs.mkdirSync(CONFIG_DIR, { recursive: true });
}

export function readTags(): Tag[] {
  ensureDir();
  if (!fs.existsSync(PATHS.tags)) return [];
  try {
    const data = JSON.parse(fs.readFileSync(PATHS.tags, 'utf-8'));
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function writeTags(tags: Tag[]) {
  ensureDir();
  fs.writeFileSync(PATHS.tags, JSON.stringify(tags, null, 2));
}

/** Get or create a tag by name. Returns the tag (with incremented usageCount if existing). */
export function ensureTag(name: string, color = ''): Tag {
  const all = readTags();
  const normalized = name.toLowerCase().trim();
  const existing = all.find((t) => t.name.toLowerCase() === normalized);

  if (existing) {
    existing.usageCount++;
    if (color && !existing.color) existing.color = color;
    writeTags(all);
    return existing;
  }

  const tag: Tag = { name: normalized, color, usageCount: 1 };
  all.push(tag);
  writeTags(all);
  log.info('Tag created', { name: normalized });
  return tag;
}

/** Decrement usage count for a tag. Removes it if count reaches 0. */
export function releaseTag(name: string): void {
  const all = readTags();
  const normalized = name.toLowerCase().trim();
  const idx = all.findIndex((t) => t.name.toLowerCase() === normalized);
  if (idx === -1) return;

  all[idx].usageCount--;
  if (all[idx].usageCount <= 0) {
    all.splice(idx, 1);
    log.info('Tag removed (unused)', { name: normalized });
  }
  writeTags(all);
}

/** Update a tag's color */
export function updateTagColor(name: string, color: string): Tag | null {
  const all = readTags();
  const normalized = name.toLowerCase().trim();
  const tag = all.find((t) => t.name.toLowerCase() === normalized);
  if (!tag) return null;

  tag.color = color;
  writeTags(all);
  return tag;
}

/** Search tags by prefix (for autocomplete) */
export function searchTags(query: string, limit = 20): Tag[] {
  const normalized = query.toLowerCase().trim();
  if (!normalized)
    return readTags()
      .sort((a, b) => b.usageCount - a.usageCount)
      .slice(0, limit);
  return readTags()
    .filter((t) => t.name.includes(normalized))
    .sort((a, b) => b.usageCount - a.usageCount)
    .slice(0, limit);
}
