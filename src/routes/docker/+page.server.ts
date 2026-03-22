import { execSync } from 'node:child_process';
import type { PageServerLoad } from './$types';

function isDockerInstalled(): boolean {
  try {
    execSync('which docker', { encoding: 'utf-8', timeout: 3000 });
    return true;
  } catch {
    return false;
  }
}

export const load: PageServerLoad = async () => {
  const installed = isDockerInstalled();
  return { installed };
};
