<script lang="ts">
  import type { PageData } from './$types';
  import { toast } from '$lib/toast';
  import { fetchApi, postJson } from '$lib/api';
  import Button from '$lib/components/Button.svelte';
  import PageHeader from '$lib/components/PageHeader.svelte';

  interface BenchmarkResult {
    id: string;
    timestamp: string;
    cpu: { primes: number; timeMs: number; primesPerSec: number };
    memory: { sizeMB: number; timeMs: number; throughputMBps: number };
    disk: { sizeMB: number; writeMs: number; readMs: number; writeMBps: number; readMBps: number };
  }

  let { data } = $props<{ data: PageData }>();
  let history = $state<BenchmarkResult[]>([]);
  $effect(() => {
    history = data.history ?? [];
  });

  let running = $state(false);
  let phase = $state<'idle' | 'cpu' | 'memory' | 'disk' | 'done'>('idle');
  let current = $state<Partial<BenchmarkResult>>({});

  const lastRun = $derived(history.length > 0 ? history[0] : null);
  const prevRun = $derived(history.length > 1 ? history[1] : null);

  async function runAll() {
    running = true;
    current = {};

    try {
      // CPU
      phase = 'cpu';
      const cpuRes = await postJson('/api/benchmarks', { _action: 'run', benchmark: 'cpu' });
      const cpuData = await cpuRes.json();
      current = { ...current, cpu: cpuData.cpu };

      // Memory
      phase = 'memory';
      const memRes = await postJson('/api/benchmarks', { _action: 'run', benchmark: 'memory' });
      const memData = await memRes.json();
      current = { ...current, memory: memData.memory };

      // Disk
      phase = 'disk';
      const diskRes = await postJson('/api/benchmarks', { _action: 'run', benchmark: 'disk' });
      const diskData = await diskRes.json();
      current = { ...current, disk: diskData.disk };

      // Save full run
      const saveRes = await postJson('/api/benchmarks', { _action: 'run', benchmark: 'all' });
      const saved = await saveRes.json();
      history = [saved, ...history];

      phase = 'done';
      toast.success('Benchmarks complete');
    } catch {
      toast.error('Benchmark failed');
      phase = 'idle';
    } finally {
      running = false;
    }
  }

  function delta(curr: number, prev: number | undefined): { pct: string; positive: boolean } | null {
    if (prev === undefined || prev === 0) return null;
    const diff = ((curr - prev) / prev) * 100;
    return {
      pct: `${diff > 0 ? '+' : ''}${diff.toFixed(1)}%`,
      positive: diff > 0,
    };
  }

  function formatTime(ts: string): string {
    return new Date(ts).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  let confirmClear = $state(false);
  let clearTimer: ReturnType<typeof setTimeout> | null = null;

  async function clearHistory() {
    try {
      const res = await fetchApi('/api/benchmarks', {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to clear history');
      history = [];
      current = {};
      phase = 'idle';
      confirmClear = false;
      toast.success('Benchmark history cleared');
    } catch {
      toast.error('Failed to clear history');
    }
  }

  function requestClearHistory() {
    if (clearTimer) clearTimeout(clearTimer);
    confirmClear = true;
    clearTimer = setTimeout(() => {
      confirmClear = false;
    }, 3000);
  }
</script>

<div class="page">
  <PageHeader
    title="System Benchmarks"
    description="Run CPU, memory, and disk benchmarks. Compare results over time to track server performance."
  >
    <Button variant="primary" icon="activity" onclick={runAll} disabled={running} loading={running}>
      {running ? 'Running...' : 'Run Benchmarks'}
    </Button>
  </PageHeader>

  {#if running}
    <div class="card progress-card">
      <div class="phase-indicator">
        <div
          class="phase"
          class:active={phase === 'cpu'}
          class:done={phase === 'memory' || phase === 'disk' || phase === 'done'}
        >
          <span class="phase-dot"></span>CPU
        </div>
        <div class="phase-line"></div>
        <div class="phase" class:active={phase === 'memory'} class:done={phase === 'disk' || phase === 'done'}>
          <span class="phase-dot"></span>Memory
        </div>
        <div class="phase-line"></div>
        <div class="phase" class:active={phase === 'disk'} class:done={phase === 'done'}>
          <span class="phase-dot"></span>Disk
        </div>
      </div>
    </div>
  {/if}

  {#if lastRun || (current.cpu && current.memory && current.disk)}
    {@const result = lastRun && phase !== 'done' && !running ? lastRun : (current as BenchmarkResult)}
    <div class="results-grid">
      {#if result.cpu}
        <div class="card result-card">
          <h3>CPU</h3>
          <div class="metric-main">{result.cpu.primesPerSec.toLocaleString()}</div>
          <div class="metric-unit">primes/sec</div>
          <div class="metric-details">
            <span>{result.cpu.primes.toLocaleString()} primes in {result.cpu.timeMs}ms</span>
            {#if prevRun}
              {@const d = delta(result.cpu.primesPerSec, prevRun.cpu?.primesPerSec)}
              {#if d}
                <span class="delta" class:positive={d.positive} class:negative={!d.positive}>{d.pct}</span>
              {/if}
            {/if}
          </div>
        </div>
      {/if}

      {#if result.memory}
        <div class="card result-card">
          <h3>Memory</h3>
          <div class="metric-main">{result.memory.throughputMBps.toLocaleString()}</div>
          <div class="metric-unit">MB/s throughput</div>
          <div class="metric-details">
            <span>{result.memory.sizeMB} MB in {result.memory.timeMs}ms</span>
            {#if prevRun}
              {@const d = delta(result.memory.throughputMBps, prevRun.memory?.throughputMBps)}
              {#if d}
                <span class="delta" class:positive={d.positive} class:negative={!d.positive}>{d.pct}</span>
              {/if}
            {/if}
          </div>
        </div>
      {/if}

      {#if result.disk}
        <div class="card result-card">
          <h3>Disk</h3>
          <div class="disk-metrics">
            <div class="disk-metric">
              <span class="disk-label">Write</span>
              <span class="disk-value">{result.disk.writeMBps} MB/s</span>
              <span class="disk-time">{result.disk.writeMs}ms</span>
            </div>
            <div class="disk-metric">
              <span class="disk-label">Read</span>
              <span class="disk-value">{result.disk.readMBps} MB/s</span>
              <span class="disk-time">{result.disk.readMs}ms</span>
            </div>
          </div>
          <div class="metric-details">
            <span>{result.disk.sizeMB} MB test file</span>
            {#if prevRun}
              {@const dw = delta(result.disk.writeMBps, prevRun.disk?.writeMBps)}
              {#if dw}
                <span class="delta" class:positive={dw.positive} class:negative={!dw.positive}>W: {dw.pct}</span>
              {/if}
            {/if}
          </div>
        </div>
      {/if}
    </div>
  {/if}

  {#if history.length > 0}
    <div class="history-section">
      <div class="history-header">
        <h2>History</h2>
        {#if confirmClear}
          <button class="btn-clear btn-confirm" onclick={clearHistory}>Confirm Clear?</button>
        {:else}
          <button class="btn-clear" onclick={requestClearHistory}>Clear History</button>
        {/if}
      </div>
      <div class="card history-table-wrap">
        <table>
          <thead>
            <tr>
              <th>Time</th>
              <th>CPU (primes/s)</th>
              <th>Memory (MB/s)</th>
              <th>Disk Write (MB/s)</th>
              <th>Disk Read (MB/s)</th>
            </tr>
          </thead>
          <tbody>
            {#each history as h}
              <tr>
                <td>{formatTime(h.timestamp)}</td>
                <td class="mono">{h.cpu.primesPerSec.toLocaleString()}</td>
                <td class="mono">{h.memory.throughputMBps}</td>
                <td class="mono">{h.disk.writeMBps}</td>
                <td class="mono">{h.disk.readMBps}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </div>
  {/if}
</div>

<style>
  .progress-card {
    padding: 1.5rem;
    margin-bottom: 1.5rem;
  }
  .phase-indicator {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
  }
  .phase {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    font-size: 0.9rem;
    color: var(--text-muted);
    font-weight: 500;
  }
  .phase.active {
    color: var(--accent);
  }
  .phase.done {
    color: var(--success);
  }
  .phase-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: var(--border);
  }
  .phase.active .phase-dot {
    background: var(--accent);
    animation: pulse 1s infinite;
  }
  .phase.done .phase-dot {
    background: var(--success);
  }
  @keyframes pulse {
    0%,
    100% {
      opacity: 1;
    }
    50% {
      opacity: 0.4;
    }
  }
  .phase-line {
    width: 40px;
    height: 2px;
    background: var(--border);
  }
  .results-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
    gap: 1rem;
    margin-bottom: 2rem;
  }
  .result-card {
    padding: 1.25rem;
    text-align: center;
  }
  .result-card h3 {
    margin: 0 0 0.75rem;
    font-size: 0.9rem;
    color: var(--text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  .metric-main {
    font-size: 2rem;
    font-weight: 700;
    color: var(--text-primary);
    line-height: 1;
  }
  .metric-unit {
    font-size: 0.8rem;
    color: var(--text-muted);
    margin-top: 0.25rem;
  }
  .metric-details {
    margin-top: 0.75rem;
    font-size: 0.8rem;
    color: var(--text-muted);
    display: flex;
    justify-content: center;
    gap: 0.5rem;
    flex-wrap: wrap;
  }
  .delta {
    font-weight: 600;
  }
  .delta.positive {
    color: var(--success);
  }
  .delta.negative {
    color: var(--danger);
  }
  .disk-metrics {
    display: flex;
    justify-content: center;
    gap: 2rem;
    margin-top: 0.25rem;
  }
  .disk-metric {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.15rem;
  }
  .disk-label {
    font-size: 0.75rem;
    color: var(--text-muted);
    text-transform: uppercase;
  }
  .disk-value {
    font-size: 1.25rem;
    font-weight: 700;
    color: var(--text-primary);
  }
  .disk-time {
    font-size: 0.75rem;
    color: var(--text-muted);
  }
  .history-section {
    margin-top: 2rem;
  }
  .history-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 0.75rem;
  }
  .history-header h2 {
    font-size: 1.1rem;
    color: var(--text-primary);
    margin: 0;
  }
  .btn-clear {
    padding: 0.4rem 0.8rem;
    font-size: 0.78rem;
    border-radius: 6px;
    border: 1px solid var(--border);
    background: var(--btn-bg);
    color: var(--text-muted);
    cursor: pointer;
    font-family: inherit;
  }
  .btn-clear:hover {
    border-color: var(--danger);
    color: var(--danger);
  }
  .btn-clear.btn-confirm {
    border-color: var(--danger);
    background: var(--danger);
    color: #fff;
  }
  .history-table-wrap {
    padding: 0;
    overflow: auto;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    min-width: 500px;
  }
  th {
    text-align: left;
    padding: 0.6rem 0.75rem;
    background: var(--bg-secondary);
    color: var(--text-secondary);
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    border-bottom: 1px solid var(--border);
  }
  td {
    padding: 0.5rem 0.75rem;
    border-bottom: 1px solid var(--border);
    font-size: 0.85rem;
    color: var(--text-primary);
  }
  .mono {
    font-family: monospace;
  }
</style>
