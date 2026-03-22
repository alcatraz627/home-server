import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import type { PageServerLoad } from './$types';

const FILE = path.join(os.homedir(), '.home-server', 'bookmarks.json');

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
