import fs from 'fs';
import path from 'path';
import type { PageServerLoad } from './$types';

export interface DocFile {
  name: string;
  path: string;
  content: string;
  category: string;
}

export interface DocCategory {
  id: string;
  label: string;
  files: DocFile[];
}

function collectMdFiles(dir: string, relativeBase: string, category: string): DocFile[] {
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
        category,
      });
    }
  }
  return results;
}

const CATEGORY_ORDER: { id: string; label: string; dirs: { dir: string; relBase: string }[] }[] = [
  {
    id: 'page-guides',
    label: 'Page Guides',
    dirs: [{ dir: 'docs/pages', relBase: 'docs/pages' }],
  },
  {
    id: 'architecture',
    label: 'Architecture',
    dirs: [{ dir: 'docs', relBase: 'docs' }],
  },
  {
    id: 'reference',
    label: 'Reference',
    dirs: [{ dir: 'docs', relBase: 'docs' }],
  },
  {
    id: 'setup',
    label: 'Setup',
    dirs: [{ dir: 'docs', relBase: 'docs' }],
  },
];

const ARCHITECTURE_FILES = ['architecture.md', 'extending.md', 'widgets.md', 'claude-keeper.md', 'roadmap.md'];
const REFERENCE_FILES = ['api-reference.md'];
const SETUP_FILES = ['setup-guide.md'];

export const load: PageServerLoad = () => {
  const projectRoot = path.resolve('.');

  // Page guides
  const pageGuides = collectMdFiles(path.join(projectRoot, 'docs', 'pages'), 'docs/pages', 'page-guides').sort((a, b) =>
    a.name.localeCompare(b.name),
  );

  // Architecture docs
  const allDocsFiles = collectMdFiles(path.join(projectRoot, 'docs'), 'docs', 'architecture');
  const architectureFiles = allDocsFiles
    .filter((f) => ARCHITECTURE_FILES.includes(f.name))
    .map((f) => ({ ...f, category: 'architecture' }))
    .sort((a, b) => a.name.localeCompare(b.name));

  // Reference docs
  const referenceFiles = allDocsFiles
    .filter((f) => REFERENCE_FILES.includes(f.name))
    .map((f) => ({ ...f, category: 'reference' }))
    .sort((a, b) => a.name.localeCompare(b.name));

  // Setup docs
  const setupFiles = allDocsFiles
    .filter((f) => SETUP_FILES.includes(f.name))
    .map((f) => ({ ...f, category: 'setup' }))
    .sort((a, b) => a.name.localeCompare(b.name));

  // Root-level md files (README, etc.)
  const rootFiles = collectMdFiles(projectRoot, '.', 'setup')
    .filter((f) => !f.name.startsWith('CLAUDE'))
    .sort((a, b) => a.name.localeCompare(b.name));

  const categories: DocCategory[] = [
    { id: 'page-guides', label: 'Page Guides', files: pageGuides },
    { id: 'architecture', label: 'Architecture', files: architectureFiles },
    { id: 'reference', label: 'Reference', files: referenceFiles },
    { id: 'setup', label: 'Setup', files: [...setupFiles, ...rootFiles] },
  ].filter((c) => c.files.length > 0);

  // Also return flat list for backward compatibility
  const files: DocFile[] = [...pageGuides, ...architectureFiles, ...referenceFiles, ...setupFiles, ...rootFiles];

  return { files, categories };
};
