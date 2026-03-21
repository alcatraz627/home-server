import fs from 'fs';
import path from 'path';
import type { PageServerLoad } from './$types';

export interface DocFile {
  name: string;
  path: string;
  content: string;
}

function collectMdFiles(dir: string, relativeBase: string): DocFile[] {
  const results: DocFile[] = [];
  let entries: string[];
  try {
    entries = fs.readdirSync(dir);
  } catch {
    return results;
  }
  for (const entry of entries) {
    if (entry.endsWith('.md')) {
      const fullPath = path.join(dir, entry);
      const relativePath = path.join(relativeBase, entry);
      results.push({
        name: entry,
        path: relativePath,
        content: fs.readFileSync(fullPath, 'utf-8'),
      });
    }
  }
  return results;
}

export const load: PageServerLoad = () => {
  const projectRoot = path.resolve('.');

  const docsFiles = collectMdFiles(path.join(projectRoot, 'docs'), 'docs').sort((a, b) => a.name.localeCompare(b.name));

  const rootFiles = collectMdFiles(projectRoot, '.').sort((a, b) => a.name.localeCompare(b.name));

  const files: DocFile[] = [...docsFiles, ...rootFiles];

  return { files };
};
