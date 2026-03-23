<script lang="ts">
  import type { PageData } from './$types';
  import type { TaskStatus } from '$lib/server/operator';
  import { toast } from '$lib/toast';
  import EmptyState from '$lib/components/EmptyState.svelte';
  import Button from '$lib/components/Button.svelte';
  import Badge from '$lib/components/Badge.svelte';
  import SearchInput from '$lib/components/SearchInput.svelte';
  import Collapsible from '$lib/components/Collapsible.svelte';
  import Icon from '$lib/components/Icon.svelte';
  import { fetchApi } from '$lib/api';
  import {
    sendNotification,
    requestNotificationPermission,
    isNotificationSupported,
    isNotificationEnabled,
  } from '$lib/notify.svelte';

  let { data } = $props<{ data: PageData }>();
  // svelte-ignore state_referenced_locally
  const { statuses: initialStatuses, disk: initialDisk, scheduledCount: initialScheduledCount } = data;
  let statuses = $state<TaskStatus[]>(initialStatuses);
  let disk = $state(initialDisk);
  let scheduledCount = $state(initialScheduledCount || 0);

  // Cron delete confirmation dialog
  let cronDeleteTarget = $state<{ id: string; name: string; schedule: string } | null>(null);

  let showForm = $state(false);
  let showTemplates = $state(false);
  let formName = $state('');
  let formCommand = $state('');
  let formTimeout = $state(300);
  let formRetries = $state(3);
  let formSchedule = $state('');

  import { TEMPLATES, type Template } from './templates';

  // Custom templates (localStorage)
  let customTemplates = $state<Template[]>(loadCustomTemplates());

  function loadCustomTemplates(): Template[] {
    if (typeof localStorage === 'undefined') return [];
    try {
      return JSON.parse(localStorage.getItem('hs:custom-templates') || '[]');
    } catch {
      return [];
    }
  }

  function saveCustomTemplates() {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('hs:custom-templates', JSON.stringify(customTemplates));
    }
  }

  // Edit template state
  let editingTemplateIdx = $state<number | null>(null);

  function deleteCustomTemplate(index: number) {
    const t = customTemplates[index];
    customTemplates = customTemplates.filter((_, i) => i !== index);
    saveCustomTemplates();
    toast.success(`Deleted template "${t.name}"`);
  }

  function editCustomTemplate(index: number) {
    const t = customTemplates[index];
    editingTemplateIdx = index;
    formName = t.name;
    formCommand = t.command;
    formTimeout = t.timeout;
    formRetries = t.retries;
    formSchedule = t.schedule || '';
    showTemplates = false;
    showForm = true;
  }

  function saveEditedTemplate() {
    if (editingTemplateIdx === null) return;
    customTemplates[editingTemplateIdx] = {
      name: formName,
      command: formCommand,
      timeout: formTimeout,
      retries: formRetries,
      schedule: formSchedule || null,
      desc: customTemplates[editingTemplateIdx].desc,
      tags: customTemplates[editingTemplateIdx].tags,
    };
    saveCustomTemplates();
    toast.success(`Updated template "${formName}"`);
    editingTemplateIdx = null;
    showForm = false;
    formName = '';
    formCommand = '';
    formTimeout = 300;
    formRetries = 3;
    formSchedule = '';
  }

  function saveAsTemplate(status: (typeof statuses)[0]) {
    const t: Template = {
      name: status.config.name,
      command: status.config.command,
      timeout: status.config.timeout,
      retries: status.config.maxRetries,
      schedule: status.config.schedule,
      desc: `Custom template from "${status.config.name}"`,
      tags: ['custom'],
    };
    customTemplates = [...customTemplates, t];
    saveCustomTemplates();
    toast.success(`Saved "${t.name}" as template`);
  }

  // Merge built-in + custom templates
  let allTemplates = $derived([...customTemplates, ...TEMPLATES]);

  // Template search/filter/pagination
  let templateSearch = $state('');
  let templateTag = $state('');
  let templatePage = $state(0);
  const TEMPLATES_PER_PAGE = 9;

  let allTags = $derived([...new Set(allTemplates.flatMap((t) => t.tags))].sort());

  let filteredTemplates = $derived.by(() => {
    let result = allTemplates;
    if (templateSearch) {
      const q = templateSearch.toLowerCase();
      result = result.filter(
        (t) =>
          t.name.toLowerCase().includes(q) || t.desc.toLowerCase().includes(q) || t.command.toLowerCase().includes(q),
      );
    }
    if (templateTag) {
      result = result.filter((t) => t.tags.includes(templateTag));
    }
    return result;
  });

  let templateTotalPages = $derived(Math.max(1, Math.ceil(filteredTemplates.length / TEMPLATES_PER_PAGE)));
  let pagedTemplates = $derived(
    filteredTemplates.slice(templatePage * TEMPLATES_PER_PAGE, (templatePage + 1) * TEMPLATES_PER_PAGE),
  );

  // Reset page when filter changes
  $effect(() => {
    filteredTemplates.length;
    templatePage = 0;
  });

  function applyTemplate(t: Template) {
    formName = t.name;
    formCommand = t.command;
    formTimeout = t.timeout;
    formRetries = t.retries;
    formSchedule = t.schedule || '';
    showTemplates = false;
    showForm = true;
  }

  async function runTemplate(t: Template) {
    try {
      const res = await fetchApi('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: t.name,
          command: t.command,
          timeout: t.timeout,
          maxRetries: t.retries,
          schedule: t.schedule,
        }),
      });
      if (!res.ok) throw new Error('Failed to create task');
      const created = await res.json();
      toast.info(`Running "${t.name}"...`, { key: `task-run-${t.name}` });
      await refresh();
      // Immediately run
      const taskId = created.id || statuses.find((s) => s.config.name === t.name)?.config.id;
      if (taskId) {
        expandedTask = taskId;
        // Open terminal
        terminalVisible = true;
        terminalTaskName = t.name;
        terminalTaskId = taskId;
        terminalRunning = true;
        terminalOutput = `$ ${t.command}\n\n`;
        await fetchApi('/api/tasks', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ taskId }),
        });
        const poll = setInterval(async () => {
          await refresh();
          const s = statuses.find((s) => s.config.id === taskId);
          if (s?.lastRun?.output) {
            terminalOutput = `$ ${t.command}\n\n${s.lastRun.output}`;
            if (terminalEl) terminalEl.scrollTop = terminalEl.scrollHeight;
          }
          if (!s?.isRunning) {
            clearInterval(poll);
            terminalRunning = false;
            if (s?.lastRun?.output) {
              terminalOutput = `$ ${t.command}\n\n${s.lastRun.output}`;
            }
            if (s?.lastRun?.status === 'success') toast.success(`"${t.name}" completed`);
            else if (s?.lastRun?.status) toast.error(`"${t.name}" ${s.lastRun.status}`);
          }
        }, 1000);
      }
    } catch (e: any) {
      toast.error(e.message || 'Failed to run template');
    }
  }

  // Template runner terminal state
  let terminalVisible = $state(false);
  let terminalOutput = $state('');
  let terminalTaskName = $state('');
  let terminalTaskId = $state<string | null>(null);
  let terminalRunning = $state(false);
  let terminalEl: HTMLPreElement | undefined = $state(undefined);

  function closeTerminal() {
    terminalVisible = false;
    terminalOutput = '';
    terminalTaskName = '';
    terminalTaskId = null;
    terminalRunning = false;
  }

  // Advanced form toggle
  let showAdvanced = $state(false);

  let expandedTask = $state<string | null>(null);

  // Task list search + pagination + sort + filter + hide
  let taskSearch = $state('');
  let taskPage = $state(0);
  const TASKS_PER_PAGE = 10;
  let taskSortKey = $state<'name' | 'status' | 'lastRun'>('name');
  let taskSortDir = $state<'asc' | 'desc'>('asc');
  let taskStatusFilter = $state<'' | 'running' | 'success' | 'failed' | 'never'>('');
  let showHiddenTasks = $state(false);

  const HIDDEN_TASKS_KEY = 'hs:hidden-tasks';
  let hiddenTaskIds = $state<Set<string>>(new Set());

  function loadHiddenTasks() {
    try {
      const raw = localStorage.getItem(HIDDEN_TASKS_KEY);
      if (raw) hiddenTaskIds = new Set(JSON.parse(raw));
    } catch {}
  }

  function saveHiddenTasks() {
    try {
      localStorage.setItem(HIDDEN_TASKS_KEY, JSON.stringify([...hiddenTaskIds]));
    } catch {}
  }

  function toggleHideTask(id: string) {
    if (hiddenTaskIds.has(id)) {
      hiddenTaskIds.delete(id);
    } else {
      hiddenTaskIds.add(id);
    }
    hiddenTaskIds = new Set(hiddenTaskIds);
    saveHiddenTasks();
  }

  if (typeof window !== 'undefined') loadHiddenTasks();

  function getTaskStatusLabel(s: TaskStatus): string {
    if (s.isRunning) return 'running';
    if (!s.lastRun) return 'never';
    return s.lastRun.status;
  }

  let filteredStatuses = $derived.by(() => {
    let arr = [...statuses];

    // Hide
    if (!showHiddenTasks) {
      arr = arr.filter((s) => !hiddenTaskIds.has(s.config.id));
    }

    // Search
    if (taskSearch) {
      const q = taskSearch.toLowerCase();
      arr = arr.filter((s) => s.config.name.toLowerCase().includes(q) || s.config.command.toLowerCase().includes(q));
    }

    // Filter by status
    if (taskStatusFilter) {
      arr = arr.filter((s) => getTaskStatusLabel(s) === taskStatusFilter);
    }

    // Sort
    arr.sort((a, b) => {
      let av: any, bv: any;
      if (taskSortKey === 'name') {
        av = a.config.name.toLowerCase();
        bv = b.config.name.toLowerCase();
      } else if (taskSortKey === 'status') {
        av = getTaskStatusLabel(a);
        bv = getTaskStatusLabel(b);
      } else {
        av = a.lastRun?.completedAt || '';
        bv = b.lastRun?.completedAt || '';
      }
      if (av < bv) return taskSortDir === 'asc' ? -1 : 1;
      if (av > bv) return taskSortDir === 'asc' ? 1 : -1;
      return 0;
    });

    return arr;
  });

  let hiddenCount = $derived(statuses.filter((s) => hiddenTaskIds.has(s.config.id)).length);
  let taskTotalPages = $derived(Math.max(1, Math.ceil(filteredStatuses.length / TASKS_PER_PAGE)));
  let pagedStatuses = $derived(filteredStatuses.slice(taskPage * TASKS_PER_PAGE, (taskPage + 1) * TASKS_PER_PAGE));

  // Reset task page on filter change
  $effect(() => {
    taskSearch;
    taskStatusFilter;
    taskSortKey;
    showHiddenTasks;
    taskPage = 0;
  });

  // Form presets
  const TIMEOUT_PRESETS = [
    { label: '10s', value: 10 },
    { label: '30s', value: 30 },
    { label: '1m', value: 60 },
    { label: '5m', value: 300 },
    { label: '15m', value: 900 },
    { label: '1h', value: 3600 },
  ];

  const SCHEDULE_PRESETS = [
    { label: 'Every 5 min', value: '*/5 * * * *' },
    { label: 'Every 30 min', value: '*/30 * * * *' },
    { label: 'Hourly', value: '0 * * * *' },
    { label: 'Every 6h', value: '0 */6 * * *' },
    { label: 'Daily 2am', value: '0 2 * * *' },
    { label: 'Weekly Sun', value: '0 3 * * 0' },
  ];

  // Command validator
  let commandWarnings = $derived.by(() => {
    const w: string[] = [];
    if (!formCommand) return w;
    if (formCommand.includes('rm -rf /') || formCommand.includes('rm -rf ~'))
      w.push('Dangerous: recursive delete of root or home');
    if (formCommand.includes('sudo') && formTimeout < 30)
      w.push('sudo commands may need longer timeout for password prompt');
    if (formCommand.includes('|') && formCommand.split('|').length > 4)
      w.push('Many pipes — consider simplifying or using a script file');
    if (formCommand.length > 500) w.push('Very long command — consider putting this in a shell script');
    if (formCommand.includes('> /dev/') && !formCommand.includes('/dev/null'))
      w.push('Writing to device files — make sure this is intentional');
    return w;
  });

  // Track last known run times for cron notification detection
  let lastKnownRuns = $state<Record<string, string>>({});

  async function refresh() {
    try {
      const res = await fetchApi('/api/tasks');
      if (!res.ok) throw new Error('Failed to fetch tasks');
      const result = await res.json();
      const prev = statuses;
      statuses = result.statuses;
      disk = result.disk;
      scheduledCount = result.scheduledCount || 0;

      // Check for new cron completions (scheduled tasks with new lastRun)
      if (isNotificationEnabled()) {
        for (const s of statuses) {
          if (!s.config.schedule || !s.lastRun?.completedAt) continue;
          const key = s.config.id;
          const prevRun = lastKnownRuns[key];
          if (prevRun && prevRun !== s.lastRun.completedAt) {
            sendNotification(`Cron: ${s.config.name}`, {
              body: `Status: ${s.lastRun.status}`,
              tag: `cron-${key}`,
            });
          }
          lastKnownRuns[key] = s.lastRun.completedAt;
        }
      }
    } catch (e: any) {
      toast.error(e.message || 'Failed to refresh tasks', { key: 'task-refresh' });
    }
  }

  async function createTask() {
    try {
      const res = await fetchApi('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formName,
          command: formCommand,
          timeout: formTimeout,
          maxRetries: formRetries,
          schedule: formSchedule || null,
        }),
      });
      if (!res.ok) throw new Error('Failed to create task');
      toast.success(`Task "${formName}" created`);
      showForm = false;
      formName = '';
      formCommand = '';
      formTimeout = 300;
      formRetries = 3;
      formSchedule = '';
      await refresh();
    } catch (e: any) {
      toast.error(e.message || 'Failed to create task');
    }
  }

  async function runTask(taskId: string) {
    expandedTask = taskId;
    const taskName = statuses.find((s) => s.config.id === taskId)?.config.name || taskId;
    toast.info(`Running "${taskName}"...`, { key: `task-run-${taskId}` });
    try {
      const res = await fetchApi('/api/tasks', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId }),
      });
      if (!res.ok) throw new Error(`Failed to run "${taskName}"`);
      const poll = setInterval(async () => {
        await refresh();
        const s = statuses.find((s) => s.config.id === taskId);
        if (!s?.isRunning) {
          clearInterval(poll);
          if (s?.lastRun?.status === 'success') {
            toast.success(`"${taskName}" completed`);
            sendNotification(`Task: ${taskName}`, { body: 'Completed successfully', tag: `task-${taskId}` });
          } else if (s?.lastRun?.status) {
            toast.error(`"${taskName}" ${s.lastRun.status}`, { key: 'task-run' });
            sendNotification(`Task: ${taskName}`, { body: `Status: ${s.lastRun.status}`, tag: `task-${taskId}` });
          }
        }
      }, 1000);
    } catch (e: any) {
      toast.error(e.message || 'Failed to run task', { key: 'task-run' });
    }
  }

  let copied = $state<string | null>(null);
  async function copyOutput(taskId: string, text: string) {
    await navigator.clipboard.writeText(text);
    copied = taskId;
    setTimeout(() => {
      copied = null;
    }, 2000);
  }

  function requestDeleteTask(id: string) {
    const task = statuses.find((s) => s.config.id === id);
    if (task?.config.schedule && task.config.enabled) {
      cronDeleteTarget = { id, name: task.config.name, schedule: task.config.schedule };
    } else {
      confirmDeleteTask(id);
    }
  }

  async function confirmDeleteTask(id: string) {
    cronDeleteTarget = null;
    try {
      await fetchApi('/api/tasks', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      toast.success('Task deleted');
      await refresh();
    } catch {
      toast.error('Failed to delete task');
    }
  }

  function formatDuration(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`;
  }

  function statusColor(status: string): string {
    if (status === 'success') return 'var(--success)';
    if (status === 'failed' || status === 'timeout') return 'var(--danger)';
    return 'var(--warning)';
  }
</script>

<svelte:head>
  <title>Tasks | Home Server</title>
</svelte:head>

<div class="header">
  <h2 class="page-title">
    Operator Tasks{#if scheduledCount > 0}
      <span class="scheduled-count">({scheduledCount} scheduled)</span>{/if}
  </h2>
  <div class="controls">
    <Button onclick={refresh}><Icon name="refresh" size={14} /> Refresh</Button>
    {#if isNotificationSupported()}
      {#if isNotificationEnabled()}
        <span class="notif-status" title="System notifications enabled"><Icon name="bell" size={14} /> On</span>
      {:else}
        <Button size="sm" onclick={requestNotificationPermission}>
          <Icon name="bell" size={14} /> Enable Alerts
        </Button>
      {/if}
    {/if}
    <Button
      onclick={() => {
        showTemplates = !showTemplates;
        if (showTemplates) showForm = false;
      }}
    >
      <Icon name="menu" size={14} /> Templates
    </Button>
    <Button
      onclick={() => {
        showForm = !showForm;
        if (showForm) {
          showTemplates = false;
          editingTemplateIdx = null;
        }
      }}
    >
      {showForm ? 'Cancel' : '\uFF0B New Task'}
    </Button>
  </div>
</div>
<p class="page-desc">
  Schedule, monitor, and manage shell tasks with cron support, templates, and live output streaming.
</p>

<!-- Disk usage -->
{#if disk.length > 0}
  <div class="disk-section">
    <h3>Disk Usage</h3>
    <div class="disk-grid">
      {#each disk as d}
        <div class="disk-item">
          <span class="disk-mount">{d.mount}</span>
          <div class="disk-bar">
            <div
              class="disk-fill"
              style="width: {d.usePercent}; background: {parseInt(d.usePercent) > 90
                ? 'var(--danger)'
                : parseInt(d.usePercent) > 70
                  ? 'var(--warning)'
                  : 'var(--success)'}"
            ></div>
          </div>
          <span class="disk-info">
            {d.used} / {d.total} ({d.usePercent})
            {#if d.fstype}<span class="disk-fstype">{d.fstype}</span>{/if}
            {#if d.device}<span class="disk-device" title={d.device}>{d.device.split('/').pop()}</span>{/if}
          </span>
        </div>
      {/each}
    </div>
  </div>
{/if}

<!-- Template panel -->
<Collapsible bind:open={showTemplates} title="Templates">
  <div class="template-section">
    <div class="template-filters">
      <SearchInput bind:value={templateSearch} placeholder="Search templates..." clearable />
      <div class="tag-bar">
        <button class="tag-btn" class:active={templateTag === ''} onclick={() => (templateTag = '')}
          >All ({allTemplates.length})</button
        >
        {#each allTags as tag}
          <button
            class="tag-btn"
            class:active={templateTag === tag}
            onclick={() => (templateTag = templateTag === tag ? '' : tag)}>{tag}</button
          >
        {/each}
      </div>
    </div>
    <div class="template-grid">
      {#each pagedTemplates as t}
        {@const isCustom = t.tags.includes('custom')}
        {@const customIdx = isCustom
          ? customTemplates.findIndex((c) => c.name === t.name && c.command === t.command)
          : -1}
        <div class="template-card" class:template-card-custom={isCustom}>
          {#if isCustom}
            <div class="template-custom-actions">
              <button
                class="template-edit-btn"
                title="Edit custom template"
                onclick={(e) => {
                  e.stopPropagation();
                  if (customIdx >= 0) editCustomTemplate(customIdx);
                }}><Icon name="edit" size={12} /></button
              >
              <button
                class="template-delete-btn"
                title="Delete custom template"
                onclick={(e) => {
                  e.stopPropagation();
                  if (customIdx >= 0) deleteCustomTemplate(customIdx);
                }}><Icon name="close" size={12} /></button
              >
            </div>
          {/if}
          <button class="template-body" onclick={() => applyTemplate(t)}>
            <strong>{t.name}</strong>
            <span class="template-desc">{t.desc}</span>
            <code class="template-cmd">{t.command.slice(0, 70)}{t.command.length > 70 ? '...' : ''}</code>
            <div class="template-footer">
              <div class="template-tags">
                {#each t.tags as tag}
                  <span class="template-tag" class:template-tag-custom={tag === 'custom'}>{tag}</span>
                {/each}
              </div>
              {#if t.schedule}<span class="template-schedule">{t.schedule}</span>{/if}
            </div>
          </button>
          <button class="template-run-btn" onclick={() => runTemplate(t)} title="Create and run immediately"
            ><Icon name="play" size={12} /> Run</button
          >
        </div>
      {/each}
    </div>
    {#if filteredTemplates.length === 0}
      <p class="template-empty">No templates match your search.</p>
    {/if}
    {#if templateTotalPages > 1}
      <div class="template-pagination">
        <Button size="sm" disabled={templatePage === 0} onclick={() => templatePage--}
          ><Icon name="arrow-left" size={12} /> Prev</Button
        >
        <span class="page-info">{templatePage + 1} / {templateTotalPages}</span>
        <Button size="sm" disabled={templatePage >= templateTotalPages - 1} onclick={() => templatePage++}
          >Next <Icon name="arrow-right" size={12} /></Button
        >
      </div>
    {/if}
  </div>
</Collapsible>

<!-- Template Runner Terminal -->
{#if terminalVisible}
  <div class="terminal-section">
    <div class="terminal-header">
      <span class="terminal-title">
        {#if terminalRunning}<Icon name="loader" size={14} />{:else}<Icon name="check" size={14} />{/if}
        {terminalTaskName}
        {#if terminalRunning}<span class="terminal-spinner"></span>{/if}
      </span>
      <Button size="xs" variant="ghost" onclick={closeTerminal} class="terminal-close"
        ><Icon name="close" size={14} /></Button
      >
    </div>
    <pre class="terminal-output" bind:this={terminalEl}>{terminalOutput || 'Waiting for output...'}</pre>
  </div>
{/if}

{#if showForm}
  <div class="form-card">
    <h3>{editingTemplateIdx !== null ? 'Edit Template' : 'New Task'}</h3>
    <div class="form-grid">
      <div class="form-section">
        <span class="form-section-label">Basics</span>
        <label>
          <span>Task Name</span>
          <input type="text" bind:value={formName} placeholder="e.g., Disk space check" />
        </label>

        <label>
          <span>Shell Command</span>
          <textarea class="command-input" bind:value={formCommand} rows="3" placeholder="e.g., df -h / | grep dev"
          ></textarea>
        </label>

        {#if commandWarnings.length > 0}
          <div class="command-warnings">
            {#each commandWarnings as w}
              <div class="warning-item"><Icon name="warning" size={14} /> {w}</div>
            {/each}
          </div>
        {/if}
      </div>

      <div class="form-section">
        <span class="form-section-label">Schedule</span>
        <div class="preset-row">
          {#each SCHEDULE_PRESETS as p}
            <button
              class="preset-btn"
              class:active={formSchedule === p.value}
              onclick={() => (formSchedule = formSchedule === p.value ? '' : p.value)}>{p.label}</button
            >
          {/each}
        </div>
        <input type="text" bind:value={formSchedule} placeholder="Custom cron expression (leave empty for manual)" />
        <div class="cron-help">
          <details>
            <summary>How does cron scheduling work?</summary>
            <div class="cron-help-body">
              <p>
                Cron expressions run your task automatically on a schedule. Format: <code
                  >minute hour day month weekday</code
                >
              </p>
              <table class="cron-table">
                <tbody>
                  <tr><td><code>*/5 * * * *</code></td><td>Every 5 minutes</td></tr>
                  <tr><td><code>0 * * * *</code></td><td>Every hour (at :00)</td></tr>
                  <tr><td><code>0 2 * * *</code></td><td>Daily at 2:00 AM</td></tr>
                  <tr><td><code>0 3 * * 0</code></td><td>Weekly on Sunday at 3 AM</td></tr>
                </tbody>
              </table>
              <p>
                <strong>How it works:</strong> When you save a task with a schedule, the server's built-in scheduler checks
                every minute. When the cron expression matches, it runs the command. Output is saved to task history. If notifications
                are enabled, you'll get a system alert.
              </p>
              <p>
                <strong>Note:</strong> Cron tasks only run while the server is running. If the server is off during a scheduled
                time, the task is skipped (not queued).
              </p>
            </div>
          </details>
        </div>
      </div>

      <div class="form-section form-advanced-toggle">
        <Button size="sm" onclick={() => (showAdvanced = !showAdvanced)}>
          {#if showAdvanced}<Icon name="chevron-up" size={14} /> Hide{:else}<Icon name="chevron-down" size={14} /> Show{/if}
          Advanced
        </Button>
      </div>

      {#if showAdvanced}
        <div class="form-section form-advanced">
          <span class="form-section-label">Timeout</span>
          <div class="preset-row">
            {#each TIMEOUT_PRESETS as p}
              <button class="preset-btn" class:active={formTimeout === p.value} onclick={() => (formTimeout = p.value)}
                >{p.label}</button
              >
            {/each}
          </div>
          <div class="form-row">
            <label><span>Custom (seconds)</span><input type="number" bind:value={formTimeout} min="5" /></label>
            <label><span>Max Retries</span><input type="number" bind:value={formRetries} min="0" max="10" /></label>
          </div>
        </div>
      {/if}
    </div>
    <div class="form-actions">
      {#if editingTemplateIdx !== null}
        <Button variant="primary" onclick={saveEditedTemplate} disabled={!formName || !formCommand}
          ><Icon name="save" size={14} /> Save Template</Button
        >
        <Button
          onclick={() => {
            editingTemplateIdx = null;
            showForm = false;
            formName = '';
            formCommand = '';
            formTimeout = 300;
            formRetries = 3;
            formSchedule = '';
          }}>Cancel</Button
        >
      {:else}
        <Button variant="primary" onclick={createTask} disabled={!formName || !formCommand}
          >{'\uFF0B'} Create Task</Button
        >
        {#if formName || formCommand}<Button
            onclick={() => {
              formName = '';
              formCommand = '';
              formTimeout = 300;
              formRetries = 3;
              formSchedule = '';
            }}>Clear</Button
          >{/if}
      {/if}
    </div>
  </div>
{/if}

{#if statuses.length === 0 && !showForm}
  <EmptyState
    icon="settings"
    title="No tasks configured"
    hint="Create shell command tasks to run on-demand or on a schedule"
    actionLabel="Browse Templates"
    onaction={() => (showTemplates = true)}
  />
{:else}
  {#if statuses.length > 3}
    <div class="task-search-bar">
      <SearchInput bind:value={taskSearch} placeholder="Search tasks..." clearable />
      <select class="task-filter-select" bind:value={taskStatusFilter}>
        <option value="">All statuses</option>
        <option value="running">Running</option>
        <option value="success">Success</option>
        <option value="failed">Failed</option>
        <option value="never">Never run</option>
      </select>
      <select
        class="task-filter-select"
        value={taskSortKey}
        onchange={(e) => {
          const v = (e.currentTarget as HTMLSelectElement).value as typeof taskSortKey;
          if (v === taskSortKey) {
            taskSortDir = taskSortDir === 'asc' ? 'desc' : 'asc';
          } else {
            taskSortKey = v;
            taskSortDir = v === 'lastRun' ? 'desc' : 'asc';
          }
        }}
      >
        <option value="name">Sort: Name</option>
        <option value="status">Sort: Status</option>
        <option value="lastRun">Sort: Last Run</option>
      </select>
      {#if hiddenCount > 0}
        <label class="task-hidden-toggle">
          <input type="checkbox" bind:checked={showHiddenTasks} />
          Show hidden ({hiddenCount})
        </label>
      {/if}
      <span class="task-count">{filteredStatuses.length} of {statuses.length} tasks</span>
    </div>
  {/if}
  <div class="task-list">
    {#each pagedStatuses as status, i}
      <div
        class="task-card"
        class:task-running={status.isRunning}
        class:task-hidden={hiddenTaskIds.has(status.config.id)}
        style="animation-delay: {i * 40}ms"
      >
        <div class="task-top">
          <div class="task-info">
            <div class="task-title-row">
              {#if status.isRunning}
                <span class="task-status-icon icon-running"><Icon name="loader" size={14} /></span>
              {:else if status.lastRun?.status === 'success'}
                <span class="task-status-icon icon-success"><Icon name="check" size={14} /></span>
              {:else if status.lastRun?.status === 'failed' || status.lastRun?.status === 'timeout'}
                <span class="task-status-icon icon-failed"><Icon name="error" size={14} /></span>
              {:else if status.config.schedule}
                <span class="task-status-icon icon-scheduled"><Icon name="clock" size={14} /></span>
              {:else}
                <span class="task-status-icon icon-idle"><Icon name="pause" size={14} /></span>
              {/if}
              <h3>{status.config.name}</h3>
              {#if status.isRunning}
                <Badge variant="warning" pulse>running</Badge>
              {:else if status.lastRun?.status === 'success'}
                <Badge variant="success">success</Badge>
              {:else if status.lastRun?.status === 'failed' || status.lastRun?.status === 'timeout'}
                <Badge variant="danger">{status.lastRun.status}</Badge>
              {:else if status.config.schedule}
                <Badge variant="accent">scheduled</Badge>
              {:else}
                <Badge variant="default">idle</Badge>
              {/if}
            </div>
            <code class="task-command">{status.config.command}</code>
            <div class="task-meta">
              timeout: {status.config.timeout}s · retries: {status.config.maxRetries}
              {#if status.config.schedule}
                · <span class="task-schedule">cron: {status.config.schedule}</span>
              {/if}
              {#if status.lastRun}
                · <span class="task-timestamp">{new Date(status.lastRun.startedAt).toLocaleString()}</span>
              {/if}
            </div>
          </div>
          <div class="task-actions">
            <Button size="sm" onclick={() => runTask(status.config.id)} disabled={status.isRunning}>
              {#if status.isRunning}<Icon name="loader" size={14} />{:else}<Icon name="play" size={14} />{/if} Run
            </Button>
            <Button
              size="sm"
              onclick={() => (expandedTask = expandedTask === status.config.id ? null : status.config.id)}
            >
              {#if expandedTask === status.config.id}<Icon name="chevron-up" size={14} />{:else}<Icon
                  name="chevron-down"
                  size={14}
                />{/if}
            </Button>
            <Button size="sm" onclick={() => saveAsTemplate(status)}><Icon name="save" size={14} /> Save</Button>
            <Button
              size="sm"
              variant="danger"
              confirm
              confirmText="Delete?"
              onclick={() => requestDeleteTask(status.config.id)}><Icon name="close" size={14} /></Button
            >
            <span title={hiddenTaskIds.has(status.config.id) ? 'Unhide' : 'Hide'}>
              <Button size="sm" onclick={() => toggleHideTask(status.config.id)}>
                <Icon name={hiddenTaskIds.has(status.config.id) ? 'eye' : 'eye-off'} size={14} />
              </Button>
            </span>
          </div>
        </div>

        {#if status.lastRun}
          <div class="last-run">
            <span class="run-dot" style="color: {statusColor(status.lastRun.status)}">●</span>
            <span class="run-status" style="color: {statusColor(status.lastRun.status)}">{status.lastRun.status}</span>
            {#if status.lastRun.duration}
              <span class="run-duration">{formatDuration(status.lastRun.duration)}</span>
            {/if}
            <span class="run-attempt">attempt {status.lastRun.attempt}</span>
            <button
              class="last-output-btn"
              onclick={() => (expandedTask = expandedTask === status.config.id ? null : status.config.id)}
              title="Toggle output"
            >
              <Icon name="clipboard" size={14} />
              {expandedTask === status.config.id ? 'Hide output' : 'Last output'}
            </button>
          </div>
        {:else if status.config.schedule}
          <div class="last-run last-run-pending">
            <span class="run-pending"><Icon name="clipboard" size={14} /> Output shown after first scheduled run</span>
          </div>
        {/if}

        {#if expandedTask === status.config.id && status.lastRun}
          <div class="task-output">
            <div class="output-header">
              <span class="output-label">
                {status.isRunning ? 'Running...' : 'Output'}
                {#if status.isRunning}<span class="output-spinner"></span>{/if}
              </span>
              {#if status.lastRun.output}
                <Button size="xs" onclick={() => copyOutput(status.config.id, status.lastRun?.output || '')}>
                  {copied === status.config.id ? 'Copied!' : 'Copy'}
                </Button>
              {/if}
            </div>
            <pre>{status.lastRun.output || '(no output)'}</pre>
          </div>
        {/if}
      </div>
    {/each}
  </div>
  {#if taskTotalPages > 1}
    <div class="template-pagination">
      <Button size="sm" disabled={taskPage === 0} onclick={() => taskPage--}
        ><Icon name="arrow-left" size={12} /> Prev</Button
      >
      <span class="page-info">Page {taskPage + 1} of {taskTotalPages}</span>
      <Button size="sm" disabled={taskPage >= taskTotalPages - 1} onclick={() => taskPage++}
        >Next <Icon name="arrow-right" size={12} /></Button
      >
    </div>
  {/if}
{/if}

<!-- Cron delete confirmation dialog -->
{#if cronDeleteTarget}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <div class="cron-dialog-overlay" onclick={() => (cronDeleteTarget = null)} role="dialog" aria-label="Confirm delete">
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <div class="cron-dialog" onclick={(e) => e.stopPropagation()}>
      <div class="cron-dialog-icon"><Icon name="warning" size={24} /></div>
      <h3 class="cron-dialog-title">Delete Scheduled Task</h3>
      <p class="cron-dialog-text">
        <strong>{cronDeleteTarget.name}</strong> has an active cron schedule (<code>{cronDeleteTarget.schedule}</code>).
        Deleting it will stop the scheduled runs.
      </p>
      <div class="cron-dialog-actions">
        <Button onclick={() => (cronDeleteTarget = null)}>Cancel</Button>
        <Button variant="danger" onclick={() => confirmDeleteTask(cronDeleteTarget!.id)}>
          Delete &amp; Unschedule
        </Button>
      </div>
    </div>
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

  .notif-status {
    font-size: 0.68rem;
    color: var(--success);
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 0 6px;
  }

  .cron-help {
    margin-top: 6px;
  }

  .cron-help summary {
    font-size: 0.72rem;
    color: var(--text-faint);
    cursor: pointer;
  }

  .cron-help summary:hover {
    color: var(--accent);
  }

  .cron-help-body {
    font-size: 0.75rem;
    color: var(--text-muted);
    margin-top: 8px;
    padding: 10px 12px;
    background: var(--bg-primary);
    border-radius: 6px;
    border: 1px solid var(--border-subtle);
  }

  .cron-help-body p {
    margin: 4px 0;
    line-height: 1.5;
  }

  .cron-table {
    margin: 6px 0;
    font-size: 0.72rem;
  }

  .cron-table td {
    padding: 2px 12px 2px 0;
  }

  .cron-table code {
    font-size: 0.68rem;
    background: var(--code-bg);
    padding: 1px 5px;
    border-radius: 3px;
  }

  /* Form improvements */
  .command-input {
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.8rem;
    resize: vertical;
    min-height: 60px;
  }
  .command-warnings {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .warning-item {
    font-size: 0.75rem;
    color: var(--warning);
    padding: 4px 8px;
    background: var(--warning-bg);
    border-radius: 4px;
  }

  .form-section {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding-top: 8px;
    border-top: 1px solid var(--border-subtle);
  }
  .form-section-label {
    font-size: 0.75rem;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }
  .preset-row {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }
  .preset-btn {
    padding: 3px 10px;
    font-size: 0.7rem;
    border-radius: 12px;
    border: 1px solid var(--border);
    background: var(--btn-bg);
    color: var(--text-muted);
    cursor: pointer;
    font-family: inherit;
    transition: all 0.15s;
  }
  .preset-btn:hover {
    border-color: var(--accent);
    color: var(--text-primary);
  }
  .preset-btn.active {
    background: var(--accent-bg);
    border-color: var(--accent);
    color: var(--accent);
  }
  .form-actions {
    display: flex;
    gap: 8px;
    margin-top: 12px;
  }

  /* Task search bar */
  .task-search-bar {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 12px;
    flex-wrap: wrap;
  }

  .task-filter-select {
    font-size: 0.75rem;
    padding: 4px 8px;
    border: 1px solid var(--border);
    border-radius: 5px;
    background: var(--bg-primary);
    color: var(--text-secondary);
    cursor: pointer;
    font-family: inherit;
  }

  .task-hidden-toggle {
    display: flex;
    flex-direction: row !important;
    align-items: center;
    gap: 4px;
    font-size: 0.72rem;
    color: var(--text-faint);
    cursor: pointer;
    white-space: nowrap;
  }

  .task-card.task-hidden {
    opacity: 0.5;
    border-style: dashed;
  }

  .task-count {
    font-size: 0.75rem;
    color: var(--text-muted);
    white-space: nowrap;
    margin-left: auto;
  }

  .disk-section {
    margin-bottom: 20px;
    padding: 14px;
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: 8px;
  }
  .disk-section h3 {
    font-size: 0.85rem;
    color: var(--text-muted);
    margin-bottom: 10px;
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }
  .disk-grid {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .disk-item {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 0.8rem;
  }
  .disk-mount {
    width: 120px;
    font-family: monospace;
    font-size: 0.75rem;
    color: var(--text-secondary);
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .disk-bar {
    flex: 1;
    height: 8px;
    background: var(--btn-bg);
    border-radius: 4px;
    overflow: hidden;
  }
  .disk-fill {
    height: 100%;
    border-radius: 4px;
    transition: width 0.3s;
  }
  .disk-info {
    font-size: 0.7rem;
    color: var(--text-muted);
    width: 200px;
    text-align: right;
    display: flex;
    align-items: center;
    gap: 6px;
    justify-content: flex-end;
    flex-wrap: wrap;
  }
  .disk-fstype {
    font-size: 0.6rem;
    color: var(--text-faint);
    background: var(--bg-inset);
    padding: 1px 4px;
    border-radius: 3px;
    font-family: monospace;
  }
  .disk-device {
    font-size: 0.6rem;
    color: var(--text-faint);
    font-family: monospace;
    max-width: 80px;
    overflow: hidden;
    text-overflow: ellipsis;
  }

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
    gap: 12px;
  }
  .form-grid label {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .form-grid label span {
    font-size: 0.75rem;
    color: var(--text-muted);
    text-transform: uppercase;
  }
  .form-grid input {
    padding: 8px 12px;
    font-size: 0.85rem;
    border-radius: 6px;
    border: 1px solid var(--border);
    background: var(--input-bg);
    color: var(--text-primary);
    font-family: inherit;
  }
  .form-grid input:focus {
    outline: none;
    border-color: var(--accent);
  }
  .form-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }

  .empty {
    color: var(--text-muted);
    text-align: center;
    padding: 40px;
  }
  .task-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .task-card {
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 14px 16px;
    transition: border-color 0.15s;
  }
  .task-card.task-running {
    border-color: var(--warning);
  }
  .task-top {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
  }
  .task-title-row {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 4px;
  }
  .task-info h3 {
    font-size: 0.95rem;
  }
  .task-command {
    font-size: 0.75rem;
    color: var(--text-muted);
    display: block;
    margin-bottom: 4px;
  }
  .task-meta {
    font-size: 0.7rem;
    color: var(--text-faint);
  }
  .task-schedule {
    color: var(--accent);
  }
  .task-timestamp {
    color: var(--text-faint);
  }

  /* Template card with run button */
  .template-body {
    text-align: left;
    cursor: pointer;
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-family: inherit;
    color: var(--text-primary);
    background: none;
    border: none;
    padding: 0;
    width: 100%;
  }
  .template-run-btn {
    margin-top: 6px;
    padding: 4px 10px;
    font-size: 0.7rem;
    border-radius: 6px;
    border: 1px solid var(--border);
    background: var(--btn-bg);
    color: var(--success);
    cursor: pointer;
    font-family: inherit;
    align-self: flex-start;
    transition: all 0.15s;
  }
  .template-run-btn:hover {
    background: var(--success-bg);
    border-color: var(--success);
  }

  .template-section {
    margin-bottom: 16px;
  }
  .template-filters {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-bottom: 12px;
  }

  .tag-bar {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }
  .tag-btn {
    padding: 3px 10px;
    font-size: 0.7rem;
    border-radius: 12px;
    border: 1px solid var(--border);
    background: var(--btn-bg);
    color: var(--text-muted);
    cursor: pointer;
    font-family: inherit;
    transition: all 0.15s;
  }
  .tag-btn:hover {
    border-color: var(--accent);
    color: var(--text-primary);
  }
  .tag-btn.active {
    background: var(--accent-bg);
    border-color: var(--accent);
    color: var(--accent);
  }

  .template-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 10px;
  }
  .template-card {
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 12px 14px;
    display: flex;
    flex-direction: column;
    transition: border-color 0.15s;
  }
  .template-card:hover {
    border-color: var(--accent);
  }
  .template-card strong {
    font-size: 0.85rem;
  }
  .template-desc {
    font-size: 0.75rem;
    color: var(--text-muted);
    line-height: 1.4;
  }
  .template-cmd {
    font-size: 0.65rem;
    color: var(--text-faint);
    display: block;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    background: var(--code-bg);
    padding: 4px 6px;
    border-radius: 3px;
    margin-top: 2px;
  }
  .template-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: 4px;
  }
  .template-tags {
    display: flex;
    gap: 4px;
    flex-wrap: wrap;
  }
  .template-tag {
    font-size: 0.6rem;
    padding: 1px 6px;
    border-radius: 8px;
    background: var(--bg-hover);
    color: var(--text-muted);
  }
  .template-schedule {
    font-size: 0.6rem;
    color: var(--accent);
    font-family: 'JetBrains Mono', monospace;
  }
  .template-empty {
    text-align: center;
    color: var(--text-muted);
    padding: 20px;
    font-size: 0.85rem;
  }

  .template-pagination {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 12px;
    margin-top: 12px;
  }
  .page-info {
    font-size: 0.7rem;
    color: var(--text-faint);
  }
  .task-actions {
    display: flex;
    gap: 6px;
  }

  .last-run {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 10px;
    padding-top: 8px;
    border-top: 1px solid var(--border-subtle);
  }
  .run-dot {
    font-size: 0.6rem;
  }
  .run-status {
    font-size: 0.8rem;
  }
  .run-duration {
    font-size: 0.75rem;
    color: var(--text-muted);
  }
  .run-attempt {
    font-size: 0.7rem;
    color: var(--text-faint);
  }

  .task-output {
    margin-top: 8px;
  }
  .output-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 4px;
  }
  .output-label {
    font-size: 0.7rem;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.03em;
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .output-spinner {
    display: inline-block;
    width: 8px;
    height: 8px;
    border: 2px solid var(--border);
    border-top-color: var(--accent);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }
  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
  .task-output pre {
    background: var(--code-bg);
    padding: 10px;
    border-radius: 6px;
    font-size: 0.7rem;
    max-height: 300px;
    overflow: auto;
    color: var(--text-muted);
    white-space: pre-wrap;
    word-break: break-all;
  }

  /* Last output button inside last-run row */
  .last-output-btn {
    margin-left: auto;
    padding: 2px 8px;
    font-size: 0.65rem;
    border-radius: 4px;
    border: 1px solid var(--border);
    background: var(--btn-bg);
    color: var(--text-muted);
    cursor: pointer;
    font-family: inherit;
    white-space: nowrap;
    transition: all 0.15s;
  }
  .last-output-btn:hover {
    border-color: var(--accent);
    color: var(--accent);
  }
  .last-run-pending {
    border-top: 1px solid var(--border-subtle);
  }
  .run-pending {
    font-size: 0.7rem;
    color: var(--text-faint);
    font-style: italic;
  }

  /* Custom template card — delete button overlay */
  .template-card-custom {
    position: relative;
  }
  .template-delete-btn {
    position: absolute;
    top: 6px;
    right: 6px;
    width: 20px;
    height: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.6rem;
    border-radius: 50%;
    border: 1px solid var(--border);
    background: var(--btn-bg);
    color: var(--text-faint);
    cursor: pointer;
    font-family: inherit;
    padding: 0;
    transition: all 0.15s;
    z-index: 1;
  }
  .template-delete-btn:hover {
    background: var(--danger-bg);
    border-color: var(--danger);
    color: var(--danger);
  }
  .template-tag-custom {
    background: var(--accent-bg);
    color: var(--accent);
  }

  /* Custom template edit button */
  .template-custom-actions {
    position: absolute;
    top: 6px;
    right: 6px;
    display: flex;
    gap: 4px;
    z-index: 1;
  }
  .template-edit-btn {
    width: 20px;
    height: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.6rem;
    border-radius: 50%;
    border: 1px solid var(--border);
    background: var(--btn-bg);
    color: var(--text-faint);
    cursor: pointer;
    font-family: inherit;
    padding: 0;
    transition: all 0.15s;
  }
  .template-edit-btn:hover {
    background: var(--accent-bg);
    border-color: var(--accent);
    color: var(--accent);
  }
  /* Reposition delete button when inside actions container */
  .template-custom-actions .template-delete-btn {
    position: static;
  }

  /* Template Runner Terminal */
  .terminal-section {
    margin-bottom: 16px;
    border: 1px solid var(--border);
    border-radius: 8px;
    overflow: hidden;
    animation: slideDown 0.25s ease-out;
  }
  .terminal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 14px;
    background: #1a1a2e;
    border-bottom: 1px solid #2a2a3e;
  }
  .terminal-title {
    font-size: 0.8rem;
    color: #a0e0a0;
    font-family: 'JetBrains Mono', monospace;
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .terminal-spinner {
    display: inline-block;
    width: 8px;
    height: 8px;
    border: 2px solid #444;
    border-top-color: #a0e0a0;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }
  .terminal-output {
    background: #0d0d1a;
    color: #c8c8d8;
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.75rem;
    padding: 12px 14px;
    margin: 0;
    max-height: 300px;
    overflow: auto;
    white-space: pre-wrap;
    word-break: break-all;
    line-height: 1.5;
  }

  /* Task card status icons */
  .task-status-icon {
    font-size: 0.9rem;
    line-height: 1;
  }
  .icon-running {
    color: var(--warning);
    animation: spinIcon 1.2s linear infinite;
  }
  .icon-success {
    color: var(--success);
  }
  .icon-failed {
    color: var(--danger);
  }
  .icon-scheduled {
    color: var(--accent);
  }
  .icon-idle {
    color: var(--text-faint);
  }
  @keyframes spinIcon {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }

  /* Task card enter animation */
  .task-card {
    animation: cardEnter 0.3s ease-out both;
  }
  @keyframes cardEnter {
    from {
      opacity: 0;
      transform: translateY(8px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  /* Slide down animation for panels */
  @keyframes slideDown {
    from {
      opacity: 0;
      transform: translateY(-8px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  /* Form advanced toggle */
  .form-advanced-toggle {
    border-top: none;
    padding-top: 4px;
  }
  .form-advanced {
    animation: slideDown 0.2s ease-out;
  }

  /* Scheduled count badge */
  .scheduled-count {
    font-size: 0.8rem;
    font-weight: 400;
    color: var(--accent);
  }

  /* Cron delete confirmation dialog */
  .cron-dialog-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    backdrop-filter: blur(2px);
  }
  .cron-dialog {
    background: var(--bg-primary);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 24px;
    max-width: 420px;
    width: 90%;
    text-align: center;
    animation: slideDown 0.2s ease-out;
  }
  .cron-dialog-icon {
    font-size: 2rem;
    margin-bottom: 8px;
  }
  .cron-dialog-title {
    font-size: 1.1rem;
    margin-bottom: 10px;
    color: var(--text-primary);
  }
  .cron-dialog-text {
    font-size: 0.85rem;
    color: var(--text-secondary);
    margin-bottom: 18px;
    line-height: 1.5;
  }
  .cron-dialog-text code {
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.78rem;
    background: var(--bg-secondary);
    padding: 2px 6px;
    border-radius: 3px;
  }
  .cron-dialog-actions {
    display: flex;
    gap: 10px;
    justify-content: center;
  }
</style>
