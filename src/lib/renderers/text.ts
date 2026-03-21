import type { DocumentRenderer, RenderResult } from './index';

export const textRenderer: DocumentRenderer = {
	name: 'text',

	canRender(mime: string): boolean {
		return mime.startsWith('text/');
	},

	async render(data: ArrayBuffer): Promise<RenderResult> {
		const text = new TextDecoder().decode(data);
		return { type: 'text', content: text };
	}
};
