import { json } from '@sveltejs/kit';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execSync } from 'node:child_process';
import type { RequestHandler } from './$types';

const DATA_DIR = path.join(os.homedir(), '.home-server');
const SCREENSHOTS_DIR = path.join(DATA_DIR, 'screenshots');

function ensureDir() {
  if (!fs.existsSync(SCREENSHOTS_DIR)) fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

export const GET: RequestHandler = async ({ url }) => {
  ensureDir();

  const action = url.searchParams.get('action');

  // Serve a specific image
  if (action === 'image') {
    const filename = url.searchParams.get('file');
    if (!filename) return json({ error: 'File required' }, { status: 400 });

    // Prevent directory traversal
    const safeName = path.basename(filename);
    const filePath = path.join(SCREENSHOTS_DIR, safeName);

    if (!fs.existsSync(filePath)) {
      return json({ error: 'Not found' }, { status: 404 });
    }

    const data = fs.readFileSync(filePath);
    const ext = path.extname(safeName).toLowerCase();
    const mime =
      ext === '.png' ? 'image/png' : ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : 'application/octet-stream';

    return new Response(data, {
      headers: {
        'Content-Type': mime,
        'Cache-Control': 'public, max-age=3600',
      },
    });
  }

  // List all screenshots
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

  return json(files);
};

export const POST: RequestHandler = async ({ request }) => {
  ensureDir();
  const body = await request.json();

  if (body._action === 'capture') {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `screenshot-${timestamp}.png`;
    const filePath = path.join(SCREENSHOTS_DIR, filename);

    try {
      // macOS screencapture (silent mode)
      execSync(`screencapture -x "${filePath}"`, { timeout: 10000 });

      if (!fs.existsSync(filePath)) {
        return json({ error: 'Screenshot capture failed' }, { status: 500 });
      }

      const stat = fs.statSync(filePath);
      return json(
        {
          filename,
          size: stat.size,
          timestamp: stat.mtime.toISOString(),
        },
        { status: 201 },
      );
    } catch (err: any) {
      return json({ error: `Capture failed: ${err.message}` }, { status: 500 });
    }
  }

  if (body._action === 'delete') {
    const safeName = path.basename(body.filename);
    const filePath = path.join(SCREENSHOTS_DIR, safeName);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    return json({ ok: true });
  }

  return json({ error: 'Invalid action' }, { status: 400 });
};
