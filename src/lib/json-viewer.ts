/**
 * Renders a JSON value as an interactive HTML tree with collapsible nodes
 * and syntax-highlighted values.
 */

export function renderJsonTree(data: unknown, rootKey = ''): string {
  return renderNode(data, rootKey, 0, true);
}

function renderNode(value: unknown, key: string, depth: number, isLast: boolean): string {
  const comma = isLast ? '' : '<span class="jv-comma">,</span>';
  const keyHtml = key ? `<span class="jv-key">"${escapeHtml(key)}"</span><span class="jv-colon">: </span>` : '';
  const indent = '  '.repeat(depth);

  if (value === null) return `${indent}${keyHtml}<span class="jv-null">null</span>${comma}\n`;
  if (typeof value === 'boolean') return `${indent}${keyHtml}<span class="jv-bool">${value}</span>${comma}\n`;
  if (typeof value === 'number') return `${indent}${keyHtml}<span class="jv-number">${value}</span>${comma}\n`;
  if (typeof value === 'string')
    return `${indent}${keyHtml}<span class="jv-string">"${escapeHtml(value)}"</span>${comma}\n`;

  if (Array.isArray(value)) {
    if (value.length === 0) return `${indent}${keyHtml}<span class="jv-bracket">[]</span>${comma}\n`;
    const id = `jv-${depth}-${key}-${Math.random().toString(36).slice(2, 6)}`;
    let html = `${indent}${keyHtml}<input type="checkbox" id="${id}" class="jv-toggle" checked /><label for="${id}" class="jv-bracket jv-collapsible">[</label><span class="jv-count">${value.length} items</span>\n`;
    html += `<span class="jv-content">`;
    value.forEach((item, i) => {
      html += renderNode(item, '', depth + 1, i === value.length - 1);
    });
    html += `${indent}<span class="jv-bracket">]</span></span>${comma}\n`;
    return html;
  }

  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) return `${indent}${keyHtml}<span class="jv-bracket">{}</span>${comma}\n`;
    const id = `jv-${depth}-${key}-${Math.random().toString(36).slice(2, 6)}`;
    let html = `${indent}${keyHtml}<input type="checkbox" id="${id}" class="jv-toggle" checked /><label for="${id}" class="jv-bracket jv-collapsible">{</label><span class="jv-count">${entries.length} keys</span>\n`;
    html += `<span class="jv-content">`;
    entries.forEach(([k, v], i) => {
      html += renderNode(v, k, depth + 1, i === entries.length - 1);
    });
    html += `${indent}<span class="jv-bracket">}</span></span>${comma}\n`;
    return html;
  }

  return `${indent}${keyHtml}<span class="jv-string">${escapeHtml(String(value))}</span>${comma}\n`;
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
