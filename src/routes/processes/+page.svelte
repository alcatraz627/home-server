<script lang="ts">
  import type { PageData } from './$types';
  import type { ProcessInfo, ProcessDetail } from '$lib/server/processes';
  import { toast } from '$lib/toast';
  import { getErrorMessage } from '$lib/errors';
  import { onMount } from 'svelte';
  import { stars } from '$lib/stars';
  import { useShortcuts } from '$lib/shortcuts';
  import { createAutoRefresh } from '$lib/auto-refresh.svelte';
  import Button from '$lib/components/Button.svelte';
  import SearchInput from '$lib/components/SearchInput.svelte';
  import Loading from '$lib/components/Loading.svelte';
  import Icon from '$lib/components/Icon.svelte';
  import Tabs from '$lib/components/Tabs.svelte';
  import { fetchApi } from '$lib/api';
  import { createTableSort } from '$lib/sort.svelte';
  import PageHeader from '$lib/components/PageHeader.svelte';

  let { data } = $props<{ data: PageData }>();

  // System info from layout (for absolute CPU/MEM display)
  const totalMemGB = $derived<number>((data as any).system?.memTotal ?? 16);
  const cpuCount = $derived<number>((data as any).system?.cpuCount ?? 4);

  // System monitor
  interface SystemSnapshot {
    timestamp: number;
    cpu: { cores: { core: number; usage: number }[]; avgUsage: number; loadAvg: number[]; count: number };
    memory: { total: number; free: number; used: number; usedPercent: number };
    swap: { total: number; used: number; usedPercent: number };
    network: { interfaces: number; bytesIn: number; bytesOut: number };
    disk: { readsPerSec: number; writesPerSec: number };
    processCount: number;
    uptime: number;
  }

  let monitorHistory = $state<SystemSnapshot[]>([]);
  let monitorOpen = $state(false);
  let perCoreMode = $state(false);
  const MONITOR_MAX = 60;

  async function fetchSystemStats() {
    try {
      const res = await fetchApi('/api/system');
      if (res.ok) {
        const snap: SystemSnapshot = await res.json();
        monitorHistory = [...monitorHistory.slice(-(MONITOR_MAX - 1)), snap];
      }
    } catch (e: unknown) {
      toast.error(getErrorMessage(e, 'Failed to fetch system stats'), { key: 'system-stats' });
    }
  }

  createAutoRefresh(fetchSystemStats, 2000);

  onMount(() => {
    fetchSystemStats();
    const cleanupShortcuts = useShortcuts([
      {
        id: 'processes:refresh',
        page: 'Processes',
        description: 'Refresh processes',
        defaultKey: 'r',
        category: 'Actions',
        handler: refresh,
      },
      {
        id: 'processes:focus-filter',
        page: 'Processes',
        description: 'Focus filter input',
        defaultKey: '/',
        category: 'Navigation',
        handler: () => filterInputEl?.focus(),
      },
    ]);
    return () => {
      cleanupShortcuts();
    };
  });

  function monitorPath(values: number[], width: number, height: number, maxVal?: number): string {
    if (values.length < 2) return '';
    const max = maxVal ?? Math.max(...values, 1);
    const step = width / (values.length - 1);
    return values
      .map((v, i) => `${i === 0 ? 'M' : 'L'}${(i * step).toFixed(1)},${(height - (v / max) * height).toFixed(1)}`)
      .join(' ');
  }

  function monitorArea(values: number[], width: number, height: number, maxVal?: number): string {
    if (values.length < 2) return '';
    const linePath = monitorPath(values, width, height, maxVal);
    const lastX = ((values.length - 1) * width) / (values.length - 1);
    return `${linePath} L${lastX.toFixed(1)},${height} L0,${height} Z`;
  }

  function formatBytes(b: number): string {
    if (b < 1024) return `${b} B`;
    if (b < 1048576) return `${(b / 1024).toFixed(0)} KB`;
    if (b < 1073741824) return `${(b / 1048576).toFixed(1)} MB`;
    return `${(b / 1073741824).toFixed(1)} GB`;
  }
  // svelte-ignore state_referenced_locally
  const { processes: initialProcesses } = data;
  let processes = $state<ProcessInfo[]>(initialProcesses);
  let filter = $state('');
  let filterInputEl = $state<HTMLInputElement | undefined>();
  let autoRefresh = $state(false);
  let refreshRate = $state(5);
  let refreshInterval: ReturnType<typeof setInterval> | null = null;
  let viewMode = $state<'flat' | 'tree'>('flat');

  // Starred processes (via shared stars store)

  // Expandable row state
  let expandedPid = $state<number | null>(null);
  let activeDetail = $state<ProcessDetail | null>(null);
  let detailLoading = $state(false);

  // Signal state
  let selectedSignal = $state<string>('TERM');

  // Common process name reference
  const PROCESS_HELP: Record<string, string> = {
    mds_stores: 'Spotlight metadata server — indexes files for search',
    mds: 'Spotlight metadata daemon',
    mdworker: 'Spotlight indexing worker process',
    WindowServer: 'macOS display/compositor — manages all windows',
    kernel_task: 'macOS kernel — thermal management, memory pressure',
    launchd: 'macOS init system — root process (PID 1)',
    loginwindow: 'Manages user login session',
    Finder: 'macOS file manager',
    Dock: 'macOS Dock and Mission Control',
    coreaudiod: 'Core Audio daemon — manages sound I/O',
    bluetoothd: 'Bluetooth daemon',
    airportd: 'Wi-Fi management daemon',
    distnoted: 'Distributed notification daemon',
    cfprefsd: 'Preferences daemon — reads/writes .plist files',
    trustd: 'Certificate trust evaluation daemon',
    opendirectoryd: 'Directory services (user accounts, groups)',
    node: 'Node.js JavaScript runtime',
    python3: 'Python 3 interpreter',
    postgres: 'PostgreSQL database server',
    'redis-server': 'Redis in-memory data store',
    nginx: 'Nginx web server / reverse proxy',
    sshd: 'SSH server daemon',
    tailscaled: 'Tailscale VPN daemon',
  };

  function getProcessHelp(name: string): string | null {
    return PROCESS_HELP[name] || null;
  }

  // CPU/MEM history for sparklines (per PID)
  // Using a plain object to avoid reactive loops
  const historyMap = new Map<number, { cpu: number[]; mem: number[] }>();
  let historyVersion = $state(0);
  const MAX_HISTORY = 20;

  function recordHistory() {
    for (const p of processes) {
      const entry = historyMap.get(p.pid) || { cpu: [], mem: [] };
      entry.cpu = [...entry.cpu.slice(-(MAX_HISTORY - 1)), p.cpu];
      entry.mem = [...entry.mem.slice(-(MAX_HISTORY - 1)), p.mem];
      historyMap.set(p.pid, entry);
    }
    historyVersion++;
  }

  function getHistory(pid: number) {
    // Access historyVersion to make this reactive
    void historyVersion;
    return historyMap.get(pid);
  }

  function sparklinePath(values: number[], width: number, height: number): string {
    if (values.length < 2) return '';
    const max = Math.max(...values, 1);
    const step = width / (values.length - 1);
    return values.map((v, i) => `${i === 0 ? 'M' : 'L'}${i * step},${height - (v / max) * height}`).join(' ');
  }

  // Sort state
  type SortCol = 'pid' | 'name' | 'cpu' | 'mem';
  const sort = createTableSort<SortCol>('cpu', 'desc');

  // Category filter
  let category = $state('all');

  let categoryFiltered = $derived.by(() => {
    if (category === 'all') return processes;
    if (category === 'active') return processes.filter((p) => p.cpu > 0.1);
    if (category === 'user') {
      // User processes: not root, not _-prefixed daemons, not kernel
      return processes.filter((p) => p.user !== 'root' && !p.user.startsWith('_') && p.pid !== 0);
    }
    if (category === 'system') {
      return processes.filter((p) => p.user === 'root' || p.user.startsWith('_') || p.pid === 0);
    }
    return processes;
  });

  let categoryTabs = $derived([
    { id: 'all', label: 'All', count: processes.length },
    { id: 'active', label: 'Active', count: processes.filter((p) => p.cpu > 0.1).length },
    { id: 'user', label: 'User', count: processes.filter((p) => p.user !== 'root' && !p.user.startsWith('_')).length },
    {
      id: 'system',
      label: 'System',
      count: processes.filter((p) => p.user === 'root' || p.user.startsWith('_')).length,
    },
  ]);

  // Summary stats
  let summaryStats = $derived({
    total: categoryFiltered.length,
    totalCpu: Math.round(categoryFiltered.reduce((s, p) => s + p.cpu, 0) * 10) / 10,
    totalMem: Math.round(categoryFiltered.reduce((s, p) => s + p.mem, 0) * 10) / 10,
    totalRss: categoryFiltered.reduce((s, p) => s + p.rss, 0),
    users: new Set(categoryFiltered.map((p) => p.user)).size,
  });

  // CPU/MEM display mode: percent or absolute
  let showAbsolute = $state(false);

  const DISPLAY_LIMIT = 50;
  let showAll = $state(false);

  const SIGNAL_INFO: Record<string, string> = {
    TERM: 'Graceful shutdown — process can clean up',
    KILL: 'Force kill — immediate, no cleanup',
    HUP: 'Hangup — often used to reload config',
    INT: 'Interrupt — like pressing Ctrl+C',
    STOP: 'Pause — freeze process (resume with CONT)',
    CONT: 'Resume — continue a stopped process',
    USR1: 'User signal 1 — app-specific behavior',
    USR2: 'User signal 2 — app-specific behavior',
  };
  const SIGNALS = Object.keys(SIGNAL_INFO);

  // Starred processes — delegate to shared store
  function toggleStar(pid: number) {
    stars.toggle('process', pid.toString());
  }

  // Filter (text search applied on top of category filter)
  let filtered = $derived(
    categoryFiltered.filter(
      (p) =>
        !filter ||
        p.name.toLowerCase().includes(filter.toLowerCase()) ||
        p.command.toLowerCase().includes(filter.toLowerCase()) ||
        String(p.pid).includes(filter),
    ),
  );

  // Sort starred to top, then by original order
  let sortedWithStars = $derived.by(() => {
    return stars.sortStarred('process', filtered, (p) => p.pid.toString());
  });

  // Tree view
  interface TreeNode extends ProcessInfo {
    children: TreeNode[];
    depth: number;
    isLast: boolean;
    /** Which ancestor levels have a continuing sibling (for vertical connector lines) */
    connectors: boolean[];
  }

  let treeList = $derived.by(() => {
    if (viewMode !== 'tree') return [];
    const byPid = new Map<number, ProcessInfo>();
    const childrenMap = new Map<number, ProcessInfo[]>();

    for (const p of sortedWithStars) {
      byPid.set(p.pid, p);
      if (!childrenMap.has(p.ppid)) childrenMap.set(p.ppid, []);
      childrenMap.get(p.ppid)!.push(p);
    }

    const roots = sortedWithStars.filter((p) => !byPid.has(p.ppid));
    const flat: TreeNode[] = [];

    function walk(proc: ProcessInfo, depth: number, isLast: boolean, connectors: boolean[]) {
      flat.push({ ...proc, children: [], depth, isLast, connectors: [...connectors] });
      const kids = childrenMap.get(proc.pid) || [];
      kids.forEach((child, i) => {
        walk(child, depth + 1, i === kids.length - 1, [...connectors, !isLast]);
      });
    }

    roots.forEach((root, i) => walk(root, 0, i === roots.length - 1, []));
    return flat;
  });

  let sortedList = $derived.by(() => {
    const list = viewMode === 'tree' ? treeList : sortedWithStars;
    if (viewMode === 'tree') return list; // tree has its own ordering
    const mul = sort.dir === 'asc' ? 1 : -1;
    return [...list].sort((a, b) => {
      switch (sort.key) {
        case 'pid':
          return (a.pid - b.pid) * mul;
        case 'name':
          return a.name.localeCompare(b.name) * mul;
        case 'cpu':
          return (a.cpu - b.cpu) * mul;
        case 'mem':
          return (a.mem - b.mem) * mul;
        default:
          return 0;
      }
    });
  });
  let displayList = $derived(sortedList);
  let displayed = $derived(showAll ? displayList : displayList.slice(0, DISPLAY_LIMIT));

  // Refresh
  async function refresh() {
    try {
      const res = await fetchApi('/api/processes');
      if (!res.ok) throw new Error('Failed to fetch processes');
      processes = await res.json();
      recordHistory();
    } catch (e: unknown) {
      toast.error(getErrorMessage(e, 'Failed to refresh processes'), { key: 'process-refresh' });
    }
  }

  function toggleAutoRefresh() {
    autoRefresh = !autoRefresh;
    if (autoRefresh) {
      refreshInterval = setInterval(refresh, refreshRate * 1000);
    } else if (refreshInterval) {
      clearInterval(refreshInterval);
      refreshInterval = null;
    }
  }

  function updateRefreshRate(e: Event) {
    refreshRate = parseInt((e.target as HTMLInputElement).value) || 5;
    if (autoRefresh && refreshInterval) {
      clearInterval(refreshInterval);
      refreshInterval = setInterval(refresh, refreshRate * 1000);
    }
  }

  // Expand row + fetch active detail
  async function toggleExpand(pid: number) {
    if (expandedPid === pid) {
      expandedPid = null;
      activeDetail = null;
      return;
    }
    expandedPid = pid;
    activeDetail = null;
  }

  async function fetchDetail(pid: number) {
    detailLoading = true;
    try {
      const res = await fetchApi(`/api/processes/${pid}`);
      if (!res.ok) throw new Error('Failed to fetch process details');
      activeDetail = await res.json();
    } catch (e: unknown) {
      toast.error(getErrorMessage(e, 'Failed to load process details'));
    }
    detailLoading = false;
  }

  async function confirmSignal(pid: number) {
    try {
      const res = await fetchApi(`/api/processes/${pid}?signal=${selectedSignal}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Signal failed');
      toast.success(`Sent ${selectedSignal} to PID ${pid}`);
    } catch (e: unknown) {
      toast.error(getErrorMessage(e, `Failed to send signal to PID ${pid}`));
    }
    await refresh();
  }

  function formatMem(kb: number): string {
    if (kb < 1024) return `${kb} KB`;
    if (kb < 1024 * 1024) return `${(kb / 1024).toFixed(1)} MB`;
    return `${(kb / (1024 * 1024)).toFixed(1)} GB`;
  }
</script>

<svelte:head>
  <title>Processes | Home Server</title>
</svelte:head>

<!-- System Monitor -->
<div class="monitor-toggle">
  <Button size="sm" onclick={() => (monitorOpen = !monitorOpen)}>
    {#if monitorOpen}<Icon name="chevron-down" size={14} />{:else}<Icon name="play" size={14} />{/if} System Monitor
  </Button>
  {#if monitorHistory.length > 0}
    {@const latest = monitorHistory[monitorHistory.length - 1]}
    <span class="monitor-summary">
      CPU {latest.cpu.avgUsage}% · MEM {latest.memory.usedPercent}% · Load {latest.cpu.loadAvg[0]}
    </span>
  {/if}
</div>

{#if monitorOpen && monitorHistory.length > 0}
  <div class="monitor-grid">
    <!-- CPU Chart -->
    <div class="monitor-card" class:per-core-card={perCoreMode}>
      <div class="monitor-label">
        CPU <span class="monitor-value">{monitorHistory[monitorHistory.length - 1].cpu.avgUsage}%</span>
        <button class="per-core-btn" class:active={perCoreMode} onclick={() => (perCoreMode = !perCoreMode)}>
          {perCoreMode ? 'Avg' : 'Per Core'}
        </button>
      </div>
      {#if perCoreMode}
        {@const coreCount = monitorHistory[monitorHistory.length - 1].cpu.cores.length}
        <div class="per-core-grid">
          {#each Array(coreCount) as _, coreIdx}
            {@const coreValues = monitorHistory.map((s) => s.cpu.cores[coreIdx]?.usage ?? 0)}
            {@const latest = coreValues[coreValues.length - 1] ?? 0}
            <div class="per-core-cell">
              <div class="per-core-header">
                <span class="per-core-label">C{coreIdx}</span>
                <span class="per-core-value">{latest.toFixed(0)}%</span>
              </div>
              <svg class="per-core-chart" viewBox="0 0 80 40" preserveAspectRatio="none">
                <path d={monitorArea(coreValues, 80, 40, 100)} fill="var(--accent)" opacity="0.15" />
                <path d={monitorPath(coreValues, 80, 40, 100)} fill="none" stroke="var(--accent)" stroke-width="1.5" />
              </svg>
            </div>
          {/each}
        </div>
      {:else}
        <svg class="monitor-chart" viewBox="0 0 200 60" preserveAspectRatio="none">
          <!-- Grid lines -->
          <line
            x1="0"
            y1="15"
            x2="200"
            y2="15"
            stroke="var(--border-subtle)"
            stroke-width="0.5"
            stroke-dasharray="2,3"
          />
          <line
            x1="0"
            y1="30"
            x2="200"
            y2="30"
            stroke="var(--border-subtle)"
            stroke-width="0.5"
            stroke-dasharray="2,3"
          />
          <line
            x1="0"
            y1="45"
            x2="200"
            y2="45"
            stroke="var(--border-subtle)"
            stroke-width="0.5"
            stroke-dasharray="2,3"
          />
          <!-- Filled area -->
          <path
            d={monitorArea(
              monitorHistory.map((s) => s.cpu.avgUsage),
              200,
              60,
              100,
            )}
            fill="var(--accent)"
            opacity="0.15"
          />
          <!-- Line -->
          <path
            d={monitorPath(
              monitorHistory.map((s) => s.cpu.avgUsage),
              200,
              60,
              100,
            )}
            fill="none"
            stroke="var(--accent)"
            stroke-width="1.5"
          />
        </svg>
      {/if}
    </div>

    <!-- Memory Chart -->
    <div class="monitor-card">
      <div class="monitor-label">
        Memory <span class="monitor-value"
          >{monitorHistory[monitorHistory.length - 1].memory.usedPercent}% ({formatBytes(
            monitorHistory[monitorHistory.length - 1].memory.used,
          )})</span
        >
      </div>
      <svg class="monitor-chart" viewBox="0 0 200 60" preserveAspectRatio="none">
        <line x1="0" y1="15" x2="200" y2="15" stroke="var(--border-subtle)" stroke-width="0.5" stroke-dasharray="2,3" />
        <line x1="0" y1="30" x2="200" y2="30" stroke="var(--border-subtle)" stroke-width="0.5" stroke-dasharray="2,3" />
        <line x1="0" y1="45" x2="200" y2="45" stroke="var(--border-subtle)" stroke-width="0.5" stroke-dasharray="2,3" />
        <path
          d={monitorArea(
            monitorHistory.map((s) => s.memory.usedPercent),
            200,
            60,
            100,
          )}
          fill="var(--purple)"
          opacity="0.12"
        />
        <path
          d={monitorPath(
            monitorHistory.map((s) => s.memory.usedPercent),
            200,
            60,
            100,
          )}
          fill="none"
          stroke="var(--purple)"
          stroke-width="1.5"
        />
      </svg>
    </div>

    <!-- Network Chart -->
    <div class="monitor-card">
      <div class="monitor-label">
        Network <span class="monitor-value"
          >{monitorHistory[monitorHistory.length - 1].network.interfaces} interfaces</span
        >
      </div>
      <svg class="monitor-chart" viewBox="0 0 200 60" preserveAspectRatio="none">
        <line x1="0" y1="15" x2="200" y2="15" stroke="var(--border-subtle)" stroke-width="0.5" stroke-dasharray="2,3" />
        <line x1="0" y1="30" x2="200" y2="30" stroke="var(--border-subtle)" stroke-width="0.5" stroke-dasharray="2,3" />
        <line x1="0" y1="45" x2="200" y2="45" stroke="var(--border-subtle)" stroke-width="0.5" stroke-dasharray="2,3" />
        <path
          d={monitorArea(
            monitorHistory.map((s) => s.network.bytesIn),
            200,
            60,
          )}
          fill="var(--success)"
          opacity="0.12"
        />
        <path
          d={monitorPath(
            monitorHistory.map((s) => s.network.bytesIn),
            200,
            60,
          )}
          fill="none"
          stroke="var(--success)"
          stroke-width="1.5"
        />
      </svg>
    </div>

    <!-- Load Average -->
    <div class="monitor-card">
      <div class="monitor-label">
        Load Avg <span class="monitor-value">{monitorHistory[monitorHistory.length - 1].cpu.loadAvg.join(' / ')}</span>
      </div>
      <svg class="monitor-chart" viewBox="0 0 200 60" preserveAspectRatio="none">
        <line x1="0" y1="15" x2="200" y2="15" stroke="var(--border-subtle)" stroke-width="0.5" stroke-dasharray="2,3" />
        <line x1="0" y1="30" x2="200" y2="30" stroke="var(--border-subtle)" stroke-width="0.5" stroke-dasharray="2,3" />
        <line x1="0" y1="45" x2="200" y2="45" stroke="var(--border-subtle)" stroke-width="0.5" stroke-dasharray="2,3" />
        <path
          d={monitorArea(
            monitorHistory.map((s) => s.cpu.loadAvg[0]),
            200,
            60,
          )}
          fill="var(--orange)"
          opacity="0.12"
        />
        <path
          d={monitorPath(
            monitorHistory.map((s) => s.cpu.loadAvg[0]),
            200,
            60,
          )}
          fill="none"
          stroke="var(--orange)"
          stroke-width="1.5"
        />
      </svg>
    </div>

    <!-- Swap Usage -->
    <div class="monitor-card swap-card">
      <div class="monitor-label">
        Swap <span class="monitor-value"
          >{monitorHistory[monitorHistory.length - 1].swap?.usedPercent ?? 0}% ({formatBytes(
            monitorHistory[monitorHistory.length - 1].swap?.used ?? 0,
          )})</span
        >
      </div>
      <svg class="monitor-chart" viewBox="0 0 200 60" preserveAspectRatio="none">
        <line x1="0" y1="15" x2="200" y2="15" stroke="var(--border-subtle)" stroke-width="0.5" stroke-dasharray="2,3" />
        <line x1="0" y1="30" x2="200" y2="30" stroke="var(--border-subtle)" stroke-width="0.5" stroke-dasharray="2,3" />
        <line x1="0" y1="45" x2="200" y2="45" stroke="var(--border-subtle)" stroke-width="0.5" stroke-dasharray="2,3" />
        <path
          d={monitorArea(
            monitorHistory.map((s) => s.swap?.usedPercent ?? 0),
            200,
            60,
            100,
          )}
          fill="var(--orange)"
          opacity="0.12"
        />
        <path
          d={monitorPath(
            monitorHistory.map((s) => s.swap?.usedPercent ?? 0),
            200,
            60,
            100,
          )}
          fill="none"
          stroke="var(--orange)"
          stroke-width="1.5"
        />
      </svg>
    </div>
  </div>
{/if}

<PageHeader
  title="Process Manager"
  description="View, filter, and manage running processes. Kill or signal processes in list or tree view."
>
  {#snippet children()}
    <SearchInput bind:value={filter} bind:inputEl={filterInputEl} placeholder="Filter..." size="sm" />
    <div class="view-toggle">
      <Button variant={viewMode === 'flat' ? 'accent' : 'default'} onclick={() => (viewMode = 'flat')}>List</Button>
      <Button variant={viewMode === 'tree' ? 'accent' : 'default'} onclick={() => (viewMode = 'tree')}>Tree</Button>
    </div>
    <Button onclick={refresh}>Refresh</Button>
    <div class="refresh-group">
      <Button variant={autoRefresh ? 'accent' : 'default'} onclick={toggleAutoRefresh}>
        Auto {autoRefresh ? 'ON' : 'OFF'}
      </Button>
      <select class="refresh-select" value={refreshRate} onchange={updateRefreshRate}>
        <option value={2}>2s</option>
        <option value={5}>5s</option>
        <option value={10}>10s</option>
        <option value={30}>30s</option>
        <option value={60}>60s</option>
      </select>
    </div>
  {/snippet}
</PageHeader>

<div class="process-toolbar">
  <Tabs tabs={categoryTabs} bind:active={category} size="sm" compact />
  <div class="summary-stats">
    <span class="summary-item">
      <span class="summary-label">Procs</span>
      <span class="summary-value">{summaryStats.total}</span>
    </span>
    <span class="summary-sep">·</span>
    <span class="summary-item">
      <span class="summary-label">CPU</span>
      <span class="summary-value" class:hot={summaryStats.totalCpu > 100}>{summaryStats.totalCpu}%</span>
    </span>
    <span class="summary-sep">·</span>
    <span class="summary-item">
      <span class="summary-label">MEM</span>
      <span class="summary-value" class:hot={summaryStats.totalMem > 80}>{summaryStats.totalMem}%</span>
    </span>
    <span class="summary-sep">·</span>
    <span class="summary-item">
      <span class="summary-label">RSS</span>
      <span class="summary-value">{formatMem(summaryStats.totalRss)}</span>
    </span>
  </div>
</div>

<div class="process-list">
  <div class="process-header">
    <span class="col-star"></span>
    <button class="col-pid col-sortable" onclick={() => sort.toggle('pid')}
      >PID{#if sort.activeDir('pid') === 'asc'}
        <Icon name="sort-asc" size={12} />{:else if sort.activeDir('pid') === 'desc'}
        <Icon name="sort-desc" size={12} />{/if}</button
    >
    <button class="col-name col-sortable" onclick={() => sort.toggle('name', 'asc')}
      >Name{#if sort.activeDir('name') === 'asc'}
        <Icon name="sort-asc" size={12} />{:else if sort.activeDir('name') === 'desc'}
        <Icon name="sort-desc" size={12} />{/if}</button
    >
    <button class="col-cpu col-sortable" onclick={() => sort.toggle('cpu', 'desc')}>
      {showAbsolute ? 'CPU' : 'CPU%'}{#if sort.activeDir('cpu') === 'asc'}
        <Icon name="sort-asc" size={12} />{:else if sort.activeDir('cpu') === 'desc'}
        <Icon name="sort-desc" size={12} />{/if}
    </button>
    <button class="col-mem col-sortable" onclick={() => sort.toggle('mem', 'desc')}>
      {showAbsolute ? 'MEM' : 'MEM%'}{#if sort.activeDir('mem') === 'asc'}
        <Icon name="sort-asc" size={12} />{:else if sort.activeDir('mem') === 'desc'}
        <Icon name="sort-desc" size={12} />{/if}
    </button>
    <span class="col-rss">RSS</span>
    <span class="col-state">State</span>
    <span class="col-user">User</span>
    <span class="col-actions">
      <Button size="xs" onclick={() => (showAbsolute = !showAbsolute)}>
        {showAbsolute ? '%' : 'abs'}
      </Button>
    </span>
  </div>
  {#if displayed.length === 0}
    <Loading count={5} height="38px" />
  {/if}
  {#each displayed as proc}
    {@const node = viewMode === 'tree' && 'depth' in proc ? (proc as TreeNode) : null}
    {@const depth = node?.depth ?? 0}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="process-row"
      class:starred={stars.isStarred('process', proc.pid.toString())}
      class:expanded={expandedPid === proc.pid}
      onclick={() => toggleExpand(proc.pid)}
    >
      <span class="col-star">
        <button
          class="star-btn"
          class:active={stars.isStarred('process', proc.pid.toString())}
          onclick={(e) => {
            e.stopPropagation();
            toggleStar(proc.pid);
          }}
          title="Star"
        >
          {stars.isStarred('process', proc.pid.toString()) ? '★' : '☆'}
        </button>
      </span>
      <span class="col-pid">{proc.pid}</span>
      <span class="col-name" title={proc.command}>
        {#if node && depth > 0}
          <span class="tree-connectors">
            {#each node.connectors.slice(0, -1) as hasSibling}
              <span class="tree-line">{hasSibling ? '│' : ' '}</span>
            {/each}
            <span class="tree-branch">{node.isLast ? '└' : '├'}─</span>
          </span>
        {/if}
        <span class="expand-indicator"
          >{#if expandedPid === proc.pid}<Icon name="chevron-down" size={12} />{:else}<Icon
              name="chevron-right"
              size={12}
            />{/if}</span
        >
        {proc.name}
      </span>
      <span class="col-cpu" class:hot={proc.cpu > 50}>
        <span class="resource-bar" style="width: {Math.min(100, proc.cpu)}%"></span>
        <span class="resource-text"
          >{showAbsolute ? ((proc.cpu / 100) * cpuCount).toFixed(2) + 'c' : proc.cpu.toFixed(1)}</span
        >
      </span>
      <span class="col-mem" class:hot={proc.mem > 50}>
        <span class="resource-bar mem-bar" style="width: {Math.min(100, proc.mem)}%"></span>
        <span class="resource-text">{showAbsolute ? formatMem(proc.rss) : proc.mem.toFixed(1)}</span>
      </span>
      <span class="col-rss">{formatMem(proc.rss)}</span>
      <span class="col-state">{proc.state}</span>
      <span class="col-user">{proc.user}</span>
      <span class="col-actions" onclick={(e) => e.stopPropagation()}>
        <select class="signal-select" bind:value={selectedSignal} title={SIGNAL_INFO[selectedSignal]}>
          {#each SIGNALS as sig}
            <option value={sig}>{sig}</option>
          {/each}
        </select>
        <Button size="xs" variant="danger" confirm confirmText="sure?" onclick={() => confirmSignal(proc.pid)}
          >send</Button
        >
      </span>
    </div>
    {#if expandedPid === proc.pid}
      <div class="signal-hint">{SIGNAL_INFO[selectedSignal]}</div>
    {/if}
    {#if expandedPid === proc.pid}
      <div class="detail-panel">
        <div class="detail-passive">
          {#if getProcessHelp(proc.name)}
            <div class="process-help">ℹ {getProcessHelp(proc.name)}</div>
          {/if}
          <div class="detail-grid">
            <span class="detail-label">PPID</span><span>{proc.ppid}</span>
            <span class="detail-label">VSZ</span><span>{formatMem(proc.vsz)}</span>
            <span class="detail-label">RSS</span><span>{formatMem(proc.rss)}</span>
            <span class="detail-label">State</span><span>{proc.state}</span>
            <span class="detail-label">Started</span><span>{proc.startTime}</span>
          </div>
          {#if getHistory(proc.pid)?.cpu && getHistory(proc.pid)!.cpu.length > 1}
            <div class="sparkline-row">
              <span class="detail-label">CPU</span>
              <svg class="sparkline" viewBox="0 0 80 20" preserveAspectRatio="none">
                <path
                  d={sparklinePath(getHistory(proc.pid)!.cpu, 80, 20)}
                  fill="none"
                  stroke="var(--accent)"
                  stroke-width="1.5"
                />
              </svg>
              <span class="detail-label">MEM</span>
              <svg class="sparkline" viewBox="0 0 80 20" preserveAspectRatio="none">
                <path
                  d={sparklinePath(getHistory(proc.pid)!.mem, 80, 20)}
                  fill="none"
                  stroke="var(--purple)"
                  stroke-width="1.5"
                />
              </svg>
            </div>
          {/if}
          <div class="detail-command">
            <span class="detail-label">Command</span>
            <code>{proc.command}</code>
          </div>
        </div>

        <div class="detail-active">
          {#if activeDetail && activeDetail.pid === proc.pid}
            <div class="detail-grid">
              <span class="detail-label">Threads</span><span>{activeDetail.threads}</span>
              {#if activeDetail.connections.length > 0}
                <span class="detail-label">Ports</span>
                <span
                  >{activeDetail.connections
                    .map((c) => {
                      const m = c.match(/:(\d+)$/);
                      return m ? m[1] : null;
                    })
                    .filter(Boolean)
                    .filter((v, i, a) => a.indexOf(v) === i)
                    .join(', ') || 'N/A'}</span
                >
              {/if}
            </div>
            {#if activeDetail.openFiles.length > 0}
              <details class="detail-section">
                <summary>Open Files ({activeDetail.openFiles.length})</summary>
                <ul class="file-list-detail">
                  {#each activeDetail.openFiles as f}
                    <li>{f}</li>
                  {/each}
                </ul>
              </details>
            {/if}
            {#if activeDetail.connections && activeDetail.connections.length > 0}
              <details class="detail-section">
                <summary>Network Connections ({activeDetail.connections.length})</summary>
                <ul class="file-list-detail">
                  {#each activeDetail.connections as c}
                    <li>{c}</li>
                  {/each}
                </ul>
              </details>
            {/if}
            {#if Object.keys(activeDetail.env).length > 0}
              <details class="detail-section">
                <summary>Environment ({Object.keys(activeDetail.env).length} vars)</summary>
                <div class="env-list">
                  {#each Object.entries(activeDetail.env) as [k, v]}
                    <div><strong>{k}</strong>={v}</div>
                  {/each}
                </div>
              </details>
            {/if}
          {:else}
            <Button onclick={() => fetchDetail(proc.pid)} disabled={detailLoading} loading={detailLoading}>
              {detailLoading ? 'Loading...' : 'Inspect (open files, threads, env)'}
            </Button>
          {/if}
        </div>
      </div>
    {/if}
  {/each}
</div>

{#if displayList.length > DISPLAY_LIMIT && !showAll}
  <Button class="show-all" onclick={() => (showAll = true)}>
    Show all {displayList.length} processes
  </Button>
{/if}

<style>
  .view-toggle {
    display: flex;
    gap: 0;
  }

  .refresh-group {
    display: flex;
    gap: 4px;
    align-items: center;
  }

  .refresh-select {
    padding: 5px 8px;
    font-size: 0.8rem;
    border-radius: 6px;
    border: 1px solid var(--border);
    background: var(--btn-bg);
    color: var(--text-secondary);
    cursor: pointer;
    font-family: inherit;
  }

  .process-toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 10px;
    flex-wrap: wrap;
  }

  .summary-stats {
    display: flex;
    align-items: center;
    gap: 6px;
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.72rem;
    color: var(--text-muted);
  }

  .summary-item {
    display: flex;
    gap: 4px;
    align-items: center;
  }

  .summary-label {
    color: var(--text-faint);
    text-transform: uppercase;
    font-size: 0.65rem;
    letter-spacing: 0.03em;
  }

  .summary-value {
    color: var(--text-primary);
    font-weight: 600;
  }

  .summary-value.hot {
    color: var(--danger);
  }

  .summary-sep {
    color: var(--text-faint);
  }

  .process-list {
    border: 1px solid var(--border);
    border-radius: 8px;
    overflow: hidden;
  }

  .process-header,
  .process-row {
    display: grid;
    grid-template-columns: 30px 70px 1fr 60px 60px 80px 50px 80px 120px;
    padding: 10px 16px;
    align-items: center;
    gap: 6px;
  }

  .process-header {
    background: var(--bg-secondary);
    font-size: 0.75rem;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .col-sortable {
    background: none;
    border: none;
    cursor: pointer;
    color: var(--text-muted);
    font-size: 0.75rem;
    font-family: inherit;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    padding: 0;
    text-align: inherit;
    white-space: nowrap;
  }

  .col-sortable:hover {
    color: var(--accent);
  }

  .process-row {
    border-top: 1px solid var(--border-subtle);
    font-size: 0.85rem;
  }

  .process-row:hover {
    background: var(--bg-secondary);
  }
  .process-row.starred {
    background: var(--purple-bg);
  }
  .process-row.expanded {
    background: var(--bg-inset);
  }

  .star-btn {
    background: none;
    border: none;
    cursor: pointer;
    font-size: 0.9rem;
    color: var(--text-faint);
    padding: 0;
  }

  .star-btn.active {
    color: var(--purple);
  }
  .star-btn:hover {
    color: var(--purple);
  }

  .process-row {
    cursor: pointer;
  }

  .expand-indicator {
    color: var(--text-faint);
    font-size: 0.7rem;
    margin-right: 4px;
    flex-shrink: 0;
  }

  .signal-hint {
    padding: 4px 16px 4px 110px;
    font-size: 0.65rem;
    color: var(--text-faint);
    font-style: italic;
    border-top: 1px dashed var(--border-subtle);
    background: var(--bg-inset);
  }

  .tree-connectors {
    display: inline-flex;
    align-items: center;
    font-family: monospace;
    color: var(--text-faint);
    font-size: 0.75rem;
    line-height: 1;
    user-select: none;
  }

  .tree-line {
    display: inline-block;
    width: 14px;
    text-align: center;
  }

  .tree-branch {
    display: inline-block;
    width: 20px;
  }

  .col-pid {
    font-family: monospace;
    font-size: 0.8rem;
    color: var(--text-muted);
  }

  .col-name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    display: flex;
    align-items: center;
  }

  .col-cpu,
  .col-mem {
    font-family: monospace;
    font-size: 0.8rem;
    color: var(--text-muted);
    text-align: right;
    position: relative;
    overflow: hidden;
    border-radius: 3px;
  }
  .col-cpu.hot,
  .col-mem.hot {
    color: var(--danger);
    font-weight: 600;
  }
  .resource-bar {
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    background: var(--accent);
    opacity: 0.12;
    border-radius: 3px;
    transition: width 0.3s ease;
  }
  .resource-bar.mem-bar {
    background: var(--purple);
  }
  .col-cpu.hot .resource-bar {
    background: var(--danger);
    opacity: 0.18;
  }
  .col-mem.hot .resource-bar {
    background: var(--danger);
    opacity: 0.18;
  }
  .resource-text {
    position: relative;
    z-index: 1;
  }
  .col-rss {
    font-family: monospace;
    font-size: 0.75rem;
    color: var(--text-muted);
  }
  .col-state {
    font-family: monospace;
    font-size: 0.75rem;
    color: var(--text-muted);
    text-align: center;
  }
  .col-user {
    font-size: 0.75rem;
    color: var(--text-muted);
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .col-actions {
    display: flex;
    gap: 4px;
    justify-content: flex-end;
    align-items: center;
  }

  .signal-select {
    padding: 2px 4px;
    font-size: 0.7rem;
    border-radius: 4px;
    border: 1px solid var(--border);
    background: var(--btn-bg);
    color: var(--text-secondary);
    font-family: monospace;
  }

  /* Expandable detail panel */
  .detail-panel {
    padding: 12px 16px 12px 48px;
    border-top: 1px solid var(--border-subtle);
    background: var(--bg-inset);
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .detail-grid {
    display: grid;
    grid-template-columns: 80px 1fr;
    gap: 3px 12px;
    font-size: 0.8rem;
  }

  .detail-label {
    color: var(--text-muted);
    text-transform: uppercase;
    font-size: 0.7rem;
    letter-spacing: 0.03em;
  }

  .detail-command {
    margin-top: 6px;
  }

  .detail-command code {
    display: block;
    margin-top: 4px;
    padding: 6px 10px;
    background: var(--bg-secondary);
    border-radius: 4px;
    font-size: 0.75rem;
    word-break: break-all;
    white-space: pre-wrap;
  }

  .detail-active {
    padding-top: 8px;
    border-top: 1px dashed var(--border-subtle);
  }

  .detail-section {
    margin-top: 8px;
    font-size: 0.8rem;
  }

  .detail-section summary {
    cursor: pointer;
    color: var(--text-muted);
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }

  .file-list-detail {
    list-style: none;
    padding: 4px 0;
    max-height: 200px;
    overflow-y: auto;
  }

  .file-list-detail li {
    font-size: 0.75rem;
    font-family: monospace;
    color: var(--text-muted);
    padding: 1px 0;
  }

  .env-list {
    max-height: 200px;
    overflow-y: auto;
    font-size: 0.75rem;
    font-family: monospace;
    padding: 4px 0;
  }

  .process-help {
    font-size: 0.75rem;
    color: var(--accent);
    padding: 6px 10px;
    background: var(--accent-bg);
    border-radius: 6px;
    margin-bottom: 8px;
  }

  .sparkline-row {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 8px;
  }

  .sparkline {
    width: 80px;
    height: 20px;
    flex-shrink: 0;
  }

  /* System Monitor */
  .monitor-toggle {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 12px;
  }

  .monitor-summary {
    font-size: 0.75rem;
    font-family: 'JetBrains Mono', monospace;
    color: var(--text-muted);
  }

  .monitor-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    gap: 10px;
    margin-bottom: 16px;
  }

  .monitor-card {
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 10px 12px;
  }

  .monitor-label {
    font-size: 0.7rem;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.04em;
    margin-bottom: 6px;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .monitor-value {
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.7rem;
    color: var(--text-primary);
    text-transform: none;
    letter-spacing: 0;
    font-weight: 600;
  }

  .monitor-chart {
    width: 100%;
    height: 50px;
    border-radius: 4px;
    background: var(--bg-inset);
    border: 1px solid var(--border-subtle);
  }

  .swap-card {
    border-left: 3px solid var(--orange);
  }

  .per-core-btn {
    padding: 2px 8px;
    font-size: 0.6rem;
    border-radius: 4px;
    border: 1px solid var(--border);
    background: var(--btn-bg);
    color: var(--text-muted);
    cursor: pointer;
    font-family: inherit;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    margin-left: 4px;
  }
  .per-core-btn.active {
    border-color: var(--accent);
    color: var(--accent);
    background: var(--accent-bg);
  }
  .per-core-btn:hover {
    border-color: var(--accent);
    color: var(--accent);
  }

  .per-core-card {
    grid-column: 1 / -1;
  }

  .per-core-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(90px, 1fr));
    gap: 6px;
  }

  .per-core-cell {
    background: var(--bg-inset);
    border: 1px solid var(--border-subtle);
    border-radius: 4px;
    padding: 4px 6px;
  }

  .per-core-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 2px;
  }

  .per-core-label {
    font-size: 0.6rem;
    color: var(--text-faint);
    font-family: 'JetBrains Mono', monospace;
    text-transform: uppercase;
  }

  .per-core-value {
    font-size: 0.6rem;
    color: var(--text-primary);
    font-family: 'JetBrains Mono', monospace;
    font-weight: 600;
  }

  .per-core-chart {
    width: 100%;
    height: 40px;
    border-radius: 2px;
  }

  .env-list div {
    padding: 1px 0;
    word-break: break-all;
  }

  @keyframes pulse {
    from {
      opacity: 0.7;
    }
    to {
      opacity: 1;
    }
  }

  @media (max-width: 640px) {
    .process-header,
    .process-row {
      grid-template-columns: 28px 55px 1fr 50px 50px 80px;
    }
    .col-rss,
    .col-state,
    .col-user {
      display: none;
    }
  }
</style>
