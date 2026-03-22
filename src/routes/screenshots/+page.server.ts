import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import type { PageServerLoad } from './$types';

const SCREENSHOTS_DIR = path.join(os.homedir(), '.home-server', 'screenshots');

export const load: PageServerLoad = async () => {
  try {
    if (!fs.existsSync(SCREENSHOTS_DIR)) {
      fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
      return { screenshots: [] };
    }

    const files = fs
      .readdirSync(SCREENSHOTS_DIR)
      .filter((f) => /\.(png|jpg|jpeg)$/i.test(f))
      .map((f) => {
        const stat = fs.statSync(path.join(SCREENSHOTS_DIR, f));
        return {
          filename: f,
          size: stat.size,
          timestamp: stat.mtime.toISOString(),
        };
      })
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return { screenshots: files };
  } catch {
    return { screenshots: [] };
  }
};
