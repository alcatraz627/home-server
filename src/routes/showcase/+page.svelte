<script lang="ts">
  import DataTable from '$lib/components/DataTable.svelte';
  import Button from '$lib/components/Button.svelte';
  import Badge from '$lib/components/Badge.svelte';
  import Tabs from '$lib/components/Tabs.svelte';
  import SearchInput from '$lib/components/SearchInput.svelte';
  import Loading from '$lib/components/Loading.svelte';
  import Collapsible from '$lib/components/Collapsible.svelte';
  import Icon from '$lib/components/Icon.svelte';
  import Card from '$lib/components/Card.svelte';
  import PageHeader from '$lib/components/PageHeader.svelte';
  import Toolbar from '$lib/components/Toolbar.svelte';
  import DataChip from '$lib/components/DataChip.svelte';
  import InteractiveChip from '$lib/components/InteractiveChip.svelte';
  import InfoRow from '$lib/components/InfoRow.svelte';
  import MiniChart from '$lib/components/MiniChart.svelte';
  import Modal from '$lib/components/Modal.svelte';
  import EmptyState from '$lib/components/EmptyState.svelte';
  import Tooltip from '$lib/components/Tooltip.svelte';
  import { toast } from '$lib/toast';

  // Component library demo state
  let demoTab = $state('buttons');
  let demoSearch = $state('');
  let demoCollapse1 = $state(false);
  let demoCollapse2 = $state(true);

  // Interactive terminal state
  let termHistory = $state<{ cmd: string; output: string }[]>([
    { cmd: 'echo "Welcome to the showcase terminal"', output: 'Welcome to the showcase terminal' },
    { cmd: 'date', output: new Date().toLocaleString() },
  ]);
  let termInput = $state('');
  let termInputEl = $state<HTMLInputElement | null>(null);

  // ── New showcase state ───────────────────────────────────────────────────
  let modalOpen = $state(false);
  let progressValue = $state(65);
  let toggleOn = $state(false);
  let counter = $state(0);

  // ── v4.3 Component state ──────────────────────────────────────────────────
  let chipActive = $state(false);
  let chipFilter = $state('all');
  let compactTab = $state('a');
  const chartData = [12, 28, 45, 32, 50, 67, 43, 55, 60, 48, 72, 65, 80, 75, 68];

  // ── Color Palette ──────────────────────────────────────────────────────────
  const bgVars = [
    '--bg-primary',
    '--bg-secondary',
    '--bg-inset',
    '--bg-hover',
    '--input-bg',
    '--btn-bg',
    '--table-header-bg',
    '--code-bg',
  ];

  const textVars = ['--text-primary', '--text-secondary', '--text-muted', '--text-faint'];

  const accentVars = ['--accent', '--success', '--danger', '--warning', '--purple', '--cyan', '--orange'];

  const borderVars = ['--border', '--border-subtle'];

  // ── DataTable sample data ──────────────────────────────────────────────────
  const tableHeaders = ['Service', 'Status', 'CPU %', 'Mem (MB)', 'Uptime'];
  const tableRows = [
    ['nginx', 'running', '0.4', '28', '12d 4h'],
    ['postgres', 'running', '1.2', '142', '12d 4h'],
    ['redis', 'running', '0.1', '12', '12d 4h'],
    ['node-api', 'running', '3.7', '256', '2d 11h'],
    ['caddy', 'running', '0.2', '34', '12d 4h'],
    ['tailscaled', 'running', '0.3', '48', '12d 4h'],
    ['prometheus', 'running', '2.1', '180', '12d 3h'],
    ['grafana', 'stopped', '0.0', '0', '—'],
    ['syncthing', 'running', '1.8', '96', '5d 7h'],
    ['samba', 'degraded', '0.6', '52', '12d 4h'],
  ];

  // ── Cards sample data ──────────────────────────────────────────────────────
  const sampleCards = [
    { icon: 'folder', title: 'Files', desc: 'Browse and manage files on the server filesystem.' },
    { icon: 'sun', title: 'Lights', desc: 'Control Hue lights and set scenes per room.' },
    { icon: 'cpu', title: 'Processes', desc: 'Monitor running processes, signal and inspect them.' },
    { icon: 'network', title: 'Tailscale', desc: 'View devices and IP addresses on the VPN mesh.' },
    { icon: 'bookmark', title: 'Keeper', desc: 'Track tasks through a kanban-style backlog.' },
    { icon: 'terminal', title: 'Terminal', desc: 'Open a live shell session directly in the browser.' },
  ];
</script>

<svelte:head>
  <title>UI Showcase | Home Server</title>
</svelte:head>

<h2 class="page-title">UI Showcase</h2>
<p class="page-desc">Design system reference — colors, type, components, and interactions.</p>

<!-- ════════════════════════════ 0. COMPONENT LIBRARY ══════════════════════ -->
<section class="section">
  <h3 class="section-heading">Component Library</h3>

  <h4 class="sub-heading">Buttons</h4>
  <div class="component-row">
    <Button>Default</Button>
    <Button variant="primary">Primary</Button>
    <Button variant="danger">Danger</Button>
    <Button variant="ghost">Ghost</Button>
    <Button variant="accent">Accent</Button>
    <Button variant="primary" icon="save">With Icon</Button>
    <Button variant="ghost" iconOnly icon="settings" />
    <Button loading>Loading</Button>
    <Button variant="danger" size="sm" confirm>Delete</Button>
  </div>

  <h4 class="sub-heading">Button Sizes</h4>
  <div class="component-row">
    <Button size="xs">Extra Small</Button>
    <Button size="sm">Small</Button>
    <Button size="md">Medium</Button>
    <Button size="lg">Large</Button>
  </div>

  <h4 class="sub-heading">Badges</h4>
  <div class="component-row">
    <Badge variant="success">Online</Badge>
    <Badge variant="danger">Failed</Badge>
    <Badge variant="warning">Pending</Badge>
    <Badge variant="info">Processing</Badge>
    <Badge>Default</Badge>
    <Badge variant="purple">Agent</Badge>
    <Badge variant="success" dot>With Dot</Badge>
    <Badge variant="warning" dot pulse>Pulsing</Badge>
  </div>

  <h4 class="sub-heading">Tabs</h4>
  <Tabs
    tabs={[
      { id: 'buttons', label: 'Buttons', count: 5 },
      { id: 'badges', label: 'Badges', count: 7 },
      { id: 'inputs', label: 'Inputs' },
    ]}
    bind:active={demoTab}
  />
  <p class="page-desc">Active tab: <code>{demoTab}</code></p>

  <h4 class="sub-heading">Search Input</h4>
  <div style="max-width: 400px;">
    <SearchInput bind:value={demoSearch} placeholder="Try searching..." clearable />
  </div>
  {#if demoSearch}
    <p class="page-desc">Searching for: <code>{demoSearch}</code></p>
  {/if}

  <h4 class="sub-heading">Loading States</h4>
  <div class="component-row" style="gap: 24px;">
    <div style="width: 200px;">
      <Loading variant="skeleton" count={2} height="32px" />
    </div>
    <Loading variant="spinner" text="Loading..." />
    <Loading variant="dots" />
  </div>

  <h4 class="sub-heading">Collapsible</h4>
  <div style="max-width: 500px;">
    <Collapsible title="Click to expand" bind:open={demoCollapse1}>
      <p class="page-desc">This content is hidden until the header is clicked. Supports smooth animation.</p>
    </Collapsible>
    <Collapsible title="Another section (starts open)" bind:open={demoCollapse2}>
      <p class="page-desc">Collapsible sections reduce visual clutter while keeping content accessible.</p>
    </Collapsible>
  </div>
</section>

<!-- ════════════════════════════ 1. COLOR PALETTE ══════════════════════════ -->
<section class="section">
  <h3 class="section-heading">Color Palette</h3>

  <h4 class="sub-heading">Backgrounds</h4>
  <div class="swatch-grid">
    {#each bgVars as v}
      <div class="swatch">
        <div class="swatch-box" style="background: var({v}); border: 1px solid var(--border)"></div>
        <code class="swatch-label">{v}</code>
      </div>
    {/each}
  </div>

  <h4 class="sub-heading">Text</h4>
  <div class="swatch-grid">
    {#each textVars as v}
      <div class="swatch">
        <div class="swatch-box swatch-text-box" style="background: var(--bg-secondary)">
          <span style="color: var({v}); font-weight: 600; font-size: 1.1rem">Aa</span>
        </div>
        <code class="swatch-label">{v}</code>
      </div>
    {/each}
  </div>

  <h4 class="sub-heading">Accents &amp; Semantic</h4>
  <div class="swatch-grid">
    {#each accentVars as v}
      <div class="swatch">
        <div class="swatch-box" style="background: var({v})"></div>
        <code class="swatch-label">{v}</code>
      </div>
    {/each}
  </div>

  <h4 class="sub-heading">Borders</h4>
  <div class="swatch-grid">
    {#each borderVars as v}
      <div class="swatch">
        <div class="swatch-box" style="background: var({v})"></div>
        <code class="swatch-label">{v}</code>
      </div>
    {/each}
  </div>
</section>

<!-- ════════════════════════════ 2. TYPOGRAPHY ════════════════════════════ -->
<section class="section">
  <h3 class="section-heading">Typography</h3>

  <h4 class="sub-heading">Inter — Body font</h4>
  <div class="type-stack">
    <div class="type-row">
      <span class="type-meta">0.65rem / faint</span>
      <span style="font-size: 0.65rem; color: var(--text-faint)">The quick brown fox jumps over the lazy dog</span>
    </div>
    <div class="type-row">
      <span class="type-meta">0.75rem / muted</span>
      <span style="font-size: 0.75rem; color: var(--text-muted)">The quick brown fox jumps over the lazy dog</span>
    </div>
    <div class="type-row">
      <span class="type-meta">0.85rem / secondary</span>
      <span style="font-size: 0.85rem; color: var(--text-secondary)">The quick brown fox jumps over the lazy dog</span>
    </div>
    <div class="type-row">
      <span class="type-meta">1rem / primary</span>
      <span style="font-size: 1rem; color: var(--text-primary)">The quick brown fox jumps over the lazy dog</span>
    </div>
    <div class="type-row">
      <span class="type-meta">1rem / 600</span>
      <span style="font-size: 1rem; font-weight: 600; color: var(--text-primary)"
        >The quick brown fox jumps over the lazy dog</span
      >
    </div>
    <div class="type-row">
      <span class="type-meta">1.2rem / 700</span>
      <span style="font-size: 1.2rem; font-weight: 700; color: var(--text-primary)"
        >The quick brown fox jumps over the lazy dog</span
      >
    </div>
    <div class="type-row">
      <span class="type-meta">1.5rem / 700</span>
      <span style="font-size: 1.5rem; font-weight: 700; color: var(--text-primary)"
        >The quick brown fox jumps over the lazy dog</span
      >
    </div>
  </div>

  <h4 class="sub-heading">JetBrains Mono — Code font</h4>
  <div class="type-stack">
    <div class="type-row">
      <span class="type-meta">0.65rem</span>
      <code style="font-size: 0.65rem; color: var(--text-faint)">192.168.1.1:8080 GET /api/status 200 OK</code>
    </div>
    <div class="type-row">
      <span class="type-meta">0.75rem</span>
      <code style="font-size: 0.75rem; color: var(--text-muted)">nginx 1.24.0 — running — 28 MB</code>
    </div>
    <div class="type-row">
      <span class="type-meta">0.85rem</span>
      <code style="font-size: 0.85rem; color: var(--text-secondary)">$ systemctl status nginx.service</code>
    </div>
    <div class="type-row">
      <span class="type-meta">1rem / accent</span>
      <code style="font-size: 1rem; color: var(--accent)">1.11.2-showcase-bold-42</code>
    </div>
    <div class="type-row">
      <span class="type-meta">1.2rem / success</span>
      <code style="font-size: 1.2rem; color: var(--success); font-weight: 500"
        ><Icon name="check" size={16} /> Backup completed</code
      >
    </div>
  </div>
</section>

<!-- ════════════════════════════ 3. BUTTONS ═══════════════════════════════ -->
<section class="section">
  <h3 class="section-heading">Buttons</h3>

  <div class="btn-group">
    <div class="btn-demo">
      <button class="btn">Default</button>
      <span class="btn-meta">btn</span>
    </div>

    <div class="btn-demo">
      <button class="btn btn-sm">Small</button>
      <span class="btn-meta">btn btn-sm</span>
    </div>

    <div class="btn-demo">
      <button class="btn active">Active</button>
      <span class="btn-meta">btn.active</span>
    </div>

    <div class="btn-demo">
      <button class="btn btn-primary">Primary</button>
      <span class="btn-meta">btn btn-primary</span>
    </div>

    <div class="btn-demo">
      <button class="btn btn-danger-hover">Danger (hover me)</button>
      <span class="btn-meta">btn btn-danger-hover</span>
    </div>

    <div class="btn-demo">
      <button class="btn btn-confirm">Confirm?</button>
      <span class="btn-meta">btn btn-confirm (pulse)</span>
    </div>

    <div class="btn-demo">
      <button class="btn" disabled>Disabled</button>
      <span class="btn-meta">btn :disabled</span>
    </div>

    <div class="btn-demo">
      <button class="btn btn-sm active">Small Active</button>
      <span class="btn-meta">btn-sm.active</span>
    </div>
  </div>
</section>

<!-- ════════════════════════════ v4.3 COMPONENTS ═══════════════════════════ -->
<section class="section">
  <h3 class="section-heading">v4.3 Components</h3>

  <div class="demo-block">
    <h4 class="demo-label">PageHeader</h4>
    <PageHeader title="Dashboard" description="System overview and quick stats.">
      <Button size="sm">Refresh</Button>
    </PageHeader>
  </div>

  <div class="demo-block">
    <h4 class="demo-label">Card (default / outlined / elevated)</h4>
    <div class="demo-row">
      <Card>Default card with body content</Card>
      <Card variant="outlined">Outlined card</Card>
      <Card variant="elevated">Elevated card with shadow</Card>
    </div>
  </div>

  <div class="demo-block">
    <h4 class="demo-label">Card with header + footer</h4>
    <Card>
      {#snippet header()}<strong>Service Health</strong>{/snippet}
      3 services running, 1 degraded
      {#snippet footer()}<Badge variant="success">Healthy</Badge>{/snippet}
    </Card>
  </div>

  <div class="demo-block">
    <h4 class="demo-label">Toolbar</h4>
    <Toolbar justify="space-between">
      <div style="display:flex;gap:6px;">
        <Button size="sm">Filter</Button>
        <Button size="sm">Sort</Button>
      </div>
      <SearchInput bind:value={demoSearch} placeholder="Search..." size="sm" />
    </Toolbar>
  </div>

  <div class="demo-block">
    <h4 class="demo-label">DataChip</h4>
    <div class="demo-row">
      <DataChip label="CPU" value="42%" icon="cpu" />
      <DataChip label="MEM" value="6.2GB" color="var(--success)" />
      <DataChip label="DISK" value="78%" color="var(--warning)" />
      <DataChip label="Uptime" value="12d 4h" size="md" />
    </div>
  </div>

  <div class="demo-block">
    <h4 class="demo-label">InteractiveChip</h4>
    <div class="demo-row">
      <InteractiveChip active={chipFilter === 'all'} onclick={() => (chipFilter = 'all')}>All</InteractiveChip>
      <InteractiveChip
        active={chipFilter === 'running'}
        dot
        color="var(--success)"
        onclick={() => (chipFilter = 'running')}>Running</InteractiveChip
      >
      <InteractiveChip
        active={chipFilter === 'stopped'}
        dot
        color="var(--danger)"
        onclick={() => (chipFilter = 'stopped')}>Stopped</InteractiveChip
      >
      <InteractiveChip active={chipActive} onclick={() => (chipActive = !chipActive)} count={7}>Alerts</InteractiveChip>
      <InteractiveChip dot pulse color="var(--warning)">Live</InteractiveChip>
    </div>
  </div>

  <div class="demo-block">
    <h4 class="demo-label">InfoRow</h4>
    <Card padding="sm">
      <InfoRow label="Host" value="homelab-pi" />
      <InfoRow label="IP" value="100.74.12.5" mono />
      <InfoRow label="OS" value="Raspbian 12 (bookworm)" />
      <InfoRow label="Status"><Badge variant="success" dot>Online</Badge></InfoRow>
    </Card>
  </div>

  <div class="demo-block">
    <h4 class="demo-label">MiniChart</h4>
    <div class="demo-row" style="gap: 24px;">
      <div style="flex:1">
        <MiniChart data={chartData} label="CPU" unit="%" color="var(--accent)" height={50} showAxis />
      </div>
      <div style="flex:1">
        <MiniChart data={chartData.map((v) => v * 0.6)} label="Memory" unit="%" color="var(--success)" height={50} />
      </div>
      <div style="flex:1">
        <MiniChart
          data={chartData.map((v) => v * 1.2)}
          label="Network"
          unit="KB/s"
          color="var(--cyan)"
          height={50}
          showAxis
        />
      </div>
    </div>
  </div>

  <div class="demo-block">
    <h4 class="demo-label">Tabs (compact mode)</h4>
    <Tabs
      tabs={[
        { id: 'a', label: 'Overview' },
        { id: 'b', label: 'Metrics' },
        { id: 'c', label: 'Logs' },
      ]}
      bind:active={compactTab}
      compact
    />
  </div>
</section>

<!-- ════════════════════════════ 4. CARDS ═════════════════════════════════ -->
<section class="section">
  <h3 class="section-heading">Cards</h3>
  <div class="card-grid">
    {#each sampleCards as card}
      <div class="nav-card">
        <span class="card-icon"><Icon name={card.icon} size={18} /></span>
        <div>
          <div class="card-title">{card.title}</div>
          <div class="card-desc">{card.desc}</div>
        </div>
      </div>
    {/each}
  </div>
</section>

<!-- ════════════════════════════ 5. DATA TABLE ════════════════════════════ -->
<section class="section">
  <h3 class="section-heading">Data Table</h3>
  <DataTable headers={tableHeaders} rows={tableRows} pageSize={10} />
</section>

<!-- ════════════════════════════ 6. TOAST DEMO ════════════════════════════ -->
<section class="section">
  <h3 class="section-heading">Toast Demo</h3>
  <div class="btn-group">
    <button class="btn toast-success" onclick={() => toast.success('Backup completed successfully.')}>
      Success toast
    </button>
    <button class="btn toast-warning" onclick={() => toast.warning('Disk usage above 80% on /data.')}>
      Warning toast
    </button>
    <button class="btn toast-error" onclick={() => toast.error('Connection to service timed out.')}>Error toast</button>
    <button class="btn toast-info" onclick={() => toast.info('New version available: 1.12.0.')}>Info toast</button>
  </div>
</section>

<!-- ════════════════════════════ 7. INTERACTIVE TERMINAL ═══════════════════ -->
<section class="section">
  <h3 class="section-heading">Interactive Terminal</h3>
  <div class="term-card">
    <div class="term-titlebar">
      <span class="term-dot term-red"></span>
      <span class="term-dot term-yellow"></span>
      <span class="term-dot term-green"></span>
      <span class="term-title">showcase — demo:~</span>
    </div>
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="term-body" onclick={() => termInputEl?.focus()}>
      {#each termHistory as entry}
        <div class="term-line">
          <span class="term-prompt">user@server</span><span class="term-sep">:</span><span class="term-path">~</span
          ><span class="term-dollar">$</span>
          <span class="term-cmd">{entry.cmd}</span>
        </div>
        {#if entry.output}
          <div class="term-out term-dim">{entry.output}</div>
        {/if}
      {/each}
      <div class="term-line term-input-line">
        <span class="term-prompt">user@server</span><span class="term-sep">:</span><span class="term-path">~</span><span
          class="term-dollar">$</span
        >
        <input
          class="term-input"
          type="text"
          bind:value={termInput}
          bind:this={termInputEl}
          onkeydown={(e) => {
            if (e.key === 'Enter' && termInput.trim()) {
              termHistory = [...termHistory, { cmd: termInput.trim(), output: `echo: ${termInput.trim()}` }];
              termInput = '';
              setTimeout(() => {
                const body = document.querySelector('.term-body');
                if (body) body.scrollTop = body.scrollHeight;
              }, 0);
            }
          }}
          placeholder="Type a command..."
          spellcheck="false"
          autocomplete="off"
        />
      </div>
    </div>
  </div>
</section>

<!-- ════════════════════════════ MODALS & OVERLAYS ═════════════════════════ -->
<section class="section">
  <h3 class="section-heading">Modals & Overlays</h3>

  <div class="demo-block">
    <h4 class="demo-label">Modal</h4>
    <Button onclick={() => (modalOpen = true)}>Open Modal</Button>
    <Modal bind:open={modalOpen} title="Demo Modal" width="450px">
      <p style="color: var(--text-secondary); font-size: 0.85rem;">
        This is a reusable modal with title bar, close button, ESC support, and click-away dismissal.
      </p>
      {#snippet footer()}
        <Button onclick={() => (modalOpen = false)}>Close</Button>
        <Button
          variant="primary"
          onclick={() => {
            modalOpen = false;
            toast.success('Action confirmed!');
          }}>Confirm</Button
        >
      {/snippet}
    </Modal>
  </div>

  <div class="demo-block">
    <h4 class="demo-label">Tooltips</h4>
    <div class="demo-row">
      <Tooltip text="Top tooltip" position="top"><Button size="sm">Top</Button></Tooltip>
      <Tooltip text="Bottom tooltip with longer text for wrapping" position="bottom"
        ><Button size="sm">Bottom</Button></Tooltip
      >
      <Tooltip text="Left tooltip" position="left"><Button size="sm">Left</Button></Tooltip>
      <Tooltip text="Right tooltip" position="right"><Button size="sm">Right</Button></Tooltip>
    </div>
  </div>
</section>

<!-- ════════════════════════════ EMPTY STATES ══════════════════════════════ -->
<section class="section">
  <h3 class="section-heading">Empty States</h3>

  <div class="demo-block">
    <div class="demo-row" style="gap: 16px;">
      <div style="flex: 1;">
        <EmptyState
          icon="folder"
          title="No Files"
          hint="Upload or create files to see them here"
          actionLabel="Upload"
          onaction={() => toast.info('Upload clicked')}
        />
      </div>
      <div style="flex: 1;">
        <EmptyState icon="search" title="No Results" hint="Try adjusting your search or filters" />
      </div>
    </div>
  </div>
</section>

<!-- ════════════════════════════ INTERACTIONS ══════════════════════════════ -->
<section class="section">
  <h3 class="section-heading">Interactions & State</h3>

  <div class="demo-block">
    <h4 class="demo-label">Counter with transition</h4>
    <div class="demo-row">
      <Button size="sm" onclick={() => counter--}>-</Button>
      <span class="counter-display">{counter}</span>
      <Button size="sm" onclick={() => counter++}>+</Button>
      <Button size="sm" variant="accent" onclick={() => (counter = 0)}>Reset</Button>
    </div>
  </div>

  <div class="demo-block">
    <h4 class="demo-label">Progress bar</h4>
    <div class="progress-demo">
      <div class="progress-track">
        <div class="progress-fill-demo" style="width: {progressValue}%"></div>
      </div>
      <span class="progress-label">{progressValue}%</span>
    </div>
    <input type="range" min="0" max="100" bind:value={progressValue} class="range-input" />
  </div>

  <div class="demo-block">
    <h4 class="demo-label">Loading states</h4>
    <div class="demo-row">
      <Loading variant="spinner" />
      <Loading variant="dots" />
      <Loading variant="skeleton" count={1} height="24px" />
      <Button loading disabled>Processing</Button>
    </div>
  </div>

  <div class="demo-block">
    <h4 class="demo-label">Badge variants</h4>
    <div class="demo-row">
      <Badge variant="success" dot pulse>Live</Badge>
      <Badge variant="danger">Error</Badge>
      <Badge variant="warning">Warning</Badge>
      <Badge variant="info">Info</Badge>
      <Badge variant="accent">Accent</Badge>
      <Badge variant="purple">Purple</Badge>
      <Badge variant="default">Default</Badge>
      <Badge variant="success" size="md">Medium</Badge>
    </div>
  </div>

  <div class="demo-block">
    <h4 class="demo-label">Collapsible sections</h4>
    <Collapsible title="Click to expand" bind:open={demoCollapse1}>
      <p style="font-size: 0.82rem; color: var(--text-secondary);">
        Collapsible content with smooth animation. Useful for FAQs, settings groups, and detail panels.
      </p>
    </Collapsible>
    <Collapsible title="Already expanded" bind:open={demoCollapse2}>
      <p style="font-size: 0.82rem; color: var(--text-secondary);">
        Another collapsible section. These maintain independent state.
      </p>
    </Collapsible>
  </div>
</section>

<!-- ════════════════════════════ ANIMATIONS ════════════════════════════════ -->
<section class="section">
  <h3 class="section-heading">Animations</h3>

  <div class="demo-block">
    <h4 class="demo-label">Card stagger entrance</h4>
    <div class="demo-row">
      {#each [0, 1, 2, 3, 4] as i}
        <div class="card anim-card card-stagger" style="animation-delay: {i * 80}ms">
          Card {i + 1}
        </div>
      {/each}
    </div>
  </div>

  <div class="demo-block">
    <h4 class="demo-label">Hover effects</h4>
    <div class="demo-row">
      <div class="card hover-lift">Hover lift</div>
      <div class="card hover-glow">Hover glow</div>
      <div class="card hover-scale">Hover scale</div>
    </div>
  </div>
</section>

<style>
  /* ── Page header ────────────────────────────────────────────────────────── */
  .page-title {
    font-size: 1.4rem;
    font-weight: 700;
    margin-bottom: 6px;
  }

  .page-subtitle {
    font-size: 0.85rem;
    color: var(--text-muted);
    margin-bottom: 32px;
  }

  /* ── Section chrome ─────────────────────────────────────────────────────── */
  .section {
    margin-bottom: 48px;
  }

  .component-row {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
    margin-bottom: 12px;
  }

  .section-heading {
    font-size: 1rem;
    font-weight: 600;
    color: var(--text-primary);
    padding-bottom: 8px;
    border-bottom: 1px solid var(--border);
    margin-bottom: 20px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    font-size: 0.8rem;
  }

  .sub-heading {
    font-size: 0.75rem;
    font-weight: 500;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-bottom: 10px;
    margin-top: 20px;
  }

  /* ── Swatches ───────────────────────────────────────────────────────────── */
  .swatch-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
  }

  .swatch {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
  }

  .swatch-box {
    width: 72px;
    height: 48px;
    border-radius: 6px;
    flex-shrink: 0;
  }

  .swatch-text-box {
    display: flex;
    align-items: center;
    justify-content: center;
    border: 1px solid var(--border);
  }

  .swatch-label {
    font-size: 0.6rem;
    color: var(--text-faint);
    max-width: 72px;
    text-align: center;
    word-break: break-all;
    line-height: 1.3;
  }

  /* ── Typography ─────────────────────────────────────────────────────────── */
  .type-stack {
    display: flex;
    flex-direction: column;
    gap: 10px;
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 16px;
  }

  .type-row {
    display: flex;
    align-items: baseline;
    gap: 16px;
  }

  .type-meta {
    font-size: 0.65rem;
    color: var(--text-faint);
    font-family: 'JetBrains Mono', monospace;
    min-width: 130px;
    flex-shrink: 0;
  }

  /* ── Buttons ────────────────────────────────────────────────────────────── */
  .btn-group {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    align-items: flex-end;
  }

  .btn-demo {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 6px;
  }

  .btn-meta {
    font-size: 0.6rem;
    color: var(--text-faint);
    font-family: 'JetBrains Mono', monospace;
  }

  /* Base button */
  .btn {
    padding: 6px 14px;
    font-size: 0.8rem;
    border-radius: 6px;
    border: 1px solid var(--border);
    background: var(--btn-bg);
    color: var(--text-secondary);
    cursor: pointer;
    font-family: inherit;
    transition:
      border-color 0.15s,
      color 0.15s,
      background 0.15s,
      filter 0.15s;
  }

  .btn:hover:not(:disabled) {
    border-color: var(--accent);
  }

  .btn:disabled {
    opacity: 0.45;
    cursor: default;
  }

  .btn.active {
    border-color: var(--accent);
    color: var(--accent);
  }

  .btn-sm {
    padding: 3px 8px;
    font-size: 0.75rem;
    border-radius: 4px;
  }

  .btn-primary {
    background: var(--success);
    border-color: var(--success);
    color: var(--bg-primary);
  }

  .btn-primary:hover:not(:disabled) {
    filter: brightness(1.15);
  }

  .btn-danger-hover {
    color: var(--danger);
    border-color: var(--border);
  }

  .btn-danger-hover:hover:not(:disabled) {
    border-color: var(--danger);
  }

  .btn-confirm {
    border-color: var(--danger);
    background: var(--danger-bg);
    color: var(--danger);
    animation: pulse 0.7s ease-in-out infinite alternate;
  }

  @keyframes pulse {
    from {
      opacity: 1;
    }
    to {
      opacity: 0.55;
    }
  }

  /* Toast trigger buttons */
  .toast-success:hover:not(:disabled) {
    border-color: var(--success);
    color: var(--success);
  }

  .toast-warning:hover:not(:disabled) {
    border-color: var(--warning);
    color: var(--warning);
  }

  .toast-error:hover:not(:disabled) {
    border-color: var(--danger);
    color: var(--danger);
  }

  .toast-info:hover:not(:disabled) {
    border-color: var(--accent);
    color: var(--accent);
  }

  /* ── Cards ──────────────────────────────────────────────────────────────── */
  .card-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 12px;
  }

  .nav-card {
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 16px;
    display: flex;
    gap: 12px;
    align-items: flex-start;
    transition:
      border-color 0.15s,
      background 0.15s;
    cursor: default;
  }

  .nav-card:hover {
    border-color: var(--accent);
    background: var(--bg-hover);
  }

  .card-icon {
    font-size: 1.4rem;
    flex-shrink: 0;
    padding-top: 2px;
  }

  .card-title {
    font-size: 0.9rem;
    font-weight: 600;
    color: var(--text-primary);
    margin-bottom: 4px;
  }

  .card-desc {
    font-size: 0.75rem;
    color: var(--text-muted);
    line-height: 1.5;
  }

  /* ── Terminal ───────────────────────────────────────────────────────────── */
  .term-card {
    background: var(--bg-inset);
    border: 1px solid var(--border);
    border-radius: 10px;
    overflow: hidden;
    font-family: 'JetBrains Mono', monospace;
  }

  .term-titlebar {
    background: var(--bg-secondary);
    border-bottom: 1px solid var(--border);
    padding: 8px 14px;
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .term-dot {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .term-red {
    background: var(--danger);
  }

  .term-yellow {
    background: var(--warning);
  }

  .term-green {
    background: var(--success);
  }

  .term-title {
    font-size: 0.7rem;
    color: var(--text-faint);
    margin-left: 8px;
  }

  .term-body {
    padding: 16px 20px;
    font-size: 0.8rem;
    line-height: 1.7;
    color: var(--text-secondary);
  }

  .term-line {
    display: flex;
    gap: 2px;
    align-items: baseline;
    margin-bottom: 2px;
  }

  .term-prompt {
    color: var(--success);
    font-weight: 500;
  }

  .term-sep {
    color: var(--text-faint);
  }

  .term-path {
    color: var(--accent);
  }

  .term-dollar {
    color: var(--text-muted);
    margin: 0 6px;
  }

  .term-cmd {
    color: var(--text-primary);
  }

  .term-out {
    color: var(--text-secondary);
    padding-left: 2px;
  }

  .term-dim {
    color: var(--text-muted);
  }

  .term-success {
    color: var(--success);
  }

  .term-cursor {
    color: var(--accent);
    animation: blink 1s step-end infinite;
  }

  .term-input-line {
    display: flex;
    align-items: center;
  }

  .term-input {
    flex: 1;
    background: none;
    border: none;
    color: var(--text-primary);
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.8rem;
    outline: none;
    caret-color: var(--accent);
    padding: 0;
    margin: 0;
  }

  .term-input::placeholder {
    color: var(--text-faint);
    opacity: 0.5;
  }

  @keyframes blink {
    0%,
    100% {
      opacity: 1;
    }
    50% {
      opacity: 0;
    }
  }

  /* ── Responsive ─────────────────────────────────────────────────────────── */
  @media (max-width: 768px) {
    .card-grid {
      grid-template-columns: repeat(2, 1fr);
    }

    .type-row {
      flex-direction: column;
      gap: 4px;
    }

    .type-meta {
      min-width: unset;
    }
  }

  @media (max-width: 480px) {
    .card-grid {
      grid-template-columns: 1fr;
    }
  }

  /* New showcase items */
  .counter-display {
    font-size: 1.5rem;
    font-weight: 700;
    font-family: 'JetBrains Mono', monospace;
    color: var(--accent);
    min-width: 60px;
    text-align: center;
    transition: transform 0.15s;
  }

  .progress-demo {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 8px;
  }

  .progress-track {
    flex: 1;
    height: 8px;
    background: var(--bg-hover);
    border-radius: 4px;
    overflow: hidden;
  }

  .progress-fill-demo {
    height: 100%;
    background: var(--accent);
    border-radius: 4px;
    transition: width 0.3s ease-out;
  }

  .progress-label {
    font-size: 0.78rem;
    font-family: 'JetBrains Mono', monospace;
    color: var(--text-muted);
    min-width: 36px;
  }

  .range-input {
    width: 100%;
    accent-color: var(--accent);
  }

  .anim-card {
    padding: 16px 20px;
    text-align: center;
    font-size: 0.82rem;
    font-weight: 500;
    min-width: 80px;
  }

  .hover-lift,
  .hover-glow,
  .hover-scale {
    padding: 16px 20px;
    text-align: center;
    font-size: 0.82rem;
    cursor: pointer;
    min-width: 100px;
    transition: all 0.2s;
  }

  .hover-lift:hover {
    transform: translateY(-4px);
    box-shadow: 0 8px 20px rgba(0, 0, 0, 0.15);
  }

  .hover-glow:hover {
    box-shadow:
      0 0 15px var(--accent),
      0 0 30px color-mix(in srgb, var(--accent) 30%, transparent);
    border-color: var(--accent);
  }

  .hover-scale:hover {
    transform: scale(1.05);
  }
</style>
