import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import fs from 'fs';
import path from 'path';
import type { RequestHandler } from './$types';

function getCodebaseContext(): string {
  const root = path.resolve('.');
  const sections: string[] = [];

  // Read key files for context
  const contextFiles = ['CLAUDE.md', 'PROJECT.md', 'package.json', 'src/lib/types.ts', 'src/routes/+layout.svelte'];

  for (const file of contextFiles) {
    try {
      const content = fs.readFileSync(path.join(root, file), 'utf-8');
      // Truncate large files
      const truncated = content.length > 2000 ? content.slice(0, 2000) + '\n... (truncated)' : content;
      sections.push(`### ${file}\n\`\`\`\n${truncated}\n\`\`\``);
    } catch {
      // File doesn't exist, skip
    }
  }

  // List all route files
  try {
    const routesDir = path.join(root, 'src/routes');
    const routes = listFiles(routesDir, routesDir)
      .filter((f) => f.endsWith('+page.svelte') || f.endsWith('+server.ts'))
      .sort();
    sections.push(`### Routes\n${routes.map((r) => `- ${r}`).join('\n')}`);
  } catch {}

  // List server modules
  try {
    const serverDir = path.join(root, 'src/lib/server');
    const modules = fs.readdirSync(serverDir).filter((f) => f.endsWith('.ts'));
    sections.push(`### Server Modules (src/lib/server/)\n${modules.map((m) => `- ${m}`).join('\n')}`);
  } catch {}

  // List components
  try {
    const compDir = path.join(root, 'src/lib/components');
    const comps = fs.readdirSync(compDir).filter((f) => f.endsWith('.svelte'));
    sections.push(`### Components (src/lib/components/)\n${comps.map((c) => `- ${c}`).join('\n')}`);
  } catch {}

  return sections.join('\n\n');
}

function listFiles(dir: string, base: string): string[] {
  const results: string[] = [];
  try {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        results.push(...listFiles(full, base));
      } else {
        results.push(path.relative(base, full));
      }
    }
  } catch {}
  return results;
}

// Build system prompt with codebase context (cached per server lifecycle)
let cachedContext: string | null = null;

function getSystemPrompt(): string {
  if (!cachedContext) {
    cachedContext = getCodebaseContext();
  }
  return `You are an AI assistant embedded in the Home Server dashboard — a SvelteKit app built with Svelte 5 runes that manages files, smart lights (Wiz), processes, Tailscale VPN, backups (rsync), scheduled tasks, and a terminal.

You have access to the project's codebase context below. Use it to give specific, accurate answers about the code.

## Codebase Context

${cachedContext}

## Behavior
- Be concise (2-4 sentences for simple questions, more for complex ones)
- Reference specific files and line numbers when discussing code
- Use markdown for code snippets
- When asked to explain a feature, trace the data flow (page → API → server module)
- For debugging, suggest specific files to check and what to look for`;
}

export const POST: RequestHandler = async ({ request }) => {
  const ANTHROPIC_API_KEY = env.ANTHROPIC_API_KEY;
  if (!ANTHROPIC_API_KEY) {
    return json(
      {
        reply:
          'ANTHROPIC_API_KEY is not set.\n\nTo enable AI chat, run the server with:\n```\nANTHROPIC_API_KEY=sk-ant-... npm run dev\n```\nOr add it to a `.env` file in the project root.',
      },
      { status: 200 },
    );
  }

  try {
    const { messages, currentPage } = await request.json();

    let systemPrompt = getSystemPrompt();
    if (currentPage) {
      systemPrompt += `\n\nThe user is currently viewing: ${currentPage}`;
    }

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 2048,
        system: systemPrompt,
        messages: messages.slice(-20),
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      return json({ reply: `API error: ${res.status} — ${err}` }, { status: 200 });
    }

    const data = await res.json();
    const reply = data.content?.[0]?.text || 'No response';

    return json({ reply });
  } catch (e: any) {
    return json({ reply: `Error: ${e.message}` }, { status: 200 });
  }
};
