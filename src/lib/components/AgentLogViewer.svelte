<script lang="ts">
  import { parseAgentLog, type AgentEvent } from '$lib/utils/agent-log-parser';
  import { renderMarkdown } from '$lib/utils/simple-markdown';
  import Icon from './Icon.svelte';
  import Button from './Button.svelte';

  let { content = '', maxLines = 800 } = $props<{
    content: string;
    maxLines?: number;
  }>();

  let showRaw = $state(false);
  let expandedTools = $state<Set<number>>(new Set());
  let expandedThinking = $state<Set<number>>(new Set());

  // Parse once whenever content changes
  let events = $derived.by(() => {
    try {
      return parseAgentLog(content);
    } catch {
      // If parsing fails entirely, show raw
      return [] as AgentEvent[];
    }
  });

  let hasParsedContent = $derived(events.some((e) => e.kind !== 'marker' && e.kind !== 'system'));

  // For raw view: truncate to maxLines
  let rawDisplay = $derived.by(() => {
    const lines = content.split('\n');
    if (lines.length <= maxLines) return content;
    return lines.slice(-maxLines).join('\n');
  });

  let isRawTruncated = $derived(content.split('\n').length > maxLines);

  function toggleTool(idx: number) {
    const next = new Set(expandedTools);
    if (next.has(idx)) next.delete(idx);
    else next.add(idx);
    expandedTools = next;
  }

  function toggleThinking(idx: number) {
    const next = new Set(expandedThinking);
    if (next.has(idx)) next.delete(idx);
    else next.add(idx);
    expandedThinking = next;
  }

  function escapeHtml(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  // ANSI to HTML converter (reused from keeper page)
  function ansiToHtml(text: string): string {
    const ansiMap: Record<string, string> = {
      '30': '#4a4a4a',
      '31': '#e06c75',
      '32': '#98c379',
      '33': '#e5c07b',
      '34': '#61afef',
      '35': '#c678dd',
      '36': '#56b6c2',
      '37': '#abb2bf',
      '90': '#5c6370',
      '91': '#e06c75',
      '92': '#98c379',
      '93': '#e5c07b',
      '94': '#61afef',
      '95': '#c678dd',
      '96': '#56b6c2',
      '97': '#ffffff',
    };

    let html = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    html = html.replace(/\x1b\[(\d+(?:;\d+)*)m/g, (_, codes) => {
      const parts = codes.split(';');
      for (const code of parts) {
        if (code === '0' || code === '') return '</span>';
        if (ansiMap[code]) return `<span style="color:${ansiMap[code]}">`;
        if (code === '1') return '<span style="font-weight:bold">';
        if (code === '3') return '<span style="font-style:italic">';
        if (code === '4') return '<span style="text-decoration:underline">';
      }
      return '';
    });

    html = html.replace(/\x1b\[[^m]*m/g, '');
    return html;
  }

  // Icon name for tool types
  function toolIcon(name: string): string {
    if (name === 'Read' || name === 'Write' || name === 'Edit') return 'file';
    if (name === 'Bash') return 'terminal';
    if (name === 'Glob' || name === 'Grep') return 'search';
    if (name === 'Agent') return 'zap';
    if (name === 'WebSearch') return 'globe';
    if (name === 'WebFetch') return 'link';
    return 'code';
  }
</script>

<div class="alv-root">
  <div class="alv-toolbar">
    <span class="alv-count">
      {#if !showRaw}
        {events.filter((e) => e.kind === 'text' || e.kind === 'tool_use').length} steps
      {/if}
    </span>
    <Button size="xs" onclick={() => (showRaw = !showRaw)}>
      <Icon name={showRaw ? 'list' : 'code'} size={12} />
      {showRaw ? 'Parsed' : 'Raw'}
    </Button>
  </div>

  {#if showRaw || !hasParsedContent}
    <!-- Raw view -->
    {#if isRawTruncated}
      <p class="alv-truncated">Showing last {maxLines} lines</p>
    {/if}
    <div class="alv-raw">{@html ansiToHtml(rawDisplay)}</div>
  {:else}
    <!-- Parsed view -->
    <div class="alv-events">
      {#each events as event, idx}
        {#if event.kind === 'marker'}
          <div class="alv-marker">{event.text}</div>
        {:else if event.kind === 'text'}
          <div class="alv-text">{@html renderMarkdown(event.text)}</div>
        {:else if event.kind === 'thinking'}
          <button class="alv-thinking-toggle" onclick={() => toggleThinking(idx)}>
            <Icon name={expandedThinking.has(idx) ? 'chevron-down' : 'chevron-right'} size={11} />
            <span class="alv-thinking-label">Thinking</span>
            {#if !expandedThinking.has(idx)}
              <span class="alv-thinking-preview">{event.text.slice(0, 80)}…</span>
            {/if}
          </button>
          {#if expandedThinking.has(idx)}
            <div class="alv-thinking-body">{event.text}</div>
          {/if}
        {:else if event.kind === 'tool_use'}
          <button class="alv-tool" onclick={() => toggleTool(idx)}>
            <Icon name={toolIcon(event.name)} size={12} />
            <span class="alv-tool-name">{event.name}</span>
            <span class="alv-tool-input"
              >{event.input.length > 120 ? event.input.slice(0, 120) + '…' : event.input}</span
            >
            <Icon name={expandedTools.has(idx) ? 'chevron-down' : 'chevron-right'} size={11} />
          </button>
          {#if expandedTools.has(idx)}
            <div class="alv-tool-detail">{event.input}</div>
          {/if}
        {:else if event.kind === 'tool_result'}
          {#if event.isError}
            <div class="alv-tool-error">
              <Icon name="alert-circle" size={12} />
              <span>{event.content.length > 300 ? event.content.slice(0, 300) + '…' : event.content}</span>
            </div>
          {/if}
        {:else if event.kind === 'stderr'}
          <div class="alv-stderr">
            <Icon name="alert-triangle" size={12} />
            {event.text}
          </div>
        {:else if event.kind === 'result'}
          <div class="alv-result">
            <span class="alv-result-item"><Icon name="clock" size={12} /> {event.duration}</span>
            <span class="alv-result-item"><Icon name="activity" size={12} /> {event.turns} turns</span>
            <span class="alv-result-item"><Icon name="zap" size={12} /> {event.cost}</span>
            {#if event.models.length > 0}
              <span class="alv-result-item alv-result-models">{event.models.join(', ')}</span>
            {/if}
          </div>
        {:else if event.kind === 'unknown'}
          <div class="alv-unknown">{event.raw}</div>
        {/if}
      {/each}
    </div>
  {/if}
</div>

<style>
  .alv-root {
    border: 1px solid var(--border);
    border-radius: 6px;
    background: var(--code-bg);
    overflow: hidden;
  }

  .alv-toolbar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 6px 10px;
    border-bottom: 1px solid var(--border);
    background: var(--bg-secondary);
  }

  .alv-count {
    font-size: 0.65rem;
    color: var(--text-faint);
    font-family: 'JetBrains Mono', monospace;
  }

  .alv-truncated {
    font-size: 0.65rem;
    color: var(--text-faint);
    text-align: right;
    margin: 0;
    padding: 4px 10px;
    font-style: italic;
  }

  /* Raw view */
  .alv-raw {
    max-height: 400px;
    overflow-y: auto;
    padding: 12px;
    font-size: 0.72rem;
    font-family: 'JetBrains Mono', monospace;
    line-height: 1.5;
    color: var(--text-primary);
    white-space: pre-wrap;
    word-break: break-all;
  }

  /* Parsed view */
  .alv-events {
    max-height: 500px;
    overflow-y: auto;
    padding: 8px 0;
  }

  .alv-marker {
    text-align: center;
    font-size: 0.65rem;
    color: var(--text-faint);
    padding: 6px 12px;
    font-family: 'JetBrains Mono', monospace;
  }

  .alv-text {
    padding: 6px 12px;
    font-size: 0.78rem;
    line-height: 1.5;
    color: var(--text-primary);
    word-break: break-word;
  }

  /* Markdown styles inside text events */
  .alv-text :global(.smd-p) {
    margin: 2px 0;
  }
  .alv-text :global(.smd-h) {
    margin: 6px 0 2px;
    font-size: 0.85rem;
    color: var(--text-primary);
  }
  .alv-text :global(h1.smd-h) {
    font-size: 0.95rem;
  }
  .alv-text :global(.smd-link) {
    color: var(--accent);
    text-decoration: underline;
    text-underline-offset: 2px;
  }
  .alv-text :global(.smd-link:hover) {
    opacity: 0.8;
  }
  .alv-text :global(.smd-code) {
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.72rem;
    padding: 1px 4px;
    border-radius: 3px;
    background: var(--bg-secondary);
    color: var(--accent);
  }
  .alv-text :global(.smd-pre) {
    margin: 4px 0;
    padding: 8px 10px;
    border-radius: 4px;
    background: var(--bg-secondary);
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.7rem;
    line-height: 1.5;
    overflow-x: auto;
    white-space: pre-wrap;
    word-break: break-all;
  }
  .alv-text :global(.smd-list) {
    margin: 2px 0;
    padding-left: 20px;
  }
  .alv-text :global(.smd-list li) {
    margin: 1px 0;
  }
  .alv-text :global(.smd-hr) {
    border: none;
    border-top: 1px solid var(--border-subtle);
    margin: 6px 0;
  }

  /* Thinking */
  .alv-thinking-toggle {
    display: flex;
    align-items: center;
    gap: 4px;
    width: 100%;
    padding: 4px 12px;
    border: none;
    background: none;
    cursor: pointer;
    font-family: inherit;
    font-size: 0.7rem;
    color: var(--text-faint);
    text-align: left;
  }
  .alv-thinking-toggle:hover {
    background: var(--bg-secondary);
  }
  .alv-thinking-label {
    font-style: italic;
    font-weight: 500;
    flex-shrink: 0;
  }
  .alv-thinking-preview {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    opacity: 0.6;
  }
  .alv-thinking-body {
    padding: 4px 12px 8px 28px;
    font-size: 0.7rem;
    color: var(--text-muted);
    line-height: 1.5;
    white-space: pre-wrap;
    word-break: break-word;
    font-style: italic;
  }

  /* Tool use */
  .alv-tool {
    display: flex;
    align-items: center;
    gap: 6px;
    width: 100%;
    padding: 4px 12px;
    border: none;
    background: none;
    cursor: pointer;
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.68rem;
    color: var(--text-secondary);
    text-align: left;
  }
  .alv-tool:hover {
    background: var(--bg-secondary);
  }
  .alv-tool-name {
    font-weight: 600;
    color: var(--accent);
    flex-shrink: 0;
  }
  .alv-tool-input {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    flex: 1;
    min-width: 0;
    opacity: 0.7;
  }
  .alv-tool-detail {
    padding: 4px 12px 6px 32px;
    font-size: 0.68rem;
    font-family: 'JetBrains Mono', monospace;
    color: var(--text-muted);
    white-space: pre-wrap;
    word-break: break-all;
  }

  /* Tool error */
  .alv-tool-error {
    display: flex;
    align-items: flex-start;
    gap: 6px;
    padding: 4px 12px 4px 32px;
    font-size: 0.68rem;
    color: var(--danger);
    font-family: 'JetBrains Mono', monospace;
  }

  /* Stderr */
  .alv-stderr {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 3px 12px;
    font-size: 0.65rem;
    color: var(--warning, #e5c07b);
    font-family: 'JetBrains Mono', monospace;
  }

  /* Result summary */
  .alv-result {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    padding: 8px 12px;
    margin: 4px 8px;
    border-radius: 4px;
    background: var(--bg-secondary);
    font-size: 0.7rem;
    font-family: 'JetBrains Mono', monospace;
  }
  .alv-result-item {
    display: flex;
    align-items: center;
    gap: 4px;
    color: var(--text-secondary);
  }
  .alv-result-models {
    color: var(--text-faint);
    font-size: 0.62rem;
  }

  /* Unknown / fallback */
  .alv-unknown {
    padding: 2px 12px;
    font-size: 0.68rem;
    color: var(--text-faint);
    font-family: 'JetBrains Mono', monospace;
    white-space: pre-wrap;
    word-break: break-all;
  }
</style>
