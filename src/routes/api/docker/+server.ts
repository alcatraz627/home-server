import { json } from '@sveltejs/kit';
import { errorMessage, errorCode } from '$lib/server/errors';
import { execSync } from 'node:child_process';
import type { RequestHandler } from './$types';

export interface DockerContainer {
  id: string;
  name: string;
  image: string;
  status: string;
  state: string;
  ports: string;
  created: string;
}

function isDockerInstalled(): boolean {
  try {
    execSync('which docker', { encoding: 'utf-8', timeout: 3000 });
    return true;
  } catch {
    return false;
  }
}

function listContainers(): DockerContainer[] {
  try {
    const output = execSync('docker ps -a --format "{{json .}}"', {
      encoding: 'utf-8',
      timeout: 10000,
    });
    return output
      .trim()
      .split('\n')
      .filter(Boolean)
      .map((line) => {
        const c = JSON.parse(line);
        return {
          id: c.ID,
          name: c.Names,
          image: c.Image,
          status: c.Status,
          state: c.State,
          ports: c.Ports || '',
          created: c.CreatedAt || c.RunningFor || '',
        };
      });
  } catch {
    return [];
  }
}

/** List containers */
export const GET: RequestHandler = async () => {
  const installed = isDockerInstalled();
  if (!installed) return json({ installed, containers: [] });
  const containers = listContainers();
  return json({ installed, containers });
};

/** Start/stop/restart container */
export const POST: RequestHandler = async ({ request }) => {
  if (!isDockerInstalled()) {
    return json({ error: 'Docker not installed' }, { status: 400 });
  }

  const body = await request.json();
  const { action, id } = body;

  if (!id || !['start', 'stop', 'restart'].includes(action)) {
    return json({ error: 'Invalid action or missing container id' }, { status: 400 });
  }

  try {
    execSync(`docker ${action} ${id}`, { encoding: 'utf-8', timeout: 30000 });
    return json({ ok: true });
  } catch (err: unknown) {
    return json({ error: errorMessage(err) }, { status: 500 });
  }
};
