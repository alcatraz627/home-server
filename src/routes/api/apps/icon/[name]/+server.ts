import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const isMac = os.platform() === 'darwin';
const CACHE_DIR = path.join(os.homedir(), '.home-server', 'icon-cache');

function ensureCacheDir() {
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
  }
}

function getIconPath(appName: string): string | null {
  if (!isMac) return null;

  const appPath = `/Applications/${appName}.app`;
  if (!fs.existsSync(appPath)) return null;

  // Read Info.plist to find icon file name
  try {
    const iconFile = execSync(
      `defaults read "/Applications/${appName}.app/Contents/Info" CFBundleIconFile 2>/dev/null`,
      { encoding: 'utf-8', timeout: 3000 },
    ).trim();

    const iconName = iconFile.endsWith('.icns') ? iconFile : `${iconFile}.icns`;
    const fullPath = path.join(appPath, 'Contents', 'Resources', iconName);

    if (fs.existsSync(fullPath)) return fullPath;
  } catch {}

  // Fallback: look for any .icns file in Resources
  try {
    const resourcesDir = path.join(appPath, 'Contents', 'Resources');
    if (fs.existsSync(resourcesDir)) {
      const icnsFiles = fs.readdirSync(resourcesDir).filter((f) => f.endsWith('.icns'));
      if (icnsFiles.length > 0) {
        return path.join(resourcesDir, icnsFiles[0]);
      }
    }
  } catch {}

  return null;
}

export const GET: RequestHandler = async ({ params }) => {
  const appName = params.name;
  if (!appName) throw error(400, 'name is required');
  if (!isMac) throw error(404, 'Icon extraction is macOS only');

  ensureCacheDir();

  const cachePath = path.join(CACHE_DIR, `${appName}.png`);

  // Serve from cache if exists and is recent (7 days)
  if (fs.existsSync(cachePath)) {
    const stat = fs.statSync(cachePath);
    const age = Date.now() - stat.mtimeMs;
    if (age < 7 * 24 * 60 * 60 * 1000) {
      const data = fs.readFileSync(cachePath);
      return new Response(data, {
        headers: {
          'Content-Type': 'image/png',
          'Cache-Control': 'public, max-age=604800',
        },
      });
    }
  }

  // Extract icon
  const icnsPath = getIconPath(appName);
  if (!icnsPath) throw error(404, 'No icon found');

  try {
    // Use sips to convert .icns to .png (macOS built-in)
    execSync(`sips -s format png -z 128 128 "${icnsPath}" --out "${cachePath}" 2>/dev/null`, {
      timeout: 10000,
    });

    if (fs.existsSync(cachePath)) {
      const data = fs.readFileSync(cachePath);
      return new Response(data, {
        headers: {
          'Content-Type': 'image/png',
          'Cache-Control': 'public, max-age=604800',
        },
      });
    }
  } catch {}

  throw error(500, 'Icon extraction failed');
};
