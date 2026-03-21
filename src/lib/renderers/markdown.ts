import type { DocumentRenderer, RenderResult } from './index';
import { renderMarkdown } from '$lib/markdown';

export const markdownRenderer: DocumentRenderer = {
	name: 'markdown',

	canRender(mime: string, filename: string): boolean {
		return mime === 'text/markdown' || extOf(filename) === '.md';
	},

	async render(data: ArrayBuffer): Promise<RenderResult> {
		const text = new TextDecoder().decode(data);
		const html = `<div class="md-content">${renderMarkdown(text)}</div>`;
		return { type: 'html', content: html };
	}
};

function extOf(name: string): string {
	const dot = name.lastIndexOf('.');
	return dot >= 0 ? name.slice(dot).toLowerCase() : '';
}
