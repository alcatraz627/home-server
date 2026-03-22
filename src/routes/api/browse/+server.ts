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

/**
 * Allowed browse roots. Users can only browse within these directories.
 * The parent (..) navigation is also constrained to stay within an allowed root.
 */
function getAllowedRoots(): string[] {
  const roots = [os.homedir()];

  // Also allow common system dirs for inspection (read-only)
  const inspectDirs = ['/tmp', '/var/log', '/etc'];
  for (const dir of inspectDirs) {
    if (fs.existsSync(dir)) roots.push(dir);
  }

  // Allow UPLOAD_DIR if set
  try {
    const uploadDir = path.resolve(process.env.UPLOAD_DIR || './uploads');
    if (!roots.includes(uploadDir)) roots.push(uploadDir);
  } catch {}

  return roots.map((r) => path.resolve(r));
}

function isWithinAllowedRoot(targetPath: string, roots: string[]): boolean {
  const resolved = path.resolve(targetPath);
  return roots.some((root) => resolved === root || resolved.startsWith(root + path.sep));
}

export const GET: RequestHandler = async ({ url }) => {
  let dirPath = url.searchParams.get('path') || os.homedir();
  // Expand ~ to home directory
  if (dirPath === '~' || dirPath.startsWith('~/')) {
    dirPath = dirPath.replace(/^~/, os.homedir());
  }
  const resolved = path.resolve(dirPath);
  const allowedRoots = getAllowedRoots();

  // Check if the requested path is within an allowed root
  if (!isWithinAllowedRoot(resolved, allowedRoots)) {
    return json(
      {
        current: resolved,
        entries: [],
        error: 'Access denied — path is outside allowed directories',
        allowedRoots,
      },
      { status: 403 },
    );
  }

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

    // Add parent directory entry — but only if parent is still within allowed roots
    const parent = path.dirname(resolved);
    if (parent !== resolved && isWithinAllowedRoot(parent, allowedRoots)) {
      items.unshift({ name: '..', path: parent, isDir: true, size: 0 });
    }

    return json({ current: resolved, entries: items });
  } catch (e: any) {
    const code = e.code || '';
    const safeError =
      code === 'ENOENT'
        ? 'Directory not found'
        : code === 'EACCES'
          ? 'Permission denied'
          : code === 'ENOTDIR'
            ? 'Not a directory'
            : 'Unable to read directory';
    return json({ current: resolved, entries: [], error: safeError }, { status: 200 });
  }
};
