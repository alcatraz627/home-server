import fs from 'node:fs';
import path from 'node:path';
import type { PageServerLoad } from './$types';

export interface AppInfo {
  name: string;
  path: string;
}

const APPLICATIONS_DIR = '/Applications';

function scanApps(): AppInfo[] {
  try {
    if (!fs.existsSync(APPLICATIONS_DIR)) return [];
    const entries = fs.readdirSync(APPLICATIONS_DIR, { withFileTypes: true });
    return entries
      .filter((e) => e.name.endsWith('.app'))
      .map((e) => ({
        name: e.name.replace(/\.app$/, ''),
        path: path.join(APPLICATIONS_DIR, e.name),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  } catch {
    return [];
  }
}

export const load: PageServerLoad = async () => {
  const apps = scanApps();
  return { apps };
};
