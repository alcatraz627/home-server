import { json } from '@sveltejs/kit';
import fs from 'node:fs/promises';
import path from 'node:path';
import { getUploadDir } from '$lib/server/config';
import { getMime } from '$lib/server/files';
import type { RequestHandler } from './$types';

interface SearchResult {
  name: string;
  path: string;
  size: number;
  modified: string;
}

async function searchFiles(dir: string, query: string, base: string, depth: number): Promise<SearchResult[]> {
  if (depth > 5) return [];

  const results: SearchResult[] = [];
  let entries;

  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return results;
  }

  const q = query.toLowerCase();

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const relativePath = path.relative(base, fullPath);

    if (entry.isDirectory()) {
      const nested = await searchFiles(fullPath, query, base, depth + 1);
      results.push(...nested);
    } else if (entry.name.toLowerCase().includes(q)) {
      try {
        const stat = await fs.stat(fullPath);
        results.push({
          name: entry.name,
          path: relativePath,
          size: stat.size,
          modified: stat.mtime.toISOString(),
        });
      } catch {
        // skip unreadable files
      }
    }

    if (results.length >= 50) break;
  }

  return results;
}

/** Search files recursively by name */
export const GET: RequestHandler = async ({ url }) => {
  const query = url.searchParams.get('q')?.trim();
  if (!query || query.length < 1) {
    return json({ results: [] });
  }

  const uploadDir = getUploadDir();
  const results = await searchFiles(uploadDir, query, uploadDir, 0);

  return json({ results: results.slice(0, 50) });
};
