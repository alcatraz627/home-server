import type { DocumentRenderer, RenderResult } from './index';
import { renderJsonTree } from '$lib/json-viewer';

export const jsonRenderer: DocumentRenderer = {
  name: 'json',

  canRender(mime: string, filename: string): boolean {
    return mime === 'application/json' || extOf(filename) === '.json';
  },

  async render(data: ArrayBuffer): Promise<RenderResult> {
    const text = new TextDecoder().decode(data);
    try {
      const parsed = JSON.parse(text);
      const html = `<pre class="json-tree">${renderJsonTree(parsed)}</pre>`;
      return { type: 'html', content: html };
    } catch {
      return { type: 'text', content: text };
    }
  },
};

function extOf(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot >= 0 ? name.slice(dot).toLowerCase() : '';
}
