import { json } from '@sveltejs/kit';
import fs from 'node:fs';
import path from 'node:path';
import { exec } from 'node:child_process';
import type { RequestHandler } from './$types';

const APPLICATIONS_DIR = '/Applications';

interface AppInfo {
  name: string;
  path: string;
}

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

/** GET — list all .app bundles */
export const GET: RequestHandler = async () => {
  const apps = scanApps();
  return json(apps);
};

/** POST — launch an app by path */
export const POST: RequestHandler = async ({ request }) => {
  const { path: appPath } = await request.json();
  if (!appPath || typeof appPath !== 'string') {
    return json({ error: 'path is required' }, { status: 400 });
  }

  // Basic validation: must be under /Applications and end with .app
  if (!appPath.startsWith('/Applications/') || !appPath.endsWith('.app')) {
    return json({ error: 'Invalid app path' }, { status: 400 });
  }

  if (!fs.existsSync(appPath)) {
    return json({ error: 'App not found' }, { status: 404 });
  }

  return new Promise((resolve) => {
    exec(`open "${appPath}"`, (error) => {
      if (error) {
        resolve(json({ error: `Failed to launch: ${error.message}` }, { status: 500 }));
      } else {
        resolve(json({ ok: true, launched: appPath }));
      }
    });
  });
};
