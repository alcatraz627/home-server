/**
 * Lightweight markdown-to-HTML converter for agent output text.
 * Handles: links, bold, italic, inline code, code blocks, headers, lists, and horizontal rules.
 * All links open in a new tab. Output is HTML-escaped except for generated tags.
 */

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Convert inline markdown (bold, italic, code, links) within already-escaped HTML */
function inlineMarkdown(line: string): string {
  // Inline code (backticks) — must come before bold/italic to avoid conflicts
  line = line.replace(/`([^`]+)`/g, '<code class="smd-code">$1</code>');

  // Links: [text](url)
  line = line.replace(
    /\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener noreferrer" class="smd-link">$1</a>',
  );

  // Bare URLs that aren't already inside an href
  line = line.replace(
    /(?<![="'])(https?:\/\/[^\s<)]+)/g,
    '<a href="$1" target="_blank" rel="noopener noreferrer" class="smd-link">$1</a>',
  );

  // Bold: **text** or __text__
  line = line.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  line = line.replace(/__(.+?)__/g, '<strong>$1</strong>');

  // Italic: *text* or _text_ (but not inside words for _)
  line = line.replace(/(?<!\w)\*([^*]+)\*(?!\w)/g, '<em>$1</em>');
  line = line.replace(/(?<!\w)_([^_]+)_(?!\w)/g, '<em>$1</em>');

  // Strikethrough: ~~text~~
  line = line.replace(/~~(.+?)~~/g, '<del>$1</del>');

  return line;
}

export function renderMarkdown(text: string): string {
  const lines = text.split('\n');
  const out: string[] = [];
  let inCodeBlock = false;
  let codeBlockContent: string[] = [];
  let inList = false;
  let listType: 'ul' | 'ol' = 'ul';

  function closeList() {
    if (inList) {
      out.push(`</${listType}>`);
      inList = false;
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];

    // Code blocks (fenced)
    if (raw.trimStart().startsWith('```')) {
      if (inCodeBlock) {
        out.push(`<pre class="smd-pre"><code>${codeBlockContent.join('\n')}</code></pre>`);
        codeBlockContent = [];
        inCodeBlock = false;
      } else {
        closeList();
        inCodeBlock = true;
      }
      continue;
    }
    if (inCodeBlock) {
      codeBlockContent.push(escapeHtml(raw));
      continue;
    }

    const trimmed = raw.trim();

    // Empty line
    if (!trimmed) {
      closeList();
      continue;
    }

    // Horizontal rule
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      closeList();
      out.push('<hr class="smd-hr" />');
      continue;
    }

    // Headers
    const headerMatch = trimmed.match(/^(#{1,6})\s+(.+)$/);
    if (headerMatch) {
      closeList();
      const level = headerMatch[1].length;
      out.push(`<h${level} class="smd-h">${inlineMarkdown(escapeHtml(headerMatch[2]))}</h${level}>`);
      continue;
    }

    // Unordered list
    const ulMatch = trimmed.match(/^[-*+]\s+(.+)$/);
    if (ulMatch) {
      if (!inList || listType !== 'ul') {
        closeList();
        out.push('<ul class="smd-list">');
        inList = true;
        listType = 'ul';
      }
      out.push(`<li>${inlineMarkdown(escapeHtml(ulMatch[1]))}</li>`);
      continue;
    }

    // Ordered list
    const olMatch = trimmed.match(/^\d+[.)]\s+(.+)$/);
    if (olMatch) {
      if (!inList || listType !== 'ol') {
        closeList();
        out.push('<ol class="smd-list">');
        inList = true;
        listType = 'ol';
      }
      out.push(`<li>${inlineMarkdown(escapeHtml(olMatch[1]))}</li>`);
      continue;
    }

    // Regular paragraph
    closeList();
    out.push(`<p class="smd-p">${inlineMarkdown(escapeHtml(trimmed))}</p>`);
  }

  // Close any open blocks
  if (inCodeBlock && codeBlockContent.length > 0) {
    out.push(`<pre class="smd-pre"><code>${codeBlockContent.join('\n')}</code></pre>`);
  }
  closeList();

  return out.join('\n');
}
