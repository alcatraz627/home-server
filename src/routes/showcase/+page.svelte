<script lang="ts">
  import DataTable from '$lib/components/DataTable.svelte';
  import { toast } from '$lib/toast';

  // Interactive terminal state
  let termHistory = $state<{ cmd: string; output: string }[]>([
    { cmd: 'echo "Welcome to the showcase terminal"', output: 'Welcome to the showcase terminal' },
    { cmd: 'date', output: new Date().toLocaleString() },
  ]);
  let termInput = $state('');
  let termInputEl = $state<HTMLInputElement | null>(null);

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
    { icon: '⇄', title: 'Files', desc: 'Browse and manage files on the server filesystem.' },
    { icon: '◉', title: 'Lights', desc: 'Control Hue lights and set scenes per room.' },
    { icon: '⊞', title: 'Processes', desc: 'Monitor running processes, signal and inspect them.' },
    { icon: '⊶', title: 'Tailscale', desc: 'View devices and IP addresses on the VPN mesh.' },
    { icon: '◈', title: 'Keeper', desc: 'Track tasks through a kanban-style backlog.' },
    { icon: '▶', title: 'Terminal', desc: 'Open a live shell session directly in the browser.' },
  ];
</script>

<svelte:head>
  <title>UI Showcase | Home Server</title>
</svelte:head>

<h2 class="page-title">UI Showcase</h2>
<p class="page-desc">Design system reference — colors, type, components, and interactions.</p>

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
      <code style="font-size: 1.2rem; color: var(--success); font-weight: 500">✓ Backup completed</code>
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

<!-- ════════════════════════════ 4. CARDS ═════════════════════════════════ -->
<section class="section">
  <h3 class="section-heading">Cards</h3>
  <div class="card-grid">
    {#each sampleCards as card}
      <div class="nav-card">
        <span class="card-icon">{card.icon}</span>
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
</style>
