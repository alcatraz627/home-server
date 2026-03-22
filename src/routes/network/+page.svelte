<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { toast } from '$lib/toast';

  // ---- Types ----
  interface TracerouteHop {
    hop: number;
    host: string;
    ip: string;
    rtt: string[];
  }

  interface ArpEntry {
    ip: string;
    mac: string;
    interface: string;
    vendor: string;
  }

  interface PingResult {
    ip: string;
    alive: boolean;
    time: number;
  }

  interface SSLCertInfo {
    subject: string;
    issuer: string;
    validFrom: string;
    validTo: string;
    sans: string[];
    serial: string;
    signatureAlgo: string;
    isExpired: boolean;
    daysRemaining: number;
  }

  interface InterfaceStats {
    name: string;
    bytesIn: number;
    bytesOut: number;
    packetsIn: number;
    packetsOut: number;
  }

  interface BandwidthSample {
    timestamp: number;
    interfaces: Record<string, { bytesInPerSec: number; bytesOutPerSec: number }>;
  }

  interface HttpInspection {
    status: number;
    statusText: string;
    headers: Record<string, string>;
    timing: { total: number };
  }

  // ---- Tab state ----
  type TabId = 'traceroute' | 'ping' | 'arp' | 'whois' | 'bandwidth' | 'ssl' | 'http';
  const tabs: { id: TabId; label: string }[] = [
    { id: 'traceroute', label: 'Traceroute' },
    { id: 'ping', label: 'Ping Sweep' },
    { id: 'arp', label: 'ARP Table' },
    { id: 'whois', label: 'Whois' },
    { id: 'bandwidth', label: 'Bandwidth' },
    { id: 'ssl', label: 'SSL Inspector' },
    { id: 'http', label: 'HTTP Headers' },
  ];
  let activeTab = $state<TabId>('traceroute');

  // ---- Traceroute ----
  let trTarget = $state('');
  let trLoading = $state(false);
  let trHops = $state<TracerouteHop[]>([]);
  let trRaw = $state('');

  async function runTraceroute() {
    if (!trTarget.trim()) return toast.warning('Enter a hostname or IP');
    trLoading = true;
    trHops = [];
    trRaw = '';
    try {
      const res = await fetch('/api/network', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tool: 'traceroute', target: trTarget.trim() }),
      });
      const data = await res.json();
      trHops = data.hops || [];
      trRaw = data.raw || '';
      if (trHops.length === 0) toast.warning('No hops returned');
      else toast.success(`Traceroute complete: ${trHops.length} hops`);
    } catch {
      toast.error('Traceroute failed');
    } finally {
      trLoading = false;
    }
  }

  // ---- Ping Sweep ----
  let pingSubnet = $state('192.168.1.0/24');
  let pingLoading = $state(false);
  let pingResults = $state<PingResult[]>([]);

  async function runPingSweep() {
    if (!pingSubnet.trim()) return toast.warning('Enter a subnet');
    pingLoading = true;
    pingResults = [];
    try {
      const res = await fetch('/api/network', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tool: 'ping-sweep', subnet: pingSubnet.trim() }),
      });
      const data = await res.json();
      if (data.error) {
        toast.error(data.error);
      } else {
        pingResults = data.results || [];
        const alive = pingResults.filter((r) => r.alive).length;
        toast.success(`Sweep complete: ${alive} hosts alive`);
      }
    } catch {
      toast.error('Ping sweep failed');
    } finally {
      pingLoading = false;
    }
  }

  // ---- ARP ----
  let arpEntries = $state<ArpEntry[]>([]);
  let arpLoading = $state(false);

  async function fetchArp() {
    arpLoading = true;
    try {
      const res = await fetch('/api/network?tool=arp');
      const data = await res.json();
      arpEntries = data.entries || [];
      toast.success(`${arpEntries.length} ARP entries loaded`);
    } catch {
      toast.error('Failed to load ARP table');
    } finally {
      arpLoading = false;
    }
  }

  // ---- Whois ----
  let whoisTarget = $state('');
  let whoisLoading = $state(false);
  let whoisResult = $state('');

  async function runWhois() {
    if (!whoisTarget.trim()) return toast.warning('Enter a domain or IP');
    whoisLoading = true;
    whoisResult = '';
    try {
      const res = await fetch('/api/network', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tool: 'whois', target: whoisTarget.trim() }),
      });
      const data = await res.json();
      whoisResult = data.result || 'No result';
      toast.success('Whois lookup complete');
    } catch {
      toast.error('Whois lookup failed');
    } finally {
      whoisLoading = false;
    }
  }

  // ---- Bandwidth Monitor ----
  let bwSamples = $state<BandwidthSample[]>([]);
  let bwPrevStats = $state<InterfaceStats[] | null>(null);
  let bwPrevTime = $state(0);
  let bwRunning = $state(false);
  let bwInterval: ReturnType<typeof setInterval> | null = null;
  const BW_MAX = 60;

  async function fetchBandwidth() {
    try {
      const now = Date.now();
      const res = await fetch('/api/network?tool=bandwidth');
      const data = await res.json();
      const stats: InterfaceStats[] = data.stats || [];

      if (bwPrevStats && bwPrevTime > 0) {
        const elapsed = (now - bwPrevTime) / 1000;
        const ifaceData: Record<string, { bytesInPerSec: number; bytesOutPerSec: number }> = {};
        for (const s of stats) {
          const prev = bwPrevStats.find((p) => p.name === s.name);
          if (prev) {
            ifaceData[s.name] = {
              bytesInPerSec: Math.max(0, (s.bytesIn - prev.bytesIn) / elapsed),
              bytesOutPerSec: Math.max(0, (s.bytesOut - prev.bytesOut) / elapsed),
            };
          }
        }
        bwSamples = [...bwSamples.slice(-(BW_MAX - 1)), { timestamp: now, interfaces: ifaceData }];
      }

      bwPrevStats = stats;
      bwPrevTime = now;
    } catch {}
  }

  function startBandwidth() {
    bwRunning = true;
    bwSamples = [];
    bwPrevStats = null;
    bwPrevTime = 0;
    fetchBandwidth();
    bwInterval = setInterval(fetchBandwidth, 1000);
    toast.info('Bandwidth monitoring started');
  }

  function stopBandwidth() {
    bwRunning = false;
    if (bwInterval) clearInterval(bwInterval);
    bwInterval = null;
    toast.info('Bandwidth monitoring stopped');
  }

  const bwInterfaces = $derived.by(() => {
    const names = new Set<string>();
    for (const s of bwSamples) {
      for (const k of Object.keys(s.interfaces)) names.add(k);
    }
    return [...names].sort();
  });

  let bwSelectedIface = $state('');

  const bwChartData = $derived.by(() => {
    const iface = bwSelectedIface || bwInterfaces[0] || '';
    if (!iface) return { inData: [], outData: [] };
    const inData = bwSamples.map((s) => s.interfaces[iface]?.bytesInPerSec || 0);
    const outData = bwSamples.map((s) => s.interfaces[iface]?.bytesOutPerSec || 0);
    return { inData, outData };
  });

  function bwPath(values: number[], width: number, height: number): string {
    if (values.length < 2) return '';
    const max = Math.max(...values, 1);
    const step = width / (values.length - 1);
    return values
      .map((v, i) => `${i === 0 ? 'M' : 'L'}${(i * step).toFixed(1)},${(height - (v / max) * height).toFixed(1)}`)
      .join(' ');
  }

  function bwArea(values: number[], width: number, height: number): string {
    const line = bwPath(values, width, height);
    if (!line) return '';
    const lastX = ((values.length - 1) * width) / (values.length - 1);
    return `${line} L${lastX.toFixed(1)},${height} L0,${height} Z`;
  }

  function formatBytesPerSec(b: number): string {
    if (b < 1024) return `${b.toFixed(0)} B/s`;
    if (b < 1048576) return `${(b / 1024).toFixed(1)} KB/s`;
    return `${(b / 1048576).toFixed(1)} MB/s`;
  }

  // ---- SSL Inspector ----
  let sslDomain = $state('');
  let sslLoading = $state(false);
  let sslCert = $state<SSLCertInfo | null>(null);
  let sslError = $state('');

  async function inspectSSL() {
    if (!sslDomain.trim()) return toast.warning('Enter a domain name');
    sslLoading = true;
    sslCert = null;
    sslError = '';
    try {
      const res = await fetch('/api/network', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tool: 'ssl', domain: sslDomain.trim() }),
      });
      const data = await res.json();
      if (data.error) {
        sslError = data.error;
        toast.error('SSL inspection failed');
      } else {
        sslCert = data.cert;
        toast.success('Certificate retrieved');
      }
    } catch {
      toast.error('SSL inspection failed');
    } finally {
      sslLoading = false;
    }
  }

  // ---- HTTP Header Inspector ----
  let httpUrl = $state('');
  let httpLoading = $state(false);
  let httpResult = $state<HttpInspection | null>(null);
  let httpError = $state('');

  async function inspectHTTP() {
    if (!httpUrl.trim()) return toast.warning('Enter a URL');
    httpLoading = true;
    httpResult = null;
    httpError = '';
    try {
      const res = await fetch('/api/network', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tool: 'http-headers', url: httpUrl.trim() }),
      });
      const data = await res.json();
      if (data.error) {
        httpError = data.error;
        toast.error('HTTP inspection failed');
      } else {
        httpResult = data.inspection;
        toast.success(`${data.inspection.status} ${data.inspection.statusText}`);
      }
    } catch {
      toast.error('HTTP inspection failed');
    } finally {
      httpLoading = false;
    }
  }

  function statusColor(code: number): string {
    if (code < 300) return 'var(--success)';
    if (code < 400) return 'var(--accent)';
    if (code < 500) return 'var(--warning)';
    return 'var(--danger)';
  }

  // ---- Lifecycle ----
  onDestroy(() => {
    if (bwInterval) clearInterval(bwInterval);
  });
</script>

<svelte:head>
  <title>Network Toolkit | Home Server</title>
</svelte:head>

<div class="header">
  <h2>Network Toolkit</h2>
</div>

<div class="tab-bar">
  {#each tabs as tab (tab.id)}
    <button class="tab-btn" class:active={activeTab === tab.id} onclick={() => (activeTab = tab.id)}>
      {tab.label}
    </button>
  {/each}
</div>

<div class="tab-content">
  <!-- Traceroute -->
  {#if activeTab === 'traceroute'}
    <div class="tool-section">
      <div class="input-row">
        <input
          type="text"
          bind:value={trTarget}
          placeholder="Hostname or IP (e.g. google.com)"
          onkeydown={(e) => e.key === 'Enter' && runTraceroute()}
          class="input-field"
        />
        <button class="btn btn-accent" onclick={runTraceroute} disabled={trLoading}>
          {trLoading ? 'Tracing...' : 'Trace'}
        </button>
      </div>

      {#if trHops.length > 0}
        <div class="trace-visual">
          {#each trHops as hop, i (hop.hop)}
            <div class="trace-hop">
              <div class="hop-num">{hop.hop}</div>
              <div class="hop-connector">
                <div class="hop-dot" class:timeout={hop.host === '*'}></div>
                {#if i < trHops.length - 1}
                  <div class="hop-line"></div>
                {/if}
              </div>
              <div class="hop-info">
                <span class="hop-host" class:timeout={hop.host === '*'}>
                  {hop.host === '*' ? '* * *' : hop.host}
                </span>
                {#if hop.ip && hop.ip !== '*'}
                  <code class="hop-ip">{hop.ip}</code>
                {/if}
                <span class="hop-rtt">{hop.rtt.join(' / ')}</span>
              </div>
            </div>
          {/each}
        </div>
      {/if}
    </div>

    <!-- Ping Sweep -->
  {:else if activeTab === 'ping'}
    <div class="tool-section">
      <div class="input-row">
        <input
          type="text"
          bind:value={pingSubnet}
          placeholder="192.168.1.0/24"
          onkeydown={(e) => e.key === 'Enter' && runPingSweep()}
          class="input-field"
        />
        <button class="btn btn-accent" onclick={runPingSweep} disabled={pingLoading}>
          {pingLoading ? 'Scanning...' : 'Sweep'}
        </button>
      </div>
      <p class="hint">Only /24 subnets are supported. Scan may take 30-60 seconds.</p>

      {#if pingLoading}
        <div class="loading-bar">
          <div class="loading-fill"></div>
        </div>
      {/if}

      {#if pingResults.length > 0}
        {@const alive = pingResults.filter((r) => r.alive)}
        <p class="result-summary">
          {alive.length} alive / {pingResults.length} scanned
        </p>
        <div class="ping-grid">
          {#each pingResults as r (r.ip)}
            {@const lastOctet = r.ip.split('.')[3]}
            <div
              class="ping-cell"
              class:alive={r.alive}
              title="{r.ip}{r.alive ? ` (${r.time.toFixed(1)}ms)` : ' (unreachable)'}"
            >
              {lastOctet}
            </div>
          {/each}
        </div>
      {/if}
    </div>

    <!-- ARP Table -->
  {:else if activeTab === 'arp'}
    <div class="tool-section">
      <div class="input-row">
        <button class="btn btn-accent" onclick={fetchArp} disabled={arpLoading}>
          {arpLoading ? 'Loading...' : 'Refresh ARP Table'}
        </button>
      </div>

      {#if arpEntries.length > 0}
        <div class="table-wrapper">
          <table class="data-table">
            <thead>
              <tr>
                <th>IP Address</th>
                <th>MAC Address</th>
                <th>Interface</th>
                <th>Vendor</th>
              </tr>
            </thead>
            <tbody>
              {#each arpEntries as entry (entry.ip + entry.mac)}
                <tr>
                  <td><code>{entry.ip}</code></td>
                  <td><code>{entry.mac}</code></td>
                  <td>{entry.interface}</td>
                  <td class="vendor">{entry.vendor || '—'}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {:else if !arpLoading}
        <p class="empty">Click refresh to load the ARP table.</p>
      {/if}
    </div>

    <!-- Whois -->
  {:else if activeTab === 'whois'}
    <div class="tool-section">
      <div class="input-row">
        <input
          type="text"
          bind:value={whoisTarget}
          placeholder="Domain or IP (e.g. example.com)"
          onkeydown={(e) => e.key === 'Enter' && runWhois()}
          class="input-field"
        />
        <button class="btn btn-accent" onclick={runWhois} disabled={whoisLoading}>
          {whoisLoading ? 'Looking up...' : 'Lookup'}
        </button>
      </div>

      {#if whoisResult}
        <div class="whois-output">
          <pre><code>{whoisResult}</code></pre>
        </div>
      {/if}
    </div>

    <!-- Bandwidth Monitor -->
  {:else if activeTab === 'bandwidth'}
    <div class="tool-section">
      <div class="input-row">
        {#if !bwRunning}
          <button class="btn btn-accent" onclick={startBandwidth}>Start Monitoring</button>
        {:else}
          <button class="btn btn-danger" onclick={stopBandwidth}>Stop Monitoring</button>
        {/if}
        {#if bwInterfaces.length > 0}
          <select bind:value={bwSelectedIface} class="iface-select">
            {#each bwInterfaces as iface}
              <option value={iface}>{iface}</option>
            {/each}
          </select>
        {/if}
      </div>

      {#if bwSamples.length > 1}
        {@const iface = bwSelectedIface || bwInterfaces[0] || ''}
        {@const latest = bwSamples[bwSamples.length - 1]?.interfaces[iface]}
        {#if latest}
          <div class="bw-stats">
            <div class="bw-stat">
              <span class="bw-label">Download</span>
              <span class="bw-value dl">{formatBytesPerSec(latest.bytesInPerSec)}</span>
            </div>
            <div class="bw-stat">
              <span class="bw-label">Upload</span>
              <span class="bw-value ul">{formatBytesPerSec(latest.bytesOutPerSec)}</span>
            </div>
          </div>
        {/if}

        <div class="bw-chart-wrap">
          <svg viewBox="0 0 600 200" class="bw-chart">
            <!-- Grid lines -->
            {#each [0, 1, 2, 3, 4] as i}
              <line x1="0" y1={i * 50} x2="600" y2={i * 50} stroke="#21262d" stroke-width="0.5" />
            {/each}
            <!-- Download area -->
            <path d={bwArea(bwChartData.inData, 600, 200)} fill="rgba(56, 139, 253, 0.15)" />
            <path d={bwPath(bwChartData.inData, 600, 200)} fill="none" stroke="#388bfd" stroke-width="1.5" />
            <!-- Upload area -->
            <path d={bwArea(bwChartData.outData, 600, 200)} fill="rgba(63, 185, 80, 0.15)" />
            <path d={bwPath(bwChartData.outData, 600, 200)} fill="none" stroke="#3fb950" stroke-width="1.5" />
          </svg>
          <div class="bw-legend">
            <span class="legend-item"><span class="legend-dot dl"></span> Download</span>
            <span class="legend-item"><span class="legend-dot ul"></span> Upload</span>
          </div>
        </div>
      {:else if bwRunning}
        <p class="hint">Collecting data... chart will appear in a moment.</p>
      {:else}
        <p class="empty">Start monitoring to see real-time bandwidth usage.</p>
      {/if}
    </div>

    <!-- SSL Certificate Inspector -->
  {:else if activeTab === 'ssl'}
    <div class="tool-section">
      <div class="input-row">
        <input
          type="text"
          bind:value={sslDomain}
          placeholder="Domain (e.g. github.com)"
          onkeydown={(e) => e.key === 'Enter' && inspectSSL()}
          class="input-field"
        />
        <button class="btn btn-accent" onclick={inspectSSL} disabled={sslLoading}>
          {sslLoading ? 'Inspecting...' : 'Inspect'}
        </button>
      </div>

      {#if sslError}
        <p class="error-msg">{sslError}</p>
      {/if}

      {#if sslCert}
        <div class="ssl-card card">
          <div
            class="ssl-header"
            class:expired={sslCert.isExpired}
            class:expiring={!sslCert.isExpired && sslCert.daysRemaining < 30}
          >
            <span
              class="ssl-status-dot"
              class:expired={sslCert.isExpired}
              class:expiring={!sslCert.isExpired && sslCert.daysRemaining < 30}
            ></span>
            {#if sslCert.isExpired}
              EXPIRED
            {:else if sslCert.daysRemaining < 30}
              Expires in {sslCert.daysRemaining} days
            {:else}
              Valid ({sslCert.daysRemaining} days remaining)
            {/if}
          </div>
          <div class="ssl-grid">
            <div class="ssl-item">
              <span class="ssl-label">Subject</span>
              <span class="ssl-value">{sslCert.subject}</span>
            </div>
            <div class="ssl-item">
              <span class="ssl-label">Issuer</span>
              <span class="ssl-value">{sslCert.issuer}</span>
            </div>
            <div class="ssl-item">
              <span class="ssl-label">Valid From</span>
              <span class="ssl-value">{sslCert.validFrom}</span>
            </div>
            <div class="ssl-item">
              <span class="ssl-label">Valid To</span>
              <span class="ssl-value">{sslCert.validTo}</span>
            </div>
            {#if sslCert.serial}
              <div class="ssl-item">
                <span class="ssl-label">Serial</span>
                <code class="ssl-value">{sslCert.serial}</code>
              </div>
            {/if}
            {#if sslCert.signatureAlgo}
              <div class="ssl-item">
                <span class="ssl-label">Signature Algorithm</span>
                <span class="ssl-value">{sslCert.signatureAlgo}</span>
              </div>
            {/if}
            {#if sslCert.sans.length > 0}
              <div class="ssl-item ssl-sans">
                <span class="ssl-label">Subject Alt Names</span>
                <div class="san-list">
                  {#each sslCert.sans as san}
                    <code class="san-tag">{san}</code>
                  {/each}
                </div>
              </div>
            {/if}
          </div>
        </div>
      {/if}
    </div>

    <!-- HTTP Header Inspector -->
  {:else if activeTab === 'http'}
    <div class="tool-section">
      <div class="input-row">
        <input
          type="text"
          bind:value={httpUrl}
          placeholder="URL (e.g. https://example.com)"
          onkeydown={(e) => e.key === 'Enter' && inspectHTTP()}
          class="input-field"
        />
        <button class="btn btn-accent" onclick={inspectHTTP} disabled={httpLoading}>
          {httpLoading ? 'Fetching...' : 'Inspect'}
        </button>
      </div>

      {#if httpError}
        <p class="error-msg">{httpError}</p>
      {/if}

      {#if httpResult}
        <div class="http-result card">
          <div class="http-status-row">
            <span class="http-status" style="color: {statusColor(httpResult.status)}">
              {httpResult.status}
            </span>
            <span class="http-status-text">{httpResult.statusText}</span>
            <span class="http-timing">{httpResult.timing.total} ms</span>
          </div>
          <div class="http-headers">
            <h4>Response Headers</h4>
            <div class="headers-list">
              {#each Object.entries(httpResult.headers) as [key, value]}
                <div class="header-entry">
                  <span class="header-key">{key}</span>
                  <span class="header-value">{value}</span>
                </div>
              {/each}
            </div>
          </div>
        </div>
      {/if}
    </div>
  {/if}
</div>

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

  /* Tab bar */
  .tab-bar {
    display: flex;
    gap: 2px;
    border-bottom: 1px solid var(--border);
    margin-bottom: 16px;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
  }

  .tab-btn {
    padding: 8px 16px;
    font-size: 0.8rem;
    border: none;
    background: none;
    color: var(--text-muted);
    cursor: pointer;
    white-space: nowrap;
    border-bottom: 2px solid transparent;
    font-family: inherit;
    transition:
      color 0.15s,
      border-color 0.15s;
  }

  .tab-btn:hover {
    color: var(--text-secondary);
  }

  .tab-btn.active {
    color: var(--accent);
    border-bottom-color: var(--accent);
  }

  .tab-content {
    min-height: 300px;
  }

  /* Shared tool styles */
  .tool-section {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .input-row {
    display: flex;
    gap: 8px;
    align-items: center;
  }

  .input-field {
    flex: 1;
    padding: 8px 12px;
    font-size: 0.85rem;
    border: 1px solid var(--border);
    border-radius: 6px;
    background: var(--bg-primary);
    color: var(--text-primary);
    font-family: inherit;
  }

  .input-field:focus {
    outline: none;
    border-color: var(--accent);
  }

  .btn {
    padding: 8px 16px;
    font-size: 0.8rem;
    border-radius: 6px;
    border: 1px solid var(--border);
    background: var(--btn-bg);
    color: var(--text-secondary);
    cursor: pointer;
    font-family: inherit;
    white-space: nowrap;
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

  .hint {
    font-size: 0.75rem;
    color: var(--text-muted);
  }

  .empty {
    color: var(--text-muted);
    text-align: center;
    padding: 40px;
    font-size: 0.85rem;
  }

  .error-msg {
    color: var(--danger);
    font-size: 0.85rem;
  }

  .result-summary {
    font-size: 0.82rem;
    color: var(--text-secondary);
  }

  code {
    font-size: 0.8rem;
  }

  /* Traceroute */
  .trace-visual {
    display: flex;
    flex-direction: column;
  }

  .trace-hop {
    display: flex;
    align-items: flex-start;
    gap: 12px;
  }

  .hop-num {
    width: 24px;
    text-align: right;
    font-size: 0.72rem;
    color: var(--text-muted);
    padding-top: 3px;
    flex-shrink: 0;
  }

  .hop-connector {
    display: flex;
    flex-direction: column;
    align-items: center;
    flex-shrink: 0;
    width: 12px;
  }

  .hop-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: var(--accent);
    flex-shrink: 0;
  }

  .hop-dot.timeout {
    background: var(--text-faint, var(--border));
  }

  .hop-line {
    width: 2px;
    height: 24px;
    background: var(--border);
  }

  .hop-info {
    display: flex;
    flex-wrap: wrap;
    gap: 4px 10px;
    align-items: center;
    padding: 2px 0 8px;
    font-size: 0.82rem;
  }

  .hop-host {
    color: var(--text-primary);
    font-weight: 500;
  }

  .hop-host.timeout {
    color: var(--text-muted);
    font-style: italic;
  }

  .hop-ip {
    color: var(--text-muted);
    font-size: 0.78rem;
  }

  .hop-rtt {
    color: var(--text-muted);
    font-size: 0.72rem;
  }

  /* Ping grid */
  .ping-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(44px, 1fr));
    gap: 3px;
  }

  .ping-cell {
    text-align: center;
    font-size: 0.68rem;
    padding: 4px 2px;
    border-radius: 4px;
    background: color-mix(in srgb, var(--danger) 10%, var(--bg-secondary));
    color: var(--text-muted);
    cursor: default;
    font-family: 'JetBrains Mono', 'SF Mono', monospace;
  }

  .ping-cell.alive {
    background: color-mix(in srgb, var(--success) 20%, var(--bg-secondary));
    color: var(--success);
    font-weight: 600;
  }

  .loading-bar {
    height: 3px;
    background: var(--border);
    border-radius: 2px;
    overflow: hidden;
  }

  .loading-fill {
    height: 100%;
    width: 40%;
    background: var(--accent);
    border-radius: 2px;
    animation: loading-slide 1.2s ease-in-out infinite;
  }

  @keyframes loading-slide {
    0% {
      transform: translateX(-100%);
    }
    100% {
      transform: translateX(350%);
    }
  }

  /* ARP + data table */
  .table-wrapper {
    border: 1px solid var(--border);
    border-radius: 8px;
    overflow: auto;
  }

  .data-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.82rem;
  }

  .data-table thead {
    background: var(--bg-secondary);
  }

  .data-table th {
    padding: 10px 14px;
    text-align: left;
    font-size: 0.72rem;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    font-weight: 600;
  }

  .data-table td {
    padding: 8px 14px;
    border-top: 1px solid var(--border-subtle, var(--border));
    color: var(--text-secondary);
  }

  .data-table tr:hover {
    background: var(--bg-secondary);
  }

  .vendor {
    color: var(--text-muted);
    font-size: 0.78rem;
  }

  /* Whois */
  .whois-output {
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--bg-secondary);
    max-height: 500px;
    overflow: auto;
  }

  .whois-output pre {
    padding: 14px;
    margin: 0;
    font-size: 0.75rem;
    line-height: 1.5;
    white-space: pre-wrap;
    word-break: break-word;
    color: var(--text-secondary);
  }

  /* Bandwidth */
  .iface-select {
    padding: 8px 12px;
    font-size: 0.82rem;
    border: 1px solid var(--border);
    border-radius: 6px;
    background: var(--bg-primary);
    color: var(--text-primary);
    font-family: inherit;
  }

  .bw-stats {
    display: flex;
    gap: 24px;
  }

  .bw-stat {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .bw-label {
    font-size: 0.7rem;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .bw-value {
    font-size: 1.1rem;
    font-weight: 600;
  }

  .bw-value.dl {
    color: #388bfd;
  }

  .bw-value.ul {
    color: #3fb950;
  }

  .bw-chart-wrap {
    border: 1px solid var(--border);
    border-radius: 8px;
    overflow: hidden;
    background: #0d1117;
    padding: 12px;
  }

  .bw-chart {
    width: 100%;
    height: auto;
  }

  .bw-legend {
    display: flex;
    gap: 16px;
    padding: 8px 0 0;
    justify-content: center;
  }

  .legend-item {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 0.72rem;
    color: #8b949e;
  }

  .legend-dot {
    width: 8px;
    height: 3px;
    border-radius: 1px;
  }

  .legend-dot.dl {
    background: #388bfd;
  }

  .legend-dot.ul {
    background: #3fb950;
  }

  /* SSL */
  .ssl-card {
    padding: 16px;
  }

  .ssl-header {
    font-size: 0.85rem;
    font-weight: 600;
    color: var(--success);
    margin-bottom: 14px;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .ssl-header.expired {
    color: var(--danger);
  }

  .ssl-header.expiring {
    color: var(--warning);
  }

  .ssl-status-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--success);
    flex-shrink: 0;
  }

  .ssl-status-dot.expired {
    background: var(--danger);
  }

  .ssl-status-dot.expiring {
    background: var(--warning);
  }

  .ssl-grid {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .ssl-item {
    display: flex;
    gap: 12px;
    align-items: baseline;
    font-size: 0.82rem;
  }

  .ssl-label {
    flex-shrink: 0;
    width: 140px;
    font-size: 0.72rem;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .ssl-value {
    color: var(--text-secondary);
    word-break: break-all;
  }

  .ssl-sans {
    align-items: flex-start;
  }

  .san-list {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }

  .san-tag {
    font-size: 0.72rem;
    padding: 2px 8px;
    border-radius: 10px;
    background: var(--bg-secondary);
    color: var(--text-secondary);
  }

  /* HTTP Headers */
  .http-result {
    padding: 16px;
  }

  .http-status-row {
    display: flex;
    align-items: baseline;
    gap: 10px;
    margin-bottom: 16px;
  }

  .http-status {
    font-size: 1.4rem;
    font-weight: 700;
    font-family: 'JetBrains Mono', 'SF Mono', monospace;
  }

  .http-status-text {
    font-size: 0.9rem;
    color: var(--text-secondary);
  }

  .http-timing {
    font-size: 0.78rem;
    color: var(--text-muted);
    margin-left: auto;
  }

  .http-headers h4 {
    font-size: 0.75rem;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-bottom: 8px;
  }

  .headers-list {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .header-entry {
    display: flex;
    gap: 8px;
    padding: 4px 0;
    border-bottom: 1px solid var(--border-subtle, var(--border));
    font-size: 0.8rem;
  }

  .header-key {
    color: var(--accent);
    font-weight: 500;
    white-space: nowrap;
    flex-shrink: 0;
    font-family: 'JetBrains Mono', 'SF Mono', monospace;
    font-size: 0.75rem;
  }

  .header-value {
    color: var(--text-secondary);
    word-break: break-all;
    font-family: 'JetBrains Mono', 'SF Mono', monospace;
    font-size: 0.75rem;
  }

  @media (max-width: 640px) {
    .tab-btn {
      padding: 6px 10px;
      font-size: 0.72rem;
    }
    .ssl-item {
      flex-direction: column;
      gap: 2px;
    }
    .ssl-label {
      width: auto;
    }
  }
</style>
