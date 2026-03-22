import { json } from '@sveltejs/kit';
import fs from 'node:fs/promises';
import path from 'node:path';
import { execSync } from 'node:child_process';
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

/** Sanitize a wildcard pattern to prevent command injection */
function sanitizePattern(pattern: string): string {
  // Strip dangerous characters: ; | ` $ ( ) { } < > & \ newlines
  return pattern.replace(/[;|`$(){}\\<>&\n\r]/g, '').trim();
}

/** Wildcard search using find */
async function wildcardSearch(uploadDir: string, pattern: string): Promise<SearchResult[]> {
  const sanitized = sanitizePattern(pattern);
  if (!sanitized) return [];

  try {
    const output = execSync(`find "${uploadDir}" -name "${sanitized}" -maxdepth 5 2>/dev/null`, {
      encoding: 'utf-8',
      timeout: 5000,
    });

    const lines = output.trim().split('\n').filter(Boolean);
    const results: SearchResult[] = [];

    for (const line of lines.slice(0, 50)) {
      const fullPath = line.trim();
      const relativePath = path.relative(uploadDir, fullPath);
      const name = path.basename(fullPath);

      try {
        const stat = await fs.stat(fullPath);
        results.push({
          name,
          path: relativePath,
          size: stat.size,
          modified: stat.mtime.toISOString(),
        });
      } catch {
        // skip unreadable files
      }
    }

    return results;
  } catch {
    return [];
  }
}

/** Search files recursively by name */
export const GET: RequestHandler = async ({ url }) => {
  const query = url.searchParams.get('q')?.trim();
  if (!query || query.length < 1) {
    return json({ results: [] });
  }

  const wildcard = url.searchParams.get('wildcard') === 'true';
  const uploadDir = getUploadDir();

  const results = wildcard ? await wildcardSearch(uploadDir, query) : await searchFiles(uploadDir, query, uploadDir, 0);

  return json({ results: results.slice(0, 50) });
};
