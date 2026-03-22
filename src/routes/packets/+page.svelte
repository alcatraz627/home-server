<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { toast } from '$lib/toast';
  import { fetchApi } from '$lib/api';

  interface PacketEntry {
    id: number;
    timestamp: string;
    source: string;
    destination: string;
    protocol: string;
    size: string;
    raw: string;
  }

  let interfaces = $state<string[]>([]);
  let selectedInterface = $state('en0');
  let filterExpr = $state('');
  let packetLimit = $state(100);
  let capturing = $state(false);
  let packets = $state<PacketEntry[]>([]);
  let loading = $state(false);
  let pollInterval: ReturnType<typeof setInterval> | null = null;
  let lastSeenId = $state(0);
  let autoScroll = $state(true);
  let logContainer: HTMLDivElement | undefined = $state();
  let showRaw = $state(false);

  async function fetchInterfaces() {
    try {
      const res = await fetchApi('/api/packets?action=interfaces');
      const data = await res.json();
      interfaces = data.interfaces || [];
      if (interfaces.length > 0 && !interfaces.includes(selectedInterface)) {
        selectedInterface = interfaces[0];
      }
    } catch {
      toast.error('Failed to load interfaces');
    }
  }

  async function startCapture() {
    loading = true;
    try {
      const res = await fetchApi('/api/packets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'start',
          interface: selectedInterface,
          filter: filterExpr,
          count: packetLimit,
        }),
      });
      const data = await res.json();
      if (data.error) {
        toast.error(data.error);
        return;
      }
      capturing = true;
      packets = [];
      lastSeenId = 0;
      toast.success(data.message || 'Capture started');
      startPolling();
    } catch (e: any) {
      toast.error('Failed to start capture');
    } finally {
      loading = false;
    }
  }

  async function stopCapture() {
    try {
      await fetchApi('/api/packets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'stop' }),
      });
      capturing = false;
      stopPolling();
      toast.info('Capture stopped');
    } catch {
      toast.error('Failed to stop capture');
    }
  }

  async function clearPackets() {
    await fetchApi('/api/packets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'clear' }),
    });
    packets = [];
    lastSeenId = 0;
  }

  async function pollPackets() {
    try {
      const res = await fetchApi(`/api/packets?action=packets&since=${lastSeenId}`);
      const data = await res.json();
      if (data.packets?.length > 0) {
        packets = [...packets, ...data.packets];
        lastSeenId = data.packets[data.packets.length - 1].id;
        if (autoScroll && logContainer) {
          requestAnimationFrame(() => {
            logContainer!.scrollTop = logContainer!.scrollHeight;
          });
        }
      }
      if (!data.running && capturing) {
        capturing = false;
        stopPolling();
        toast.info('Capture completed');
      }
    } catch {}
  }

  function startPolling() {
    stopPolling();
    pollInterval = setInterval(pollPackets, 500);
  }

  function stopPolling() {
    if (pollInterval) {
      clearInterval(pollInterval);
      pollInterval = null;
    }
  }

  function protocolColor(proto: string): string {
    switch (proto) {
      case 'IP':
        return 'var(--accent)';
      case 'IPv6':
        return 'var(--info, var(--accent))';
      case 'ARP':
        return 'var(--warning)';
      case 'ICMP':
        return 'var(--success)';
      default:
        return 'var(--text-muted)';
    }
  }

  onMount(() => {
    fetchInterfaces();
    // Check if there's an active capture
    fetchApi('/api/packets?action=status')
      .then((r) => r.json())
      .then((d) => {
        if (d.running) {
          capturing = true;
          startPolling();
        }
      });
  });

  onDestroy(() => {
    stopPolling();
  });
</script>

<svelte:head>
  <title>Packet Sniffer | Home Server</title>
</svelte:head>

<div class="header">
  <h2 class="page-title">Packet Sniffer</h2>
  <div class="header-actions">
    {#if capturing}
      <span class="live-dot"></span>
      <span class="live-label">Capturing</span>
    {/if}
  </div>
</div>
<p class="page-desc">Capture and inspect network packets in real time. Filter by interface, protocol, and port.</p>

<div class="card sudo-warning">
  <strong>Note:</strong> Packet capture typically requires root/sudo privileges. If capture fails, run the server with elevated
  permissions or grant tcpdump appropriate capabilities.
</div>

<div class="controls card">
  <div class="control-row">
    <div class="control-group">
      <label for="iface">Interface</label>
      <select id="iface" bind:value={selectedInterface} disabled={capturing}>
        {#each interfaces as iface}
          <option value={iface}>{iface}</option>
        {/each}
      </select>
    </div>
    <div class="control-group filter-group">
      <label for="filter">Filter Expression</label>
      <input
        id="filter"
        type="text"
        bind:value={filterExpr}
        placeholder="e.g. port 80, host 192.168.1.1"
        disabled={capturing}
      />
    </div>
    <div class="control-group">
      <label for="limit">Packet Limit</label>
      <input id="limit" type="number" bind:value={packetLimit} min={1} max={5000} disabled={capturing} />
    </div>
  </div>
  <div class="control-actions">
    {#if !capturing}
      <button class="btn btn-accent" onclick={startCapture} disabled={loading}>
        {loading ? 'Starting...' : 'Start Capture'}
      </button>
    {:else}
      <button class="btn btn-danger" onclick={stopCapture}>Stop Capture</button>
    {/if}
    <button class="btn" onclick={clearPackets} disabled={capturing}>Clear</button>
    <label class="auto-toggle">
      <input type="checkbox" bind:checked={autoScroll} />
      Auto-scroll
    </label>
    <label class="auto-toggle">
      <input type="checkbox" bind:checked={showRaw} />
      Raw output
    </label>
  </div>
</div>

<div class="terminal-container" bind:this={logContainer}>
  {#if packets.length === 0}
    <div class="terminal-empty">
      {#if capturing}
        Waiting for packets...
      {:else}
        No packets captured. Start a capture to see network traffic.
      {/if}
    </div>
  {:else if showRaw}
    {#each packets as pkt (pkt.id)}
      <div class="raw-line">{pkt.raw}</div>
    {/each}
  {:else}
    <div class="packet-header-row">
      <span class="col-id">#</span>
      <span class="col-time">Time</span>
      <span class="col-proto">Proto</span>
      <span class="col-src">Source</span>
      <span class="col-arrow"></span>
      <span class="col-dst">Destination</span>
      <span class="col-size">Size</span>
    </div>
    {#each packets as pkt (pkt.id)}
      <div class="packet-row">
        <span class="col-id">{pkt.id}</span>
        <span class="col-time">{pkt.timestamp}</span>
        <span class="col-proto" style="color: {protocolColor(pkt.protocol)}">{pkt.protocol}</span>
        <span class="col-src">{pkt.source}</span>
        <span class="col-arrow">&rarr;</span>
        <span class="col-dst">{pkt.destination}</span>
        <span class="col-size">{pkt.size}</span>
      </div>
    {/each}
  {/if}
</div>

<p class="count">{packets.length} packet{packets.length !== 1 ? 's' : ''} captured</p>

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

  .header-actions {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .live-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--danger);
    animation: pulse 1.2s ease-in-out infinite;
  }

  @keyframes pulse {
    0%,
    100% {
      opacity: 1;
    }
    50% {
      opacity: 0.3;
    }
  }

  .live-label {
    font-size: 0.8rem;
    color: var(--danger);
    font-weight: 600;
  }

  .sudo-warning {
    padding: 10px 14px;
    margin-bottom: 12px;
    font-size: 0.8rem;
    color: var(--warning);
    border-left: 3px solid var(--warning);
  }

  .controls {
    padding: 14px;
    margin-bottom: 12px;
  }

  .control-row {
    display: flex;
    gap: 12px;
    margin-bottom: 12px;
    flex-wrap: wrap;
  }

  .control-group {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .control-group label {
    font-size: 0.7rem;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .filter-group {
    flex: 1;
    min-width: 200px;
  }

  .control-group select,
  .control-group input {
    padding: 6px 10px;
    font-size: 0.82rem;
    border: 1px solid var(--border);
    border-radius: 6px;
    background: var(--bg-primary);
    color: var(--text-primary);
    font-family: inherit;
  }

  .control-group input[type='number'] {
    width: 90px;
  }

  .control-actions {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
  }

  .btn {
    padding: 6px 14px;
    font-size: 0.8rem;
    border-radius: 6px;
    border: 1px solid var(--border);
    background: var(--btn-bg);
    color: var(--text-secondary);
    cursor: pointer;
    font-family: inherit;
  }

  .btn:hover:not(:disabled) {
    border-color: var(--accent);
  }

  .btn:disabled {
    opacity: 0.5;
    cursor: default;
  }

  .btn-accent {
    background: var(--accent);
    color: #fff;
    border-color: var(--accent);
  }

  .btn-accent:hover:not(:disabled) {
    filter: brightness(1.1);
  }

  .btn-danger {
    background: var(--danger);
    color: #fff;
    border-color: var(--danger);
  }

  .btn-danger:hover:not(:disabled) {
    filter: brightness(1.1);
  }

  .auto-toggle {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 0.78rem;
    color: var(--text-secondary);
    cursor: pointer;
    margin-left: 4px;
  }

  .terminal-container {
    background: #0d1117;
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 8px 0;
    height: 480px;
    overflow-y: auto;
    font-family: 'JetBrains Mono', 'SF Mono', 'Fira Code', monospace;
    font-size: 0.75rem;
    line-height: 1.5;
  }

  .terminal-empty {
    padding: 40px;
    text-align: center;
    color: #6e7681;
  }

  .packet-header-row {
    display: grid;
    grid-template-columns: 50px 110px 50px 1fr 20px 1fr 60px;
    padding: 4px 12px;
    color: #6e7681;
    font-size: 0.68rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    border-bottom: 1px solid #21262d;
    position: sticky;
    top: 0;
    background: #0d1117;
    z-index: 1;
  }

  .packet-row {
    display: grid;
    grid-template-columns: 50px 110px 50px 1fr 20px 1fr 60px;
    padding: 2px 12px;
    color: #e1e4e8;
  }

  .packet-row:hover {
    background: #161b22;
  }

  .col-id {
    color: #6e7681;
  }

  .col-time {
    color: #8b949e;
  }

  .col-arrow {
    color: #6e7681;
    text-align: center;
  }

  .col-size {
    color: #8b949e;
    text-align: right;
  }

  .raw-line {
    padding: 1px 12px;
    color: #c9d1d9;
    word-break: break-all;
  }

  .raw-line:hover {
    background: #161b22;
  }

  .count {
    font-size: 0.75rem;
    color: var(--text-muted);
    margin-top: 8px;
    text-align: right;
  }

  @media (max-width: 768px) {
    .packet-header-row,
    .packet-row {
      grid-template-columns: 40px 90px 45px 1fr 16px 1fr;
    }
    .col-size {
      display: none;
    }
    .terminal-container {
      height: 360px;
    }
  }
</style>
