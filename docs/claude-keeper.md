# Claude Keeper — Planning Document

## Vision

A web interface within Home Server for managing autonomous Claude Code agents running on the server. Users can submit feature requests, prioritize them, and launch Claude agents that work through the backlog — with full visibility into what the agent is doing.

Think of it as a lightweight project manager where the "developer" is an AI agent.

---

## Problem

Right now, running Claude Code requires:
1. Opening a terminal on the server machine
2. Manually launching `claude` with a prompt
3. Staying in the terminal to monitor progress
4. Manually switching between tasks

This is friction-heavy, especially from a phone or another device on the tailnet.

---

## Goals

1. **Remote agent control** — start/stop Claude agents from the browser (phone or laptop)
2. **Feature request backlog** — structured list of tasks with priorities, not just ad-hoc prompts
3. **Autonomous work sweeping** — agent can be set to auto-pick and work through pending tasks
4. **Visibility** — see what the agent is doing, what files it's changing, what decisions it's making

---

## Core Concepts

### Feature Request

A structured unit of work:

```typescript
interface FeatureRequest {
  id: string;
  title: string;
  goal: string;                    // What should be achieved
  scope: FeatureScope;             // How big is this
  details?: string;                // Optional context, constraints, references
  status: FeatureStatus;
  priority: number;                // Lower = higher priority
  createdAt: string;
  updatedAt: string;
  assignedAgentId?: string;        // Which agent is working on this
  completedAt?: string;
  result?: string;                 // Agent's summary of what was done
}

type FeatureScope =
  | 'bug-fix'        // Small fix, < 30 min
  | 'tweak'          // UI adjustment, config change
  | 'feature'        // New capability, 1-2 hours
  | 'enhancement'    // Improve existing feature
  | 'refactor'       // Code quality, no behavior change
  | 'research'       // Investigate, produce a doc, no code
  | 'epic';          // Large, may need multiple sessions

type FeatureStatus =
  | 'backlog'        // Not yet prioritized
  | 'ready'          // Scoped and ready to pick up
  | 'in-progress'    // Agent is working on it
  | 'review'         // Agent finished, needs user review
  | 'done'           // Accepted
  | 'rejected';      // Won't do
```

### Agent Session

A running instance of Claude Code:

```typescript
interface AgentSession {
  id: string;
  pid: number;                     // OS process ID
  status: 'idle' | 'working' | 'paused' | 'stopped';
  currentTaskId?: string;          // Feature request being worked on
  startedAt: string;
  lastActivityAt: string;
  outputLog: string[];             // Rolling buffer of agent output
  filesChanged: string[];          // Files modified in this session
  mode: 'manual' | 'sweep';       // Manual = one task, Sweep = auto-pick
}
```

---

## Architecture

```
┌──────────────────────────────────────────────┐
│  Browser (Claude Keeper Page)                │
│  ├─ Feature Request CRUD                     │
│  ├─ Agent Control Panel (start/stop/pause)   │
│  ├─ Live Activity Feed (WebSocket)           │
│  └─ Review Queue                             │
├──────────────────────────────────────────────┤
│  API Layer                                   │
│  ├─ /api/keeper/requests — CRUD              │
│  ├─ /api/keeper/agents — control             │
│  └─ /ws/keeper — live output stream          │
├──────────────────────────────────────────────┤
│  Server: keeper.ts                           │
│  ├─ Request store (JSON file)                │
│  ├─ Agent process manager (child_process)    │
│  └─ Sweep scheduler                          │
├──────────────────────────────────────────────┤
│  System: Claude Code CLI                     │
│  └─ claude --dangerously-skip-permissions    │
│     (or with appropriate permission config)  │
└──────────────────────────────────────────────┘
```

---

## User Flows

### Flow 1: Submit a Feature Request (from phone)

1. User opens `/keeper` on phone browser
2. Clicks "New Request"
3. Fills in:
   - **Title**: "Add dark mode to file preview modal"
   - **Goal**: "The file preview modal should respect the current theme"
   - **Scope**: selects `tweak` from button group
   - **Details**: (optional) "Make sure the PDF iframe has a dark background too"
4. Request appears in backlog with status `backlog`

### Flow 2: Start Agent in Sweep Mode

1. User clicks "Start Agent" → "Sweep Mode"
2. Agent launches as a background process
3. Agent reads the feature request list, picks the highest-priority `ready` item
4. Agent works on it — output streams to the Activity Feed
5. When done, agent marks the request as `review`
6. Agent picks the next `ready` item
7. User can pause/stop at any time

### Flow 3: Review Completed Work

1. User sees items in `review` status
2. Clicks to expand — sees:
   - Agent's summary of what was done
   - Files changed (with diff links)
   - The agent's commit (if any)
3. User clicks "Accept" → status becomes `done`
4. Or "Reject" with feedback → status becomes `ready` again (agent will retry)

---

## Key Design Decisions to Make

### 1. Agent Communication

**Option A: File-based protocol**
- Agent reads `~/.home-server/keeper-requests.json` for tasks
- Writes status updates to `~/.home-server/keeper-agent-status.json`
- Server polls these files for updates
- Pro: Simple, works with any Claude Code version
- Con: Polling latency, no streaming

**Option B: Claude Code programmatic API**
- Use Claude Code's MCP or SDK to launch and control agents
- Pro: Real-time control, structured output
- Con: API may change, tighter coupling

**Option C: PTY-based (like terminal widget)**
- Spawn Claude Code in a PTY, parse its output
- Intercept prompts, auto-respond to permission requests
- Pro: Works with current CLI, can see everything
- Con: Fragile parsing, hard to extract structured data

**Recommendation**: Start with **Option A** (file-based) for simplicity. The agent gets a `CLAUDE.md` instruction to read the request file and update status. Upgrade to Option B when Claude Code SDK stabilizes.

### 2. Permission Model

The agent needs to make changes autonomously. Options:
- `--dangerously-skip-permissions` — easiest but no guardrails
- Custom permission config that allows file edits in the project dir
- Agent runs in a git worktree so changes are isolated until reviewed

**Recommendation**: Git worktree isolation. Agent works in a worktree, creates a branch per feature request. User reviews via diff before merging.

### 3. Scope of Autonomy

How much should the agent decide on its own?
- **Conservative**: Agent only works on items explicitly marked `ready` by the user
- **Moderate**: Agent can auto-triage `backlog` → `ready` for small scopes (bug-fix, tweak)
- **Aggressive**: Agent sweeps everything, including epics

**Recommendation**: Start conservative. Only `ready` items get picked up. Add auto-triage as a toggle later.

### 4. Context Management

Each feature request may need different files as context. Options:
- Agent figures it out (reads the request, explores the codebase)
- User attaches file references to each request
- System auto-suggests files based on keywords in the request

**Recommendation**: Let the agent explore. It already knows how to use Glob/Grep/Read. The request's `details` field can include hints like "see src/routes/files/".

---

## Data Storage

All state in `~/.home-server/`:

| File | Contents |
|------|----------|
| `keeper-requests.json` | Feature request backlog |
| `keeper-sessions.json` | Agent session history |
| `keeper-config.json` | Sweep settings, auto-triage rules |

---

## Implementation Phases

### Phase 1: Feature Request CRUD (no agent)
- Page at `/keeper` with request list
- Create / edit / delete / reorder requests
- Scope selector as a button group
- Status workflow: backlog → ready → done
- No agent integration — purely a task tracker

### Phase 2: Manual Agent Launch
- "Start Agent" button spawns Claude Code with a specific request
- Agent works in a git worktree
- Output captured and displayed in Activity Feed
- Agent writes results back to the request

### Phase 3: Sweep Mode
- Agent auto-picks from `ready` queue
- Configurable: how many items per sweep, scope limits
- Pause/resume controls
- Notification on completion (ntfy.sh)

### Phase 4: Review Workflow
- Review queue with diffs
- Accept/reject with feedback
- Auto-merge accepted changes from worktree to main

---

## Open Questions

1. **How to handle agent errors?** — If the agent crashes mid-task, how to recover? Mark as `failed` with output log, allow retry?

2. **Concurrency** — Can multiple agents run on different requests? Or strictly one at a time? (Resource constraints suggest one at a time for a laptop.)

3. **Cost tracking** — Should we track token usage per request? Claude Code can log usage but it's not trivial to extract.

4. **Context window management** — For epics spanning multiple sessions, how to pass context between sessions? A checkpoint file per request?

5. **Security** — The agent has full shell access on the server. Is worktree isolation sufficient? Should there be a sandboxed execution environment?

---

## Dependencies

- Claude Code CLI installed on the server
- Git (for worktree isolation)
- Existing Home Server infrastructure (WebSocket for streaming, ntfy.sh for notifications)

---

## Related Work

- [Claude Code Agent SDK](https://docs.anthropic.com/en/docs/claude-code/sdk) — for programmatic agent control
- [Sweep AI](https://sweep.dev/) — similar concept (AI agent works through GitHub issues)
- GitHub Copilot Workspace — IDE-integrated AI task runner
