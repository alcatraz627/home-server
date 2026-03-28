import type { DocumentRenderer, RenderResult } from './index';
import ePub from 'epubjs';

export const epubRenderer: DocumentRenderer = {
  name: 'epub',

  canRender(_mime: string, filename: string): boolean {
    return filename.toLowerCase().endsWith('.epub');
  },

  async render(data: ArrayBuffer): Promise<RenderResult> {
    const book = ePub(data);
    await book.ready;

    const spine = book.spine as any;
    const sections: string[] = [];

    // Extract metadata for the header
    const meta = book.packaging?.metadata;
    if (meta?.title) {
      sections.push(`<h1 class="epub-title">${escapeHtml(meta.title)}</h1>`);
      if (meta.creator) {
        sections.push(`<p class="epub-author">by ${escapeHtml(meta.creator)}</p>`);
      }
    }

    // Iterate through spine items (chapters) and extract HTML content
    for (const item of spine.items) {
      if (!item.href) continue;
      try {
        const doc = await book.load(item.href);
        // doc is an XMLDocument — extract the body HTML
        if (doc && (doc as Document).body) {
          const bodyHtml = (doc as Document).body.innerHTML;
          sections.push(`<div class="epub-chapter">${bodyHtml}</div>`);
        }
      } catch {
        // Skip unloadable sections (images-only, etc.)
      }
    }

    book.destroy();

    if (sections.length === 0) {
      return { type: 'text', content: 'Could not extract text from this EPUB file.' };
    }

    const html = `<div class="epub-reader">${sections.join('<hr class="epub-separator" />')}</div>`;
    return { type: 'html', content: html };
  },
};

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
