<script lang="ts">
  import { toast } from '$lib/toast';
  import { fetchApi } from '$lib/api';

  interface SpeedResult {
    download: number; // Mbps
    upload: number; // Mbps
    latency: number; // ms
    timestamp: string;
  }

  let testMode = $state<'local' | 'external'>('local');
  let running = $state(false);
  let phase = $state<'idle' | 'latency' | 'download' | 'upload' | 'done'>('idle');
  let progress = $state(0);
  let latency = $state(0);
  let downloadSpeed = $state(0);
  let uploadSpeed = $state(0);
  let history = $state<SpeedResult[]>([]);

  function loadHistory() {
    try {
      const raw = localStorage.getItem('speedtest-history');
      if (raw) history = JSON.parse(raw);
    } catch {
      // ignore
    }
  }

  function saveHistory() {
    try {
      localStorage.setItem('speedtest-history', JSON.stringify(history.slice(0, 20)));
    } catch {
      // ignore
    }
  }

  if (typeof window !== 'undefined') {
    loadHistory();
  }

  async function measureLatency(): Promise<number> {
    const pings: number[] = [];
    for (let i = 0; i < 5; i++) {
      const start = performance.now();
      await fetchApi('/api/speedtest?action=ping', { cache: 'no-store' });
      pings.push(performance.now() - start);
    }
    // Remove highest, average the rest
    pings.sort((a, b) => a - b);
    pings.pop();
    return Math.round(pings.reduce((a, b) => a + b, 0) / pings.length);
  }

  async function measureDownload(): Promise<number> {
    const sizes = [512, 1024, 2048, 4096]; // KB
    let totalBytes = 0;
    let totalTime = 0;

    for (let i = 0; i < sizes.length; i++) {
      progress = ((i + 1) / sizes.length) * 100;
      const start = performance.now();
      const res = await fetchApi(`/api/speedtest?action=download&size=${sizes[i]}`, {
        cache: 'no-store',
      });
      const blob = await res.blob();
      const elapsed = (performance.now() - start) / 1000; // seconds
      totalBytes += blob.size;
      totalTime += elapsed;
    }

    // bits per second -> Mbps
    return (totalBytes * 8) / totalTime / 1_000_000;
  }

  async function measureUpload(): Promise<number> {
    const sizes = [256, 512, 1024, 2048]; // KB
    let totalBytes = 0;
    let totalTime = 0;

    for (let i = 0; i < sizes.length; i++) {
      progress = ((i + 1) / sizes.length) * 100;
      const data = new Uint8Array(sizes[i] * 1024);
      // crypto.getRandomValues has a 65536-byte limit per call — fill in chunks
      for (let off = 0; off < data.length; off += 65536) {
        crypto.getRandomValues(data.subarray(off, Math.min(off + 65536, data.length)));
      }
      const start = performance.now();
      await fetchApi('/api/speedtest', {
        method: 'POST',
        body: data,
      });
      const elapsed = (performance.now() - start) / 1000;
      totalBytes += data.byteLength;
      totalTime += elapsed;
    }

    return (totalBytes * 8) / totalTime / 1_000_000;
  }

  async function runExternalTest() {
    running = true;
    phase = 'download';
    progress = 50;
    try {
      const res = await fetchApi('/api/speedtest?action=external');
      if (!res.ok) throw new Error((await res.json()).error || 'Failed');
      const data = await res.json();
      latency = data.latency;
      downloadSpeed = data.download;
      uploadSpeed = data.upload;
      phase = 'done';
      progress = 100;

      const result: SpeedResult = {
        download: data.download,
        upload: data.upload,
        latency: data.latency,
        timestamp: new Date().toISOString(),
      };
      history = [result, ...history].slice(0, 20);
      saveHistory();
      toast.success(`External test via ${data.server}`);
    } catch (e: any) {
      toast.error(e.message || 'External test failed');
      phase = 'idle';
    } finally {
      running = false;
    }
  }

  async function runTest() {
    running = true;
    latency = 0;
    downloadSpeed = 0;
    uploadSpeed = 0;
    progress = 0;

    if (testMode === 'external') {
      await runExternalTest();
      return;
    }

    try {
      // Latency
      phase = 'latency';
      latency = await measureLatency();

      // Download
      phase = 'download';
      progress = 0;
      downloadSpeed = await measureDownload();

      // Upload
      phase = 'upload';
      progress = 0;
      uploadSpeed = await measureUpload();

      phase = 'done';
      progress = 100;

      // Save to history
      const result: SpeedResult = {
        download: Math.round(downloadSpeed * 100) / 100,
        upload: Math.round(uploadSpeed * 100) / 100,
        latency,
        timestamp: new Date().toISOString(),
      };
      history = [result, ...history].slice(0, 20);
      saveHistory();

      toast.success('Speed test complete');
    } catch {
      toast.error('Speed test failed');
      phase = 'idle';
    } finally {
      running = false;
    }
  }

  function formatSpeed(mbps: number): string {
    if (mbps >= 1000) return `${(mbps / 1000).toFixed(2)} Gbps`;
    return `${mbps.toFixed(2)} Mbps`;
  }

  function formatTime(ts: string): string {
    return new Date(ts).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  function gaugeAngle(value: number, max: number): number {
    return Math.min((value / max) * 180, 180);
  }
</script>

<div class="page">
  <h2 class="page-title">Speed Test</h2>
  <p class="page-desc">
    Measure LAN throughput between your browser and this server. Tests latency, download, and upload speeds.
  </p>

  <div class="phases-info card">
    <div class="phase-step">
      <span class="phase-num">1</span>
      <div class="phase-desc">
        <strong>Latency</strong>
        <span>Pings the server 5 times and averages the round-trip time</span>
      </div>
    </div>
    <div class="phase-arrow">&rarr;</div>
    <div class="phase-step">
      <span class="phase-num">2</span>
      <div class="phase-desc">
        <strong>Download</strong>
        <span>Downloads test payloads of increasing size (512KB to 4MB)</span>
      </div>
    </div>
    <div class="phase-arrow">&rarr;</div>
    <div class="phase-step">
      <span class="phase-num">3</span>
      <div class="phase-desc">
        <strong>Upload</strong>
        <span>Uploads random data payloads (256KB to 2MB) to the server</span>
      </div>
    </div>
  </div>

  <div class="test-area card">
    <div class="gauges">
      <div class="gauge-group">
        <div class="gauge">
          <svg viewBox="0 0 120 70" class="gauge-svg">
            <path
              d="M 10 65 A 50 50 0 0 1 110 65"
              fill="none"
              stroke="var(--border)"
              stroke-width="8"
              stroke-linecap="round"
            />
            <path
              d="M 10 65 A 50 50 0 0 1 110 65"
              fill="none"
              stroke="var(--accent)"
              stroke-width="8"
              stroke-linecap="round"
              stroke-dasharray={`${(gaugeAngle(downloadSpeed, 1000) / 180) * 157} 157`}
            />
          </svg>
          <div class="gauge-value">{downloadSpeed > 0 ? formatSpeed(downloadSpeed) : '--'}</div>
          <div class="gauge-label">Download</div>
        </div>
      </div>

      <div class="gauge-group center">
        <div class="latency-display">
          <span class="latency-value">{latency > 0 ? `${latency}` : '--'}</span>
          <span class="latency-unit">ms</span>
          <span class="latency-label">Latency</span>
        </div>
      </div>

      <div class="gauge-group">
        <div class="gauge">
          <svg viewBox="0 0 120 70" class="gauge-svg">
            <path
              d="M 10 65 A 50 50 0 0 1 110 65"
              fill="none"
              stroke="var(--border)"
              stroke-width="8"
              stroke-linecap="round"
            />
            <path
              d="M 10 65 A 50 50 0 0 1 110 65"
              fill="none"
              stroke="var(--success)"
              stroke-width="8"
              stroke-linecap="round"
              stroke-dasharray={`${(gaugeAngle(uploadSpeed, 1000) / 180) * 157} 157`}
            />
          </svg>
          <div class="gauge-value">{uploadSpeed > 0 ? formatSpeed(uploadSpeed) : '--'}</div>
          <div class="gauge-label">Upload</div>
        </div>
      </div>
    </div>

    {#if running}
      <div class="progress-section">
        <div class="phase-label">
          {phase === 'latency'
            ? 'Measuring latency...'
            : phase === 'download'
              ? 'Testing download...'
              : phase === 'upload'
                ? 'Testing upload...'
                : ''}
        </div>
        <div class="progress-bar">
          <div class="progress-fill" style="width: {progress}%"></div>
        </div>
        <div class="phase-dots">
          <span
            class="phase-dot-item"
            class:active={phase === 'latency'}
            class:done={phase === 'download' || phase === 'upload' || phase === 'done'}>Latency</span
          >
          <span class="phase-dot-sep"></span>
          <span
            class="phase-dot-item"
            class:active={phase === 'download'}
            class:done={phase === 'upload' || phase === 'done'}>Download</span
          >
          <span class="phase-dot-sep"></span>
          <span class="phase-dot-item" class:active={phase === 'upload'} class:done={phase === 'done'}>Upload</span>
        </div>
      </div>
    {/if}

    <div class="test-controls">
      <select class="mode-select" bind:value={testMode} disabled={running}>
        <option value="local">Local (Server ↔ Browser)</option>
        <option value="external">External (Server ↔ Cloudflare)</option>
      </select>
      <button class="btn-start" onclick={runTest} disabled={running}>
        {running ? 'Running...' : phase === 'done' ? 'Run Again' : 'Start Test'}
      </button>
    </div>
  </div>

  {#if history.length > 0}
    <div class="history">
      <h2>History</h2>
      <div class="card history-table-wrap">
        <table>
          <thead>
            <tr>
              <th>Time</th>
              <th>Download</th>
              <th>Upload</th>
              <th>Latency</th>
            </tr>
          </thead>
          <tbody>
            {#each history as h}
              <tr>
                <td>{formatTime(h.timestamp)}</td>
                <td class="speed-cell dl">{formatSpeed(h.download)}</td>
                <td class="speed-cell ul">{formatSpeed(h.upload)}</td>
                <td>{h.latency} ms</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </div>
  {/if}
</div>

<style>
  .page {
    padding: 1.5rem;
    max-width: 800px;
    margin: 0 auto;
  }
  h1 {
    margin-bottom: 0.25rem;
    color: var(--text-primary);
  }
  .subtitle {
    color: var(--text-muted);
    font-size: 0.9rem;
    margin-bottom: 1.5rem;
  }
  .phases-info {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 1rem;
    padding: 1rem 1.5rem;
    margin-bottom: 1.5rem;
  }
  @media (max-width: 600px) {
    .phases-info {
      flex-direction: column;
      gap: 0.75rem;
    }
    .phase-arrow {
      transform: rotate(90deg);
    }
  }
  .phase-step {
    display: flex;
    align-items: flex-start;
    gap: 0.6rem;
    flex: 1;
  }
  .phase-num {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    background: var(--accent-bg);
    color: var(--accent);
    font-size: 0.75rem;
    font-weight: 700;
    flex-shrink: 0;
  }
  .phase-desc {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
  }
  .phase-desc strong {
    font-size: 0.85rem;
    color: var(--text-primary);
  }
  .phase-desc span {
    font-size: 0.72rem;
    color: var(--text-muted);
  }
  .phase-arrow {
    color: var(--text-faint);
    font-size: 1rem;
    flex-shrink: 0;
  }
  .test-area {
    padding: 2rem;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1.5rem;
  }
  .gauges {
    display: flex;
    align-items: flex-end;
    gap: 2rem;
    width: 100%;
    justify-content: center;
  }
  @media (max-width: 600px) {
    .gauges {
      flex-direction: column;
      align-items: center;
      gap: 1rem;
    }
  }
  .gauge-group {
    display: flex;
    flex-direction: column;
    align-items: center;
  }
  .gauge-group.center {
    padding-bottom: 1rem;
  }
  .gauge {
    position: relative;
    width: 160px;
    display: flex;
    flex-direction: column;
    align-items: center;
  }
  .gauge-svg {
    width: 140px;
    height: 80px;
  }
  .gauge-value {
    font-size: 1.4rem;
    font-weight: 800;
    color: var(--text-primary);
    margin-top: -0.5rem;
    font-family: 'JetBrains Mono', monospace;
  }
  .gauge-label {
    font-size: 0.8rem;
    color: var(--text-muted);
    margin-top: 0.25rem;
  }
  .latency-display {
    display: flex;
    flex-direction: column;
    align-items: center;
  }
  .latency-value {
    font-size: 2.5rem;
    font-weight: 800;
    color: var(--text-primary);
    line-height: 1;
    font-family: 'JetBrains Mono', monospace;
  }
  .latency-unit {
    font-size: 0.9rem;
    color: var(--text-muted);
  }
  .latency-label {
    font-size: 0.8rem;
    color: var(--text-muted);
    margin-top: 0.25rem;
  }
  .progress-section {
    width: 100%;
    max-width: 400px;
  }
  .phase-label {
    font-size: 0.85rem;
    color: var(--text-secondary);
    margin-bottom: 0.35rem;
    text-align: center;
  }
  .progress-bar {
    height: 6px;
    background: var(--bg-primary);
    border-radius: 3px;
    overflow: hidden;
  }
  .progress-fill {
    height: 100%;
    background: var(--accent);
    border-radius: 3px;
    transition: width 0.3s ease;
  }
  .phase-dots {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    margin-top: 0.5rem;
  }
  .phase-dot-item {
    font-size: 0.75rem;
    color: var(--text-faint);
    font-weight: 500;
  }
  .phase-dot-item.active {
    color: var(--accent);
    animation: pulse-text 1s infinite;
  }
  .phase-dot-item.done {
    color: var(--success);
  }
  .phase-dot-sep {
    width: 20px;
    height: 2px;
    background: var(--border);
  }
  @keyframes pulse-text {
    0%,
    100% {
      opacity: 1;
    }
    50% {
      opacity: 0.4;
    }
  }
  .test-controls {
    display: flex;
    align-items: center;
    gap: 12px;
    justify-content: center;
  }

  .mode-select {
    padding: 8px 12px;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--bg-primary);
    color: var(--text-primary);
    font-size: 0.82rem;
    font-family: inherit;
    cursor: pointer;
  }

  .btn-start {
    padding: 0.75rem 2.5rem;
    background: var(--accent);
    color: #fff;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    font-weight: 700;
    font-size: 1rem;
  }
  .btn-start:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
  .history {
    margin-top: 2rem;
  }
  .history h2 {
    font-size: 1.1rem;
    color: var(--text-primary);
    margin-bottom: 0.75rem;
  }
  .history-table-wrap {
    padding: 0;
    overflow: hidden;
  }
  table {
    width: 100%;
    border-collapse: collapse;
  }
  th {
    text-align: left;
    padding: 0.6rem 1rem;
    background: var(--bg-secondary);
    color: var(--text-secondary);
    font-size: 0.8rem;
    font-weight: 600;
    text-transform: uppercase;
    border-bottom: 1px solid var(--border);
  }
  td {
    padding: 0.5rem 1rem;
    border-bottom: 1px solid var(--border);
    font-size: 0.85rem;
    color: var(--text-primary);
  }
  .speed-cell {
    font-family: monospace;
    font-weight: 600;
  }
  .speed-cell.dl {
    color: var(--accent);
  }
  .speed-cell.ul {
    color: var(--success);
  }
</style>
