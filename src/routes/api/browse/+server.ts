import { json } from '@sveltejs/kit';
import fs from 'fs';
import path from 'path';
import os from 'os';
import type { RequestHandler } from './$types';

export interface BrowseEntry {
  name: string;
  path: string;
  isDir: boolean;
  size: number;
}

export const GET: RequestHandler = async ({ url }) => {
  let dirPath = url.searchParams.get('path') || os.homedir();
  // Expand ~ to home directory
  if (dirPath === '~' || dirPath.startsWith('~/')) {
    dirPath = dirPath.replace(/^~/, os.homedir());
  }
  const resolved = path.resolve(dirPath);

  try {
    const entries = fs.readdirSync(resolved, { withFileTypes: true });
    const items: BrowseEntry[] = entries
      .filter((e) => !e.name.startsWith('.') || e.name === '..')
      .map((e) => {
        const fullPath = path.join(resolved, e.name);
        let size = 0;
        try {
          if (!e.isDirectory()) size = fs.statSync(fullPath).size;
        } catch {}
        return {
          name: e.name,
          path: fullPath,
          isDir: e.isDirectory(),
          size,
        };
      })
      .sort((a, b) => {
        if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
        return a.name.localeCompare(b.name);
      });

    // Add parent directory entry
    const parent = path.dirname(resolved);
    if (parent !== resolved) {
      items.unshift({ name: '..', path: parent, isDir: true, size: 0 });
    }

    return json({ current: resolved, entries: items });
  } catch (e: any) {
    return json({ current: resolved, entries: [], error: e.message }, { status: 200 });
  }
};
