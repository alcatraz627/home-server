<script lang="ts">
  import type { PageData } from './$types';
  import type { FeatureRequest, FeatureScope, FeatureStatus } from '$lib/server/keeper';
  import EmptyState from '$lib/components/EmptyState.svelte';
  import Button from '$lib/components/Button.svelte';
  import Badge from '$lib/components/Badge.svelte';
  import SearchInput from '$lib/components/SearchInput.svelte';
  import { toast } from '$lib/toast';

  let { data } = $props<{ data: PageData }>();
  // svelte-ignore state_referenced_locally
  const { requests: initialRequests, stats: initialStats, runningAgents: initialRunning } = data;
  let requests = $state<FeatureRequest[]>(initialRequests);
  let stats = $state(initialStats);
  let runningAgents = $state<string[]>(initialRunning);

  // Claude CLI availability
  let claudeAvailable = $state<boolean | null>(null);
  let showHowItWorks = $state(false);

  import { onMount } from 'svelte';
  onMount(() => {
    // Fetch claude availability on load
    refresh();
  });

  // UI state
  let showForm = $state(false);
  let editingId = $state<string | null>(null);
  let filterStatus = $state<FeatureStatus | ''>('');
  let filterScope = $state<FeatureScope | ''>('');
  let search = $state('');
  let showCompleted = $state(false);

  // Form state
  let formTitle = $state('');
  let formGoal = $state('');
  let formScope = $state<FeatureScope>('feature');
  let formDetails = $state('');

  // Log viewer state
  let logContent = $state<Record<string, string>>({});
  let logOffsets = $state<Record<string, number>>({});
  let logPollers = $state<Record<string, ReturnType<typeof setInterval>>>({});
  let userMessage = $state('');

  // Agent start times for elapsed display
  let agentStartTimes = $state<Record<string, string>>({});
  let now = $state(Date.now());

  // Tick for elapsed time display
  $effect(() => {
    const hasRunning = runningAgents.length > 0;
    if (!hasRunning) return;
    const interval = setInterval(() => {
      now = Date.now();
    }, 1000);
    return () => clearInterval(interval);
  });

  const SCOPES: { value: FeatureScope; label: string; desc: string }[] = [
    { value: 'bug-fix', label: 'Bug Fix', desc: 'Small fix, < 30 min' },
    { value: 'tweak', label: 'Tweak', desc: 'UI adjustment, config change' },
    { value: 'feature', label: 'Feature', desc: 'New capability, 1-2 hours' },
    { value: 'enhancement', label: 'Enhancement', desc: 'Improve existing feature' },
    { value: 'refactor', label: 'Refactor', desc: 'Code quality, no behavior change' },
    { value: 'research', label: 'Research', desc: 'Investigate, produce a doc' },
    { value: 'epic', label: 'Epic', desc: 'Large, may need multiple sessions' },
  ];

  const STATUS_FLOW: { value: FeatureStatus; label: string; color: string }[] = [
    { value: 'draft', label: 'Draft', color: 'var(--text-faint)' },
    { value: 'ready', label: 'Ready', color: 'var(--accent)' },
    { value: 'running', label: 'Running', color: 'var(--success)' },
    { value: 'halted', label: 'Halted', color: 'var(--danger)' },
    { value: 'done', label: 'Done', color: 'var(--success)' },
  ];

  function statusColor(status: FeatureStatus): string {
    return STATUS_FLOW.find((s) => s.value === status)?.color || 'var(--text-muted)';
  }

  function scopeLabel(scope: FeatureScope): string {
    return SCOPES.find((s) => s.value === scope)?.label || scope;
  }

  let filtered = $derived.by(() => {
    let result = requests;
    if (!showCompleted) {
      result = result.filter((r) => r.status !== 'done');
    }
    if (filterStatus) result = result.filter((r) => r.status === filterStatus);
    if (filterScope) result = result.filter((r) => r.scope === filterScope);
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (r) =>
          r.title.toLowerCase().includes(q) || r.goal.toLowerCase().includes(q) || r.details.toLowerCase().includes(q),
      );
    }
    return result.sort((a, b) => a.priority - b.priority);
  });

  async function refresh() {
    try {
      const res = await fetch('/api/keeper');
      if (!res.ok) throw new Error('Failed to fetch keeper data');
      const result = await res.json();
      requests = result.requests;
      stats = result.stats;
      runningAgents = result.runningAgents;
      if (result.claudeAvailable !== undefined) {
        claudeAvailable = result.claudeAvailable;
      }
    } catch (e: any) {
      toast.error(e.message || 'Failed to refresh keeper', { key: 'keeper-refresh' });
    }
  }

  async function createRequest() {
    try {
      const res = await fetch('/api/keeper', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: formTitle, goal: formGoal, scope: formScope, details: formDetails }),
      });
      if (!res.ok) throw new Error('Failed to create request');
      clearForm();
      await refresh();
    } catch (e: any) {
      toast.error(e.message || 'Failed to create request');
    }
  }

  async function updateStatus(id: string, status: FeatureStatus) {
    try {
      const res = await fetch('/api/keeper', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status }),
      });
      if (!res.ok) throw new Error('Failed to update status');
      await refresh();
    } catch (e: any) {
      toast.error(e.message || 'Failed to update status');
    }
  }

  async function deleteReq(id: string) {
    try {
      const res = await fetch('/api/keeper', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) throw new Error('Failed to delete request');
      await refresh();
    } catch (e: any) {
      toast.error(e.message || 'Failed to delete request');
    }
  }

  function clearForm() {
    showForm = false;
    editingId = null;
    formTitle = '';
    formGoal = '';
    formScope = 'feature';
    formDetails = '';
  }

  function startEdit(r: FeatureRequest) {
    editingId = r.id;
    formTitle = r.title;
    formGoal = r.goal;
    formScope = r.scope;
    formDetails = r.details;
    showForm = true;
  }

  async function saveEdit() {
    if (!editingId) return;
    try {
      const res = await fetch('/api/keeper', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingId,
          title: formTitle,
          goal: formGoal,
          scope: formScope,
          details: formDetails,
        }),
      });
      if (!res.ok) throw new Error('Failed to save edit');
      clearForm();
      await refresh();
    } catch (e: any) {
      toast.error(e.message || 'Failed to save changes');
    }
  }

  function formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString();
  }

  function formatElapsed(startIso: string): string {
    const elapsed = now - new Date(startIso).getTime();
    const secs = Math.floor(elapsed / 1000);
    const mins = Math.floor(secs / 60);
    const hrs = Math.floor(mins / 60);
    if (hrs > 0) return `${hrs}h ${mins % 60}m`;
    if (mins > 0) return `${mins}m ${secs % 60}s`;
    return `${secs}s`;
  }

  // Expanded detail
  let expandedId = $state<string | null>(null);
  let editingResult = $state('');

  function toggleExpand(id: string) {
    if (expandedId === id) {
      expandedId = null;
      stopLogPolling(id);
    } else {
      expandedId = id;
      const req = requests.find((r) => r.id === id);
      editingResult = req?.result || '';
      // Start polling if running
      if (runningAgents.includes(id)) {
        startLogPolling(id);
      } else {
        // Fetch log once
        fetchLog(id);
      }
      // Fetch agent status for start time
      fetchAgentStatus(id);
    }
  }

  async function fetchAgentStatus(id: string) {
    try {
      const res = await fetch(`/api/keeper/${id}/agent`);
      if (!res.ok) throw new Error('Failed to fetch agent status');
      const data = await res.json();
      if (data.startedAt) {
        agentStartTimes[id] = data.startedAt;
      }
    } catch (e: any) {
      toast.error(e.message || 'Failed to fetch agent status');
    }
  }

  async function fetchLog(id: string) {
    try {
      const offset = logOffsets[id] || 0;
      const res = await fetch(`/api/keeper/${id}/log?offset=${offset}`);
      if (!res.ok) throw new Error('Failed to fetch log');
      const data = await res.json();
      if (data.content) {
        logContent[id] = (logContent[id] || '') + data.content;
        logOffsets[id] = data.size;
      }
    } catch (e: any) {
      toast.error(e.message || 'Failed to fetch log', { key: 'keeper-log' });
    }
  }

  function startLogPolling(id: string) {
    if (logPollers[id]) return;
    fetchLog(id);
    logPollers[id] = setInterval(() => fetchLog(id), 1000);
  }

  function stopLogPolling(id: string) {
    if (logPollers[id]) {
      clearInterval(logPollers[id]);
      delete logPollers[id];
    }
  }

  // Agent actions
  async function startAgentAction(id: string) {
    try {
      const res = await fetch(`/api/keeper/${id}/agent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'start' }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Failed to start agent');
        return;
      }
      toast.success('Agent started');
      await refresh();
      startLogPolling(id);
    } catch {
      toast.error('Failed to start agent');
    }
  }

  async function stopAgentAction(id: string) {
    try {
      const res = await fetch(`/api/keeper/${id}/agent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'stop' }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Failed to stop agent');
        return;
      }
      toast.success('Agent stopped');
      stopLogPolling(id);
      await refresh();
    } catch {
      toast.error('Failed to stop agent');
    }
  }

  async function resumeAgentAction(id: string) {
    try {
      const res = await fetch(`/api/keeper/${id}/agent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'resume' }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Failed to resume agent');
        return;
      }
      toast.success('Agent resumed');
      await refresh();
      startLogPolling(id);
    } catch {
      toast.error('Failed to resume agent');
    }
  }

  async function markDone(id: string) {
    if (runningAgents.includes(id)) {
      await stopAgentAction(id);
    }
    await updateStatus(id, 'done');
  }

  async function sendMessage(id: string) {
    if (!userMessage.trim()) return;
    try {
      const res = await fetch(`/api/keeper/${id}/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMessage }),
      });
      if (!res.ok) {
        toast.error('Failed to send message');
        return;
      }
      userMessage = '';
    } catch {
      toast.error('Failed to send message');
    }
  }

  async function saveResult(id: string) {
    try {
      const res = await fetch('/api/keeper', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, result: editingResult }),
      });
      if (!res.ok) throw new Error('Failed to save result');
      await refresh();
    } catch (e: any) {
      toast.error(e.message || 'Failed to save result');
    }
  }

  let copiedResult = $state<string | null>(null);
  async function copyResult(id: string, text: string) {
    await navigator.clipboard.writeText(text);
    copiedResult = id;
    setTimeout(() => {
      copiedResult = null;
    }, 2000);
  }

  // ANSI to HTML converter
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

    // Escape HTML first
    let html = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    // Replace ANSI codes with spans
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

    // Clean up any remaining escape sequences
    html = html.replace(/\x1b\[[^m]*m/g, '');

    return html;
  }

  // Cleanup pollers on unmount
  $effect(() => {
    return () => {
      for (const id of Object.keys(logPollers)) {
        clearInterval(logPollers[id]);
      }
    };
  });
</script>

<svelte:head>
  <title>Keeper | Home Server</title>
</svelte:head>

<div class="header">
  <h2 class="page-title">Claude Keeper</h2>
  <div class="controls">
    <label class="toggle-completed">
      <input type="checkbox" bind:checked={showCompleted} />
      <span>Show completed</span>
    </label>
    <Button onclick={refresh}>Refresh</Button>
    <Button
      variant="accent"
      onclick={() => {
        showForm = !showForm;
        if (!showForm) clearForm();
      }}
    >
      {showForm ? 'Cancel' : '+ New Request'}
    </Button>
  </div>
</div>
<p class="page-desc">Queue and track Claude AI agent requests. Monitor progress from backlog through completion.</p>

<!-- Stats bar -->
<div class="stats-bar">
  {#each STATUS_FLOW as s}
    <button
      class="stat-chip"
      class:active={filterStatus === s.value}
      style="--chip-color: {s.color}"
      onclick={() => (filterStatus = filterStatus === s.value ? '' : s.value)}
    >
      <span
        class="stat-dot"
        class:running-dot={s.value === 'running' && (stats.running || 0) > 0}
        style="background: {s.color}"
      ></span>
      {s.label}
      <span class="stat-count">{stats[s.value] || 0}</span>
    </button>
  {/each}
</div>

<!-- How it works / Status section -->
{#if requests.length === 0 || showHowItWorks}
  <div class="info-card">
    <div class="info-header">
      <h3>How it works</h3>
      {#if requests.length > 0}
        <Button size="sm" onclick={() => (showHowItWorks = false)}>Dismiss</Button>
      {/if}
    </div>

    <div class="cli-status">
      {#if claudeAvailable === null}
        <span class="status-badge-cli status-checking">Claude CLI: Checking...</span>
      {:else if claudeAvailable}
        <span class="status-badge-cli status-available">Claude CLI: Available</span>
      {:else}
        <span class="status-badge-cli status-missing">Claude CLI: Not found</span>
        <p class="install-hint">
          Install the Claude CLI to enable autonomous agents:
          <code>npm install -g @anthropic-ai/claude-cli</code>
        </p>
      {/if}
    </div>

    <p class="info-desc">
      The Keeper agent uses Claude CLI to autonomously work on feature requests. It can read/write files, run commands,
      and report progress.
    </p>

    <div class="info-limits">
      <span class="info-limit-item">One agent can run at a time</span>
      <span class="info-limit-sep">|</span>
      <span class="info-limit-item">Logs are stored in <code>~/.home-server/keeper-logs/</code></span>
    </div>
  </div>
{:else if claudeAvailable !== null}
  <button class="how-it-works-btn" onclick={() => (showHowItWorks = true)}>
    {claudeAvailable ? 'CLI Ready' : 'CLI Missing'} &mdash; How it works
  </button>
{/if}

<!-- Search + scope filter -->
{#if requests.length > 0}
  <div class="filter-bar">
    <SearchInput bind:value={search} placeholder="Search requests..." clearable />
    <select class="scope-filter" bind:value={filterScope}>
      <option value="">All scopes</option>
      {#each SCOPES as s}
        <option value={s.value}>{s.label}</option>
      {/each}
    </select>
  </div>
{/if}

<!-- Create / Edit form -->
{#if showForm}
  <div class="form-card">
    <h3>{editingId ? 'Edit Request' : 'New Feature Request'}</h3>

    <div class="form-grid">
      <label>
        <span>Title</span>
        <input type="text" bind:value={formTitle} placeholder="Short description of what you want" />
      </label>

      <label>
        <span>Goal</span>
        <textarea bind:value={formGoal} rows="2" placeholder="What should be achieved? What's the end state?"
        ></textarea>
      </label>

      <div class="scope-section">
        <span class="form-label">Scope</span>
        <div class="scope-grid">
          {#each SCOPES as s}
            <button class="scope-btn" class:active={formScope === s.value} onclick={() => (formScope = s.value)}>
              <strong>{s.label}</strong>
              <span>{s.desc}</span>
            </button>
          {/each}
        </div>
      </div>

      <label>
        <span>Details (optional)</span>
        <textarea
          bind:value={formDetails}
          rows="3"
          placeholder="Constraints, references, file paths, technical notes..."
        ></textarea>
      </label>
    </div>

    <div class="form-actions">
      {#if editingId}
        <Button variant="primary" onclick={saveEdit} disabled={!formTitle || !formGoal}>Save Changes</Button>
      {:else}
        <Button variant="primary" onclick={createRequest} disabled={!formTitle || !formGoal}>Create Request</Button>
      {/if}
      <Button onclick={clearForm}>Cancel</Button>
    </div>
  </div>
{/if}

<!-- Request list -->
{#if filtered.length === 0 && !showForm}
  {#if requests.length === 0}
    <EmptyState
      icon="◈"
      title="No feature requests"
      hint="Track features, bugs, and enhancements with status workflow"
      actionLabel="+ New Request"
      onaction={() => {
        showForm = true;
      }}
    />
  {:else}
    <p class="empty">No requests match your filters.</p>
  {/if}
{:else}
  <div class="request-list">
    {#each filtered as req}
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div
        class="request-card"
        class:is-done={req.status === 'done'}
        class:is-halted={req.status === 'halted'}
        class:is-running={req.status === 'running' || runningAgents.includes(req.id)}
        class:expanded={expandedId === req.id}
        onclick={() => toggleExpand(req.id)}
      >
        <div class="request-top">
          <div class="request-info">
            <div class="request-title-row">
              <span
                class="request-status-dot"
                class:status-running={req.status === 'running' || runningAgents.includes(req.id)}
                class:status-done-solid={req.status === 'done'}
                style="background: {statusColor(req.status)}"
              ></span>
              <span class="expand-indicator">{expandedId === req.id ? '▼' : '▸'}</span>
              <h3>{req.title}</h3>
              <span class="scope-badge">{scopeLabel(req.scope)}</span>
              <Badge
                variant={req.status === 'draft'
                  ? 'default'
                  : req.status === 'ready'
                    ? 'accent'
                    : req.status === 'running'
                      ? 'success'
                      : req.status === 'halted'
                        ? 'danger'
                        : 'success'}
                dot={req.status === 'running'}
                pulse={req.status === 'running'}>{STATUS_FLOW.find((s) => s.value === req.status)?.label}</Badge
              >
              {#if (req.status === 'running' || runningAgents.includes(req.id)) && agentStartTimes[req.id]}
                <span class="elapsed-badge">{formatElapsed(agentStartTimes[req.id])}</span>
              {/if}
            </div>
            <p class="request-goal">{req.goal}</p>
            <div class="request-meta">
              <span>Created {formatDate(req.createdAt)}</span>
              {#if req.completedAt}<span>Completed {formatDate(req.completedAt)}</span>{/if}
              {#if req.result}<span class="has-result">Has output</span>{/if}
            </div>
          </div>
          <div class="request-actions" onclick={(e) => e.stopPropagation()}>
            {#if req.status === 'draft'}
              <Button size="sm" onclick={() => updateStatus(req.id, 'ready')}>Mark Ready</Button>
            {:else if req.status === 'ready'}
              <Button size="sm" variant="accent" onclick={() => startAgentAction(req.id)}>Run Agent</Button>
            {:else if req.status === 'running' || runningAgents.includes(req.id)}
              <Button size="sm" variant="danger" onclick={() => stopAgentAction(req.id)}>Stop</Button>
              <Button size="sm" onclick={() => markDone(req.id)}>Mark Done</Button>
            {:else if req.status === 'halted'}
              <Button size="sm" variant="accent" onclick={() => resumeAgentAction(req.id)}>Resume</Button>
              <Button size="sm" onclick={() => markDone(req.id)}>Mark Done</Button>
            {/if}
            {#if req.status !== 'running' && !runningAgents.includes(req.id)}
              <Button size="sm" onclick={() => startEdit(req)}>Edit</Button>
              <Button size="sm" variant="danger" confirm confirmText="Sure?" onclick={() => deleteReq(req.id)}>✕</Button
              >
            {/if}
          </div>
        </div>

        {#if expandedId === req.id}
          <div class="request-detail" onclick={(e) => e.stopPropagation()}>
            {#if req.details}
              <div class="detail-section">
                <span class="detail-label">Details</span>
                <p class="detail-text">{req.details}</p>
              </div>
            {/if}

            <!-- Log viewer -->
            {#if logContent[req.id]}
              <div class="detail-section">
                <div class="detail-header">
                  <span class="detail-label">Agent Log</span>
                  <div class="detail-actions">
                    <Button size="xs" onclick={() => copyResult(req.id, logContent[req.id] || '')}>
                      {copiedResult === req.id ? 'Copied!' : 'Copy Log'}
                    </Button>
                  </div>
                </div>
                <div class="log-viewer">{@html ansiToHtml(logContent[req.id])}</div>
              </div>
            {/if}

            <!-- Chat input for running agents -->
            {#if runningAgents.includes(req.id)}
              <div class="chat-input-row">
                <input
                  type="text"
                  class="chat-input"
                  placeholder="Send message to agent..."
                  bind:value={userMessage}
                  onkeydown={(e) => {
                    if (e.key === 'Enter') sendMessage(req.id);
                  }}
                />
                <Button size="sm" variant="primary" onclick={() => sendMessage(req.id)}>Send</Button>
              </div>
            {/if}

            <div class="detail-section">
              <div class="detail-header">
                <span class="detail-label">Output / Notes</span>
                <div class="detail-actions">
                  {#if editingResult}
                    <Button size="xs" onclick={() => copyResult(req.id, editingResult)}>
                      {copiedResult === req.id ? 'Copied!' : 'Copy'}
                    </Button>
                  {/if}
                  <Button size="xs" variant="primary" onclick={() => saveResult(req.id)}>Save</Button>
                </div>
              </div>
              <textarea
                class="result-editor"
                bind:value={editingResult}
                rows="6"
                placeholder="Paste agent output, notes, or results here..."
              ></textarea>
            </div>

            <div class="detail-info">
              <span>ID: {req.id}</span>
              <span>Priority: {req.priority}</span>
              <span>Updated: {formatDate(req.updatedAt)}</span>
            </div>
          </div>
        {/if}
      </div>
    {/each}
  </div>
{/if}

<style>
  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 16px;
  }
  h2 {
    font-size: 1.3rem;
  }
  .controls {
    display: flex;
    gap: 8px;
    align-items: center;
  }
  .toggle-completed {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 0.75rem;
    color: var(--text-muted);
    cursor: pointer;
  }
  .toggle-completed input {
    cursor: pointer;
  }
  @keyframes pulse-glow {
    0%,
    100% {
      box-shadow: 0 0 4px var(--success);
      opacity: 1;
    }
    50% {
      box-shadow:
        0 0 8px var(--success),
        0 0 16px var(--success);
      opacity: 0.7;
    }
  }

  /* Stats bar */
  .stats-bar {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-bottom: 14px;
  }
  .stat-chip {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 5px 12px;
    font-size: 0.75rem;
    border-radius: 16px;
    border: 1px solid var(--border);
    background: var(--bg-secondary);
    color: var(--text-muted);
    cursor: pointer;
    font-family: inherit;
    transition: all 0.15s;
  }
  .stat-chip:hover {
    border-color: var(--chip-color);
  }
  .stat-chip.active {
    border-color: var(--chip-color);
    background: color-mix(in srgb, var(--chip-color) 10%, transparent);
    color: var(--chip-color);
  }
  .stat-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
  }
  .stat-dot.running-dot {
    animation: pulse-glow 1.5s ease-in-out infinite;
  }
  .stat-count {
    font-weight: 600;
    font-family: 'JetBrains Mono', monospace;
  }

  /* Filter bar */
  .filter-bar {
    display: flex;
    gap: 8px;
    margin-bottom: 14px;
  }
  .scope-filter {
    padding: 7px 12px;
    font-size: 0.8rem;
    border-radius: 6px;
    border: 1px solid var(--border);
    background: var(--btn-bg);
    color: var(--text-primary);
    font-family: inherit;
  }

  /* Form */
  .form-card {
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 20px;
    margin-bottom: 16px;
  }
  .form-card h3 {
    font-size: 1rem;
    margin-bottom: 14px;
  }
  .form-grid {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }
  .form-grid label {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .form-grid label span,
  .form-label {
    font-size: 0.75rem;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }
  .form-grid input,
  .form-grid textarea {
    padding: 8px 12px;
    font-size: 0.85rem;
    border-radius: 6px;
    border: 1px solid var(--border);
    background: var(--input-bg);
    color: var(--text-primary);
    font-family: inherit;
  }
  .form-grid input:focus,
  .form-grid textarea:focus {
    outline: none;
    border-color: var(--accent);
  }
  .form-actions {
    display: flex;
    gap: 8px;
    margin-top: 14px;
  }

  /* Scope selector */
  .scope-section {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .scope-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
    gap: 6px;
  }
  .scope-btn {
    text-align: left;
    padding: 8px 12px;
    border-radius: 6px;
    border: 1px solid var(--border);
    background: var(--bg-inset);
    color: var(--text-secondary);
    cursor: pointer;
    font-family: inherit;
    transition: border-color 0.15s;
  }
  .scope-btn:hover {
    border-color: var(--accent);
  }
  .scope-btn.active {
    border-color: var(--accent);
    background: var(--accent-bg);
  }
  .scope-btn strong {
    display: block;
    font-size: 0.8rem;
  }
  .scope-btn span {
    font-size: 0.65rem;
    color: var(--text-muted);
  }

  /* Request list */
  .empty {
    color: var(--text-muted);
    text-align: center;
    padding: 40px;
  }
  .request-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .request-card {
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 14px 16px;
    transition:
      border-color 0.15s,
      opacity 0.15s;
    cursor: pointer;
  }
  .request-card:hover {
    border-color: var(--border);
  }
  .request-card.is-done {
    opacity: 0.5;
  }
  .request-card.is-halted {
    border-left: 3px solid var(--danger);
  }
  .request-card.is-running {
    border-left: 3px solid var(--success);
  }
  .request-card.expanded {
    border-color: var(--accent);
  }

  .request-top {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 12px;
  }
  .request-info {
    flex: 1;
    min-width: 0;
  }
  .request-title-row {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 4px;
  }
  .request-status-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
    transition: box-shadow 0.3s;
  }
  .request-status-dot.status-running {
    animation: pulse-glow 1.5s ease-in-out infinite;
  }
  .request-status-dot.status-done-solid {
    box-shadow: none;
  }
  .request-title-row h3 {
    font-size: 0.95rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .scope-badge {
    font-size: 0.6rem;
    padding: 2px 8px;
    border-radius: 10px;
    background: var(--bg-hover);
    color: var(--text-muted);
    white-space: nowrap;
    flex-shrink: 0;
  }
  .elapsed-badge {
    font-size: 0.6rem;
    padding: 2px 8px;
    border-radius: 10px;
    background: color-mix(in srgb, var(--success) 10%, transparent);
    color: var(--success);
    font-family: 'JetBrains Mono', monospace;
    white-space: nowrap;
    flex-shrink: 0;
  }
  .request-goal {
    font-size: 0.8rem;
    color: var(--text-secondary);
    margin-bottom: 4px;
  }
  .request-meta {
    font-size: 0.65rem;
    color: var(--text-faint);
    display: flex;
    gap: 12px;
  }
  .request-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    flex-shrink: 0;
  }

  .expand-indicator {
    color: var(--text-faint);
    font-size: 0.7rem;
    flex-shrink: 0;
  }
  .has-result {
    color: var(--accent);
  }

  /* Expanded detail panel */
  .request-detail {
    margin-top: 12px;
    padding-top: 12px;
    border-top: 1px solid var(--border-subtle);
    display: flex;
    flex-direction: column;
    gap: 12px;
    cursor: default;
  }
  .detail-section {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .detail-label {
    font-size: 0.7rem;
    color: var(--text-faint);
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }
  .detail-text {
    font-size: 0.8rem;
    color: var(--text-secondary);
    white-space: pre-wrap;
  }
  .detail-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .detail-actions {
    display: flex;
    gap: 4px;
  }

  /* Log viewer */
  .log-viewer {
    max-height: 400px;
    overflow-y: auto;
    padding: 12px;
    font-size: 0.75rem;
    font-family: 'JetBrains Mono', monospace;
    line-height: 1.5;
    border-radius: 6px;
    border: 1px solid var(--border);
    background: var(--code-bg);
    color: var(--text-primary);
    white-space: pre-wrap;
    word-break: break-all;
  }

  /* Chat input */
  .chat-input-row {
    display: flex;
    gap: 8px;
    align-items: center;
  }
  .chat-input {
    flex: 1;
    padding: 8px 12px;
    font-size: 0.8rem;
    border-radius: 6px;
    border: 1px solid var(--border);
    background: var(--input-bg);
    color: var(--text-primary);
    font-family: inherit;
  }
  .chat-input:focus {
    outline: none;
    border-color: var(--accent);
  }

  .result-editor {
    width: 100%;
    padding: 10px;
    font-size: 0.8rem;
    border-radius: 6px;
    border: 1px solid var(--border);
    background: var(--code-bg);
    color: var(--text-primary);
    font-family: 'JetBrains Mono', monospace;
    resize: vertical;
    min-height: 100px;
  }
  .result-editor:focus {
    outline: none;
    border-color: var(--accent);
  }

  .detail-info {
    display: flex;
    gap: 16px;
    font-size: 0.65rem;
    color: var(--text-faint);
    font-family: 'JetBrains Mono', monospace;
  }

  /* Info / How it works card */
  .info-card {
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 16px 20px;
    margin-bottom: 14px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .info-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .info-header h3 {
    font-size: 0.95rem;
    margin: 0;
  }
  .cli-status {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .status-badge-cli {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 0.75rem;
    font-weight: 600;
    padding: 4px 12px;
    border-radius: 12px;
    width: fit-content;
  }
  .status-badge-cli::before {
    content: '';
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
  }
  .status-available {
    background: color-mix(in srgb, var(--success) 12%, transparent);
    color: var(--success);
  }
  .status-available::before {
    background: var(--success);
  }
  .status-missing {
    background: color-mix(in srgb, var(--danger) 12%, transparent);
    color: var(--danger);
  }
  .status-missing::before {
    background: var(--danger);
  }
  .status-checking {
    background: color-mix(in srgb, var(--text-faint) 12%, transparent);
    color: var(--text-faint);
  }
  .status-checking::before {
    background: var(--text-faint);
  }
  .install-hint {
    font-size: 0.75rem;
    color: var(--text-secondary);
  }
  .install-hint code {
    font-size: 0.72rem;
    padding: 2px 6px;
    border-radius: 4px;
    background: var(--code-bg);
    color: var(--text-primary);
    font-family: 'JetBrains Mono', monospace;
  }
  .info-desc {
    font-size: 0.8rem;
    color: var(--text-secondary);
    line-height: 1.5;
  }
  .info-limits {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }
  .info-limit-item {
    font-size: 0.72rem;
    color: var(--text-muted);
  }
  .info-limit-item code {
    font-size: 0.68rem;
    padding: 1px 4px;
    border-radius: 3px;
    background: var(--code-bg);
    font-family: 'JetBrains Mono', monospace;
  }
  .info-limit-sep {
    color: var(--border);
    font-size: 0.7rem;
  }
  .how-it-works-btn {
    display: block;
    width: 100%;
    padding: 8px;
    font-size: 0.72rem;
    text-align: center;
    border: 1px dashed var(--border);
    border-radius: 6px;
    background: transparent;
    color: var(--text-faint);
    cursor: pointer;
    font-family: inherit;
    margin-bottom: 14px;
    transition: all 0.15s;
  }
  .how-it-works-btn:hover {
    border-color: var(--accent);
    color: var(--text-secondary);
  }

  @media (max-width: 640px) {
    .request-top {
      flex-direction: column;
    }
    .request-actions {
      width: 100%;
    }
    .scope-grid {
      grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
    }
    .info-limits {
      flex-direction: column;
      align-items: flex-start;
    }
    .info-limit-sep {
      display: none;
    }
  }
</style>
