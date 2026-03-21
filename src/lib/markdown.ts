/**
 * Lightweight regex-based Markdown → HTML renderer.
 * Covers: headings, bold, italic, code blocks, inline code, links, lists,
 * blockquotes, horizontal rules, and paragraphs.
 *
 * Ported from Versable scripts/ui.
 */

export function renderMarkdown(md: string): string {
	let text = md.replace(/\r\n/g, '\n');

	// Extract code blocks before escaping
	const codeBlocks: string[] = [];
	text = text.replace(/```(\w*)\n([\s\S]*?)```/g, (_match, lang, code) => {
		const idx = codeBlocks.length;
		codeBlocks.push(
			`<pre class="md-code-block"><code class="language-${lang || 'text'}">${escapeHtml(code.trimEnd())}</code></pre>`
		);
		return `\x00CB${idx}\x00`;
	});

	// Extract inline code before escaping
	const inlineCodes: string[] = [];
	text = text.replace(/`([^`\n]+)`/g, (_match, code) => {
		const idx = inlineCodes.length;
		inlineCodes.push(`<code class="md-inline-code">${escapeHtml(code)}</code>`);
		return `\x00IC${idx}\x00`;
	});

	text = escapeHtml(text);

	// Restore placeholders
	text = text.replace(/\x00CB(\d+)\x00/g, (_m, i) => codeBlocks[parseInt(i)]);
	text = text.replace(/\x00IC(\d+)\x00/g, (_m, i) => inlineCodes[parseInt(i)]);

	const lines = text.split('\n');
	const output: string[] = [];
	let inList = false;
	let listType = '';
	let inBlockquote = false;
	let i = 0;

	while (i < lines.length) {
		const line = lines[i];

		if (/^---+$/.test(line.trim()) || /^\*\*\*+$/.test(line.trim())) {
			closeList(); closeBlockquote();
			output.push('<hr class="md-hr" />');
			i++; continue;
		}

		const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
		if (headingMatch) {
			closeList(); closeBlockquote();
			const level = headingMatch[1].length;
			output.push(`<h${level} class="md-h${level}">${inline(headingMatch[2])}</h${level}>`);
			i++; continue;
		}

		if (line.startsWith('&gt; ') || line === '&gt;') {
			closeList();
			if (!inBlockquote) { output.push('<blockquote class="md-blockquote">'); inBlockquote = true; }
			output.push(`<p>${inline(line.replace(/^&gt;\s?/, ''))}</p>`);
			i++; continue;
		} else if (inBlockquote) { closeBlockquote(); }

		if (/^\s*[-*+]\s+/.test(line)) {
			if (!inList) { output.push('<ul class="md-ul">'); inList = true; listType = 'ul'; }
			output.push(`<li>${inline(line.replace(/^\s*[-*+]\s+/, ''))}</li>`);
			i++; continue;
		}

		if (/^\s*\d+\.\s+/.test(line)) {
			if (!inList) { output.push('<ol class="md-ol">'); inList = true; listType = 'ol'; }
			output.push(`<li>${inline(line.replace(/^\s*\d+\.\s+/, ''))}</li>`);
			i++; continue;
		}

		if (inList) closeList();

		if (line.includes('<pre class="md-code-block">')) { output.push(line); i++; continue; }
		if (line.trim() === '') { i++; continue; }

		const paraLines: string[] = [line];
		while (
			i + 1 < lines.length &&
			lines[i + 1].trim() !== '' &&
			!lines[i + 1].match(/^#{1,6}\s/) &&
			!lines[i + 1].match(/^\s*[-*+]\s/) &&
			!lines[i + 1].match(/^\s*\d+\.\s/) &&
			!lines[i + 1].startsWith('&gt;') &&
			!/^---+$/.test(lines[i + 1].trim()) &&
			!lines[i + 1].includes('<pre class="md-code-block">')
		) { i++; paraLines.push(lines[i]); }
		output.push(`<p class="md-p">${inline(paraLines.join('<br />'))}</p>`);
		i++;
	}

	closeList(); closeBlockquote();
	return output.join('\n');

	function closeList() {
		if (inList) { output.push(`</${listType}>`); inList = false; }
	}
	function closeBlockquote() {
		if (inBlockquote) { output.push('</blockquote>'); inBlockquote = false; }
	}
}

function inline(text: string): string {
	text = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
	text = text.replace(/__(.+?)__/g, '<strong>$1</strong>');
	text = text.replace(/\*(.+?)\*/g, '<em>$1</em>');
	text = text.replace(/(?<!\w)_(.+?)_(?!\w)/g, '<em>$1</em>');
	text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="md-link" target="_blank" rel="noopener">$1</a>');
	return text;
}

function escapeHtml(text: string): string {
	return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
