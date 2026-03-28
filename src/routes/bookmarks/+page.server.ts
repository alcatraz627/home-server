import fs from 'node:fs';
import type { PageServerLoad } from './$types';
import { PATHS } from '$lib/server/paths';

const FILE = PATHS.bookmarks;

export const load: PageServerLoad = async () => {
  try {
    if (fs.existsSync(FILE)) {
      const bookmarks = JSON.parse(fs.readFileSync(FILE, 'utf-8'));
      return { bookmarks };
    }
  } catch {
    // ignore
  }
  return { bookmarks: [] };
};
