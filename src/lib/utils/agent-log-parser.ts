/**
 * Parses Claude CLI stream-json NDJSON output into structured events
 * for readable display in the Keeper agent log viewer.
 *
 * The raw log contains: marker lines (--- Agent started ---),
 * [stderr] lines, and JSON events (system, assistant, result, etc.)
 */

// --- Types ---

export type AgentEvent =
  | { kind: 'marker'; text: string }
  | { kind: 'stderr'; text: string }
  | { kind: 'thinking'; text: string }
  | { kind: 'text'; text: string }
  | { kind: 'tool_use'; name: string; input: string }
  | { kind: 'tool_result'; name: string; content: string; isError: boolean }
  | { kind: 'result'; duration: string; turns: number; cost: string; models: string[] }
  | { kind: 'system'; label: string }
  | { kind: 'unknown'; raw: string };

// --- Helpers ---

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rs = s % 60;
  return rs > 0 ? `${m}m ${rs}s` : `${m}m`;
}

function formatCost(usd: number): string {
  if (usd < 0.01) return `$${usd.toFixed(4)}`;
  return `$${usd.toFixed(2)}`;
}

function truncate(str: string, max: number): string {
  if (str.length <= max) return str;
  return str.slice(0, max) + '…';
}

// Track the last tool_use name so we can label tool_result events
let lastToolUseName = '';

function parseJsonEvent(obj: Record<string, unknown>): AgentEvent[] {
  const type = obj.type as string;
  const subtype = obj.subtype as string | undefined;

  // --- system events ---
  if (type === 'system') {
    // Skip noisy hook lifecycle and init events
    if (subtype === 'hook_started' || subtype === 'hook_response' || subtype === 'init') {
      return [];
    }
    const label = subtype || 'system';
    return [{ kind: 'system', label }];
  }

  // --- assistant message ---
  if (type === 'assistant') {
    const msg = obj.message as Record<string, unknown> | undefined;
    if (!msg) return [];
    const content = msg.content as Array<Record<string, unknown>> | undefined;
    if (!content || !Array.isArray(content)) return [];

    const events: AgentEvent[] = [];
    for (const block of content) {
      const blockType = block.type as string;
      if (blockType === 'thinking') {
        const thinking = block.thinking as string;
        if (thinking) events.push({ kind: 'thinking', text: thinking });
      } else if (blockType === 'text') {
        const text = block.text as string;
        if (text?.trim()) events.push({ kind: 'text', text });
      } else if (blockType === 'tool_use') {
        const name = block.name as string;
        const input = block.input as Record<string, unknown>;
        lastToolUseName = name;
        events.push({ kind: 'tool_use', name, input: formatToolInput(name, input) });
      } else if (blockType === 'tool_result') {
        const resultContent = block.content as string | Array<Record<string, unknown>>;
        const isError = (block.is_error as boolean) || false;
        let text = '';
        if (typeof resultContent === 'string') {
          text = resultContent;
        } else if (Array.isArray(resultContent)) {
          text = resultContent.map((c) => (c.text as string) || '').join('\n');
        }
        events.push({ kind: 'tool_result', name: lastToolUseName, content: text, isError });
      }
    }
    return events;
  }

  // --- result summary ---
  if (type === 'result') {
    const duration = formatDuration((obj.duration_ms as number) || 0);
    const turns = (obj.num_turns as number) || 0;
    const cost = formatCost((obj.total_cost_usd as number) || 0);
    const modelUsage = obj.modelUsage as Record<string, unknown> | undefined;
    const models = modelUsage ? Object.keys(modelUsage) : [];
    return [{ kind: 'result', duration, turns, cost, models }];
  }

  // Ignore other event types (rate_limit_event, etc.)
  return [];
}

function formatToolInput(name: string, input: Record<string, unknown>): string {
  // Show a concise summary based on tool type
  if (name === 'Read' || name === 'Write' || name === 'Edit') {
    return (input.file_path as string) || JSON.stringify(input);
  }
  if (name === 'Glob') {
    return (input.pattern as string) || JSON.stringify(input);
  }
  if (name === 'Grep') {
    const pat = input.pattern as string;
    const path = input.path as string;
    return path ? `/${pat}/ in ${path}` : `/${pat}/`;
  }
  if (name === 'Bash') {
    return (input.command as string) || JSON.stringify(input);
  }
  if (name === 'Agent') {
    const desc = input.description as string;
    const subtype = input.subagent_type as string;
    return subtype ? `[${subtype}] ${desc || ''}` : desc || JSON.stringify(input);
  }
  if (name === 'WebSearch') {
    return (input.query as string) || JSON.stringify(input);
  }
  if (name === 'WebFetch') {
    return (input.url as string) || JSON.stringify(input);
  }
  if (name === 'TodoWrite') {
    return 'updating tasks';
  }
  if (name === 'ToolSearch') {
    return (input.query as string) || JSON.stringify(input);
  }
  // Fallback: compact JSON
  try {
    const s = JSON.stringify(input);
    return truncate(s, 200);
  } catch {
    return '(...)';
  }
}

// --- Main parser ---

export function parseAgentLog(raw: string): AgentEvent[] {
  const lines = raw.split('\n');
  const events: AgentEvent[] = [];
  lastToolUseName = '';

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Marker lines: --- Agent started at ... ---
    if (trimmed.startsWith('---') && trimmed.endsWith('---')) {
      events.push({ kind: 'marker', text: trimmed });
      continue;
    }

    // Stderr lines
    if (trimmed.startsWith('[stderr]')) {
      const text = trimmed.slice('[stderr]'.length).trim();
      // Skip common noise
      if (text.startsWith('Warning: no stdin data')) continue;
      if (text) events.push({ kind: 'stderr', text });
      continue;
    }

    // [error] lines
    if (trimmed.startsWith('[error]')) {
      events.push({ kind: 'stderr', text: trimmed.slice('[error]'.length).trim() });
      continue;
    }

    // Try parsing as JSON
    if (trimmed.startsWith('{')) {
      try {
        const obj = JSON.parse(trimmed);
        const parsed = parseJsonEvent(obj);
        events.push(...parsed);
        continue;
      } catch {
        // Not valid JSON, treat as unknown
      }
    }

    // Anything else — show as unknown (non-empty non-json text)
    events.push({ kind: 'unknown', raw: trimmed });
  }

  return events;
}
