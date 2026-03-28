/**
 * Mini filter query language for productivity items.
 *
 * Syntax examples:
 *   p1                        → priority P1 cards
 *   overdue                   → cards past their due date
 *   today                     → cards due today
 *   #work                     → cards tagged "work"
 *   tag:design                → cards tagged "design"
 *   todo                      → cards in "todo" column
 *   p1 & overdue              → P1 AND overdue
 *   #work | today             → tagged work OR due today
 *   p1 & #work | overdue      → (p1 AND #work) OR overdue
 *   "api refactor"            → title/description contains phrase
 *
 * Operator precedence: & (AND) binds tighter than | (OR).
 * Adjacent terms with no operator are treated as implicit AND.
 */

// ── Tokens ────────────────────────────────────────────────────────────────

type TokenType = 'priority' | 'date' | 'tag' | 'column' | 'text' | 'and' | 'or' | 'lparen' | 'rparen' | 'eof';

interface Token {
  type: TokenType;
  value: string;
}

const DATE_KEYWORDS = new Set(['overdue', 'today', 'tomorrow', 'thisweek']);
const COLUMN_KEYWORDS = new Set(['todo', 'doing', 'done', 'archive']);
const PRIORITY_RE = /^p[123]$/i;

function tokenize(query: string): Token[] {
  const tokens: Token[] = [];
  // Split on whitespace while keeping quoted strings together
  const parts = query.match(/"[^"]*"|'[^']*'|[^\s]+/g) ?? [];

  for (const raw of parts) {
    const s = raw.toLowerCase();

    if (s === '&' || s === 'and') {
      tokens.push({ type: 'and', value: '&' });
    } else if (s === '|' || s === 'or') {
      tokens.push({ type: 'or', value: '|' });
    } else if (s === '(') {
      tokens.push({ type: 'lparen', value: '(' });
    } else if (s === ')') {
      tokens.push({ type: 'rparen', value: ')' });
    } else if (PRIORITY_RE.test(s)) {
      tokens.push({ type: 'priority', value: s.toUpperCase() });
    } else if (DATE_KEYWORDS.has(s)) {
      tokens.push({ type: 'date', value: s });
    } else if (COLUMN_KEYWORDS.has(s)) {
      tokens.push({ type: 'column', value: s });
    } else if (s.startsWith('#') && s.length > 1) {
      tokens.push({ type: 'tag', value: s.slice(1) });
    } else if (s.startsWith('tag:') && s.length > 4) {
      tokens.push({ type: 'tag', value: s.slice(4) });
    } else if (s.startsWith('"') || s.startsWith("'")) {
      // Quoted phrase — strip quotes, match as text
      tokens.push({ type: 'text', value: raw.slice(1, -1) });
    } else {
      tokens.push({ type: 'text', value: raw });
    }
  }

  tokens.push({ type: 'eof', value: '' });
  return tokens;
}

// ── AST ───────────────────────────────────────────────────────────────────

export type FilterNode =
  | { kind: 'and'; left: FilterNode; right: FilterNode }
  | { kind: 'or'; left: FilterNode; right: FilterNode }
  | { kind: 'priority'; value: string }
  | { kind: 'date'; value: string }
  | { kind: 'tag'; value: string }
  | { kind: 'column'; value: string }
  | { kind: 'text'; value: string };

// ── Parser ────────────────────────────────────────────────────────────────

class Parser {
  private pos = 0;
  constructor(private tokens: Token[]) {}

  peek(): Token {
    return this.tokens[this.pos];
  }

  consume(): Token {
    return this.tokens[this.pos++];
  }

  // expr = or_expr
  parseExpr(): FilterNode | null {
    return this.parseOr();
  }

  // or_expr = and_expr ( '|' and_expr )*
  parseOr(): FilterNode | null {
    let left = this.parseAnd();
    while (this.peek().type === 'or') {
      this.consume();
      const right = this.parseAnd();
      if (!right) break;
      left = left ? { kind: 'or', left, right } : right;
    }
    return left;
  }

  // and_expr = primary ( '&'? primary )*  (implicit AND for adjacent terms)
  parseAnd(): FilterNode | null {
    let left = this.parsePrimary();
    while (true) {
      const next = this.peek();
      if (next.type === 'eof' || next.type === 'or' || next.type === 'rparen') break;
      if (next.type === 'and') this.consume();
      const right = this.parsePrimary();
      if (!right) break;
      left = left ? { kind: 'and', left, right } : right;
    }
    return left;
  }

  // primary = '(' expr ')' | term
  parsePrimary(): FilterNode | null {
    const t = this.peek();
    if (t.type === 'lparen') {
      this.consume();
      const inner = this.parseExpr();
      if (this.peek().type === 'rparen') this.consume();
      return inner;
    }
    if (t.type === 'eof' || t.type === 'rparen' || t.type === 'and' || t.type === 'or') {
      return null;
    }
    this.consume();
    if (t.type === 'priority') return { kind: 'priority', value: t.value };
    if (t.type === 'date') return { kind: 'date', value: t.value };
    if (t.type === 'tag') return { kind: 'tag', value: t.value };
    if (t.type === 'column') return { kind: 'column', value: t.value };
    return { kind: 'text', value: t.value };
  }
}

// ── Public API ─────────────────────────────────────────────────────────────

export function parseFilterQuery(query: string): FilterNode | null {
  const trimmed = query.trim();
  if (!trimmed) return null;
  const tokens = tokenize(trimmed);
  if (tokens.length <= 1) return null; // only EOF
  return new Parser(tokens).parseExpr();
}

export interface FilterableItem {
  title: string;
  description?: string;
  priority?: string;
  dueDate?: string | null;
  column?: string;
  tags?: string[];
}

function evalNode(node: FilterNode, item: FilterableItem): boolean {
  switch (node.kind) {
    case 'and':
      return evalNode(node.left, item) && evalNode(node.right, item);
    case 'or':
      return evalNode(node.left, item) || evalNode(node.right, item);
    case 'priority':
      return (item.priority ?? '').toUpperCase() === node.value;
    case 'date': {
      if (!item.dueDate) return false;
      const due = new Date(item.dueDate);
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      if (node.value === 'overdue') return due < today;
      if (node.value === 'today') {
        const dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate());
        return dueDay.getTime() === today.getTime();
      }
      if (node.value === 'tomorrow') {
        const tmr = new Date(today);
        tmr.setDate(today.getDate() + 1);
        const dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate());
        return dueDay.getTime() === tmr.getTime();
      }
      if (node.value === 'thisweek') {
        const endOfWeek = new Date(today);
        endOfWeek.setDate(today.getDate() + 7);
        return due >= today && due < endOfWeek;
      }
      return false;
    }
    case 'tag':
      return (item.tags ?? []).some((t) => t.toLowerCase() === node.value.toLowerCase());
    case 'column':
      return (item.column ?? '') === node.value;
    case 'text': {
      const q = node.value.toLowerCase();
      return (item.title ?? '').toLowerCase().includes(q) || (item.description ?? '').toLowerCase().includes(q);
    }
  }
}

export function matchItem(node: FilterNode | null, item: FilterableItem): boolean {
  if (!node) return true;
  return evalNode(node, item);
}

/** Returns a human-readable description of a filter node (for UI preview). */
export function describeFilter(node: FilterNode): string {
  switch (node.kind) {
    case 'and':
      return `${describeFilter(node.left)} & ${describeFilter(node.right)}`;
    case 'or':
      return `${describeFilter(node.left)} | ${describeFilter(node.right)}`;
    case 'priority':
      return node.value;
    case 'date':
      return node.value;
    case 'tag':
      return `#${node.value}`;
    case 'column':
      return node.value;
    case 'text':
      return `"${node.value}"`;
  }
}
