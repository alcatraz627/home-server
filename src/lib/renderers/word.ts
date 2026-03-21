import type { DocumentRenderer, RenderResult } from './index';
import mammoth from 'mammoth';

export const wordRenderer: DocumentRenderer = {
  name: 'word',

  canRender(mime: string, filename: string): boolean {
    const ext = extOf(filename);
    return (
      ['.docx'].includes(ext) || mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    );
  },

  async render(data: ArrayBuffer): Promise<RenderResult> {
    const result = await mammoth.convertToHtml({ arrayBuffer: data });
    const html = `<div class="word-doc">${result.value}</div>`;
    return { type: 'html', content: html };
  },
};

function extOf(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot >= 0 ? name.slice(dot).toLowerCase() : '';
}
