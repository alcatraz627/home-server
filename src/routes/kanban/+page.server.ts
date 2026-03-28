import fs from 'node:fs';
import type { PageServerLoad } from './$types';
import { PATHS } from '$lib/server/paths';

const FILE = PATHS.kanban;

export const load: PageServerLoad = async () => {
  try {
    if (fs.existsSync(FILE)) {
      const cards = JSON.parse(fs.readFileSync(FILE, 'utf-8'));
      return { cards };
    }
  } catch {
    // ignore
  }
  return { cards: [] };
};
