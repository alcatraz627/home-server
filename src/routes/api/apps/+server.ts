import { json } from '@sveltejs/kit';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { exec, execSync } from 'node:child_process';
import type { RequestHandler } from './$types';
import { sanitizeShellArg } from '$lib/server/security';

const isMac = os.platform() === 'darwin';
const APPLICATIONS_DIR = '/Applications';
const LINUX_DESKTOP_DIRS = ['/usr/share/applications', '/usr/local/share/applications'];

interface AppInfo {
  name: string;
  path: string;
  exec?: string;
}

function parseDesktopFile(filePath: string): AppInfo | null {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    // Only include Application type entries, skip hidden/NoDisplay
    if (!/\[Desktop Entry\]/i.test(content)) return null;
    const typeMatch = content.match(/^Type=(.+)/m);
    if (typeMatch && typeMatch[1].trim() !== 'Application') return null;
    const noDisplay = content.match(/^NoDisplay=(.+)/m);
    if (noDisplay && noDisplay[1].trim().toLowerCase() === 'true') return null;
    const hidden = content.match(/^Hidden=(.+)/m);
    if (hidden && hidden[1].trim().toLowerCase() === 'true') return null;

    const nameMatch = content.match(/^Name=(.+)/m);
    const execMatch = content.match(/^Exec=(.+)/m);
    if (!nameMatch) return null;

    const name = nameMatch[1].trim();
    // Clean Exec field — remove %f, %F, %u, %U, etc.
    const execCmd = execMatch
      ? execMatch[1]
          .trim()
          .replace(/%[fFuUdDnNickvm]/g, '')
          .trim()
      : '';

    return {
      name,
      path: filePath,
      exec: execCmd || undefined,
    };
  } catch {
    return null;
  }
}

function scanApps(): AppInfo[] {
  try {
    if (isMac) {
      if (!fs.existsSync(APPLICATIONS_DIR)) return [];
      const entries = fs.readdirSync(APPLICATIONS_DIR, { withFileTypes: true });
      return entries
        .filter((e) => e.name.endsWith('.app'))
        .map((e) => ({
          name: e.name.replace(/\.app$/, ''),
          path: path.join(APPLICATIONS_DIR, e.name),
        }))
        .sort((a, b) => a.name.localeCompare(b.name));
    } else {
      // Linux: scan .desktop files
      const apps: AppInfo[] = [];
      const seen = new Set<string>();

      // Also check user-local applications
      const homeDirs = [path.join(os.homedir(), '.local/share/applications')];
      const allDirs = [...LINUX_DESKTOP_DIRS, ...homeDirs];

      for (const dir of allDirs) {
        if (!fs.existsSync(dir)) continue;
        try {
          const entries = fs.readdirSync(dir).filter((f) => f.endsWith('.desktop'));
          for (const entry of entries) {
            if (seen.has(entry)) continue;
            seen.add(entry);
            const app = parseDesktopFile(path.join(dir, entry));
            if (app) apps.push(app);
          }
        } catch {
          continue;
        }
      }

      return apps.sort((a, b) => a.name.localeCompare(b.name));
    }
  } catch {
    return [];
  }
}

function getRunningApps(): string[] {
  try {
    const output = execSync('ps -eo comm 2>/dev/null', { encoding: 'utf-8' });
    const lines = output.split('\n');
    const running = new Set<string>();
    for (const line of lines) {
      const trimmed = line.trim();
      if (isMac) {
        if (trimmed.includes('/Applications/')) {
          const match = trimmed.match(/\/Applications\/([^/]+)\.app/);
          if (match) running.add(match[1]);
        }
      } else {
        // On Linux, just capture the basename of running processes
        const basename = path.basename(trimmed);
        if (basename) running.add(basename);
      }
    }
    return [...running];
  } catch {
    return [];
  }
}

function getRunningAppPids(appName: string): number[] {
  try {
    if (isMac) {
      const output = execSync(`pgrep -f "/Applications/${sanitizeShellArg(appName)}.app" 2>/dev/null`, {
        encoding: 'utf-8',
      });
      return output
        .trim()
        .split('\n')
        .map((s) => parseInt(s, 10))
        .filter((n) => !isNaN(n));
    } else {
      const output = execSync(`pgrep -f "${sanitizeShellArg(appName)}" 2>/dev/null`, {
        encoding: 'utf-8',
      });
      return output
        .trim()
        .split('\n')
        .map((s) => parseInt(s, 10))
        .filter((n) => !isNaN(n));
    }
  } catch {
    return [];
  }
}

/** GET — list all apps + running apps */
export const GET: RequestHandler = async () => {
  const apps = scanApps();
  const running = getRunningApps();
  return json({ apps, running });
};

/** POST — launch an app by path */
export const POST: RequestHandler = async ({ request }) => {
  const body = await request.json();
  const appPath = body.path;
  if (!appPath || typeof appPath !== 'string') {
    return json({ error: 'path is required' }, { status: 400 });
  }

  if (isMac) {
    // macOS: must be under /Applications and end with .app
    if (!appPath.startsWith('/Applications/') || !appPath.endsWith('.app')) {
      return json({ error: 'Invalid app path' }, { status: 400 });
    }

    if (!fs.existsSync(appPath)) {
      return json({ error: 'App not found' }, { status: 404 });
    }

    const safeAppPath = sanitizeShellArg(appPath);
    return new Promise((resolve) => {
      exec(`open "${safeAppPath}"`, (error) => {
        if (error) {
          resolve(json({ error: `Failed to launch: ${error.message}` }, { status: 500 }));
        } else {
          resolve(json({ ok: true, launched: appPath }));
        }
      });
    });
  } else {
    // Linux: launch .desktop file or use xdg-open
    if (!appPath.endsWith('.desktop')) {
      return json({ error: 'Invalid app path — expected .desktop file' }, { status: 400 });
    }

    // Validate the .desktop file is in a known applications directory
    const allowedDirs = [...LINUX_DESKTOP_DIRS, path.join(os.homedir(), '.local/share/applications')];
    const resolvedPath = path.resolve(appPath);
    const isInAllowedDir = allowedDirs.some(
      (dir) => resolvedPath.startsWith(path.resolve(dir) + path.sep) || resolvedPath === path.resolve(dir),
    );
    if (!isInAllowedDir) {
      return json({ error: 'App path is not in an allowed applications directory' }, { status: 400 });
    }

    if (!fs.existsSync(resolvedPath)) {
      return json({ error: 'App not found' }, { status: 404 });
    }

    // Parse the .desktop file to get the Exec command
    const app = parseDesktopFile(resolvedPath);
    if (!app) {
      return json({ error: 'Could not parse .desktop file' }, { status: 400 });
    }

    const safeExec = app.exec ? sanitizeShellArg(app.exec) : '';
    const launchCmd = safeExec ? `nohup ${safeExec} >/dev/null 2>&1 &` : `xdg-open "${sanitizeShellArg(resolvedPath)}"`;

    return new Promise((resolve) => {
      exec(launchCmd, (error) => {
        if (error) {
          resolve(json({ error: `Failed to launch: ${error.message}` }, { status: 500 }));
        } else {
          resolve(json({ ok: true, launched: appPath }));
        }
      });
    });
  }
};

/** DELETE — kill a running app */
export const DELETE: RequestHandler = async ({ request }) => {
  const body = await request.json();
  const appName = body.name;
  const force = body.force === true;

  if (!appName || typeof appName !== 'string') {
    return json({ error: 'name is required' }, { status: 400 });
  }

  try {
    if (isMac) {
      // Use osascript for graceful quit, kill -9 for force
      if (force) {
        const pids = getRunningAppPids(appName);
        if (pids.length === 0) {
          return json({ error: `${appName} is not running` }, { status: 404 });
        }
        for (const pid of pids) {
          try {
            process.kill(pid, 'SIGKILL');
          } catch {}
        }
        return json({ ok: true, killed: appName, force: true, pids });
      } else {
        const safeAppName = sanitizeShellArg(appName);
        return new Promise((resolve) => {
          exec(`osascript -e 'tell application "${safeAppName}" to quit'`, (error) => {
            if (error) {
              resolve(json({ error: `Failed to quit: ${error.message}` }, { status: 500 }));
            } else {
              resolve(json({ ok: true, killed: appName, force: false }));
            }
          });
        });
      }
    } else {
      // Linux: use pkill
      const signal = force ? 'SIGKILL' : 'SIGTERM';
      const safeAppName = sanitizeShellArg(appName);
      return new Promise((resolve) => {
        exec(`pkill -${force ? '9' : '15'} -f "${safeAppName}" 2>/dev/null`, (error) => {
          if (error && error.code !== 1) {
            resolve(json({ error: `Failed to kill: ${error.message}` }, { status: 500 }));
          } else {
            resolve(json({ ok: true, killed: appName, force }));
          }
        });
      });
    }
  } catch (e: any) {
    return json({ error: e.message || 'Kill failed' }, { status: 500 });
  }
};
