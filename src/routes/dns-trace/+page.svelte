<script lang="ts">
  import { fetchApi } from '$lib/api';
  import { toast } from '$lib/toast';
  import { createHistory } from '$lib/history.svelte';
  import Button from '$lib/components/Button.svelte';
  import Badge from '$lib/components/Badge.svelte';
  import Icon from '$lib/components/Icon.svelte';
  import Card from '$lib/components/Card.svelte';

  interface TraceRecord {
    name: string;
    type: string;
    value: string;
    ttl: number;
  }

  interface TraceHop {
    server: string;
    serverIp: string;
    responseTime: number;
    answers: TraceRecord[];
    authority: TraceRecord[];
    additional: TraceRecord[];
    flags: string;
    status: string;
    queryType: string;
    msgSize: number;
  }

  let domain = $state('example.com');
  let recordType = $state('A');
  let loading = $state(false);
  let hops = $state<TraceHop[]>([]);
  let expandedHop = $state(-1);
  let showRaw = $state(false);
  let rawOutput = $state('');

  const RECORD_TYPES = ['A', 'AAAA', 'MX', 'CNAME', 'TXT', 'NS'];

  const traceHistory = createHistory<{ domain: string; type: string; hops: number; time: string }>(
    'hs:dns-trace-history',
  );

  async function trace() {
    if (!domain.trim()) {
      toast.error('Enter a domain');
      return;
    }
    loading = true;
    hops = [];
    rawOutput = '';
    try {
      const res = await fetchApi('/api/dns/trace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain: domain.trim(), type: recordType }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Trace failed');
      const data = await res.json();
      hops = data.hops;
      rawOutput = data.raw;
      traceHistory.add({
        domain: domain.trim(),
        type: recordType,
        hops: data.hopCount,
        time: new Date().toISOString(),
      });
      toast.success(`Traced ${data.hopCount} hops for ${domain}`);
    } catch (e: any) {
      toast.error(e.message || 'DNS trace failed');
    } finally {
      loading = false;
    }
  }

  function hopLabel(hop: TraceHop, i: number): string {
    if (i === 0) return 'Root Servers';
    if (hop.authority.some((r) => r.type === 'NS')) {
      const ns = hop.authority[0]?.value?.replace(/\.$/, '');
      if (ns) return ns;
    }
    return hop.server || hop.serverIp || `Hop ${i + 1}`;
  }

  function hopType(hop: TraceHop, i: number): string {
    if (i === 0) return 'root';
    if (hop.answers.length > 0) return 'answer';
    if (hop.authority.some((r) => r.type === 'NS')) return 'referral';
    return 'intermediate';
  }

  function statusColor(status: string): string {
    if (status === 'NOERROR') return 'var(--success)';
    if (status === 'NXDOMAIN') return 'var(--danger)';
    if (status === 'SERVFAIL') return 'var(--warning)';
    return 'var(--text-muted)';
  }
</script>

<svelte:head>
  <title>DNS Trace | Home Server</title>
</svelte:head>

<div class="page">
  <h2 class="page-title">DNS Path Trace</h2>
  <p class="page-desc">
    Trace the full DNS resolution path from root servers through TLD and authoritative nameservers, showing every
    intermediate hop.
  </p>

  <div class="trace-form">
    <input
      type="text"
      class="domain-input"
      bind:value={domain}
      placeholder="Domain name..."
      onkeydown={(e) => e.key === 'Enter' && trace()}
    />
    <select class="type-select" bind:value={recordType}>
      {#each RECORD_TYPES as t}
        <option value={t}>{t}</option>
      {/each}
    </select>
    <Button onclick={trace} disabled={loading} {loading}>
      {loading ? 'Tracing...' : 'Trace'}
    </Button>
  </div>

  {#if traceHistory.items.length > 0 && hops.length === 0}
    <div class="history-section">
      <div class="history-header">
        <span class="history-label">Recent Traces</span>
        <button class="history-clear" onclick={() => traceHistory.clear()}>Clear</button>
      </div>
      {#each traceHistory.items as h, i}
        <button
          class="history-item"
          onclick={() => {
            domain = h.domain;
            recordType = h.type;
            trace();
          }}
        >
          <code>{h.domain}</code>
          <Badge size="sm">{h.type}</Badge>
          <span class="history-meta">{h.hops} hops</span>
          <span class="history-time">{new Date(h.time).toLocaleDateString()}</span>
        </button>
      {/each}
    </div>
  {/if}

  {#if hops.length > 0}
    <div class="trace-path">
      <div class="trace-summary">
        <span>{hops.length} hops</span>
        <span class="sep">|</span>
        <span>{hops.reduce((s, h) => s + h.responseTime, 0)}ms total</span>
        <button class="raw-toggle" onclick={() => (showRaw = !showRaw)}>
          {showRaw ? 'Hide' : 'Show'} Raw
        </button>
      </div>

      {#each hops as hop, i}
        {@const type = hopType(hop, i)}
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div class="hop" class:answer={type === 'answer'} onclick={() => (expandedHop = expandedHop === i ? -1 : i)}>
          <div class="hop-connector">
            <div class="hop-line"></div>
            <div
              class="hop-dot"
              class:root={type === 'root'}
              class:referral={type === 'referral'}
              class:answer={type === 'answer'}
            ></div>
            {#if i < hops.length - 1}<div class="hop-line"></div>{/if}
          </div>

          <div class="hop-content">
            <div class="hop-header">
              <span class="hop-number">#{i + 1}</span>
              <span class="hop-label">{hopLabel(hop, i)}</span>
              {#if hop.serverIp && hop.serverIp !== hop.server}
                <code class="hop-ip">{hop.serverIp}</code>
              {/if}
              <Badge variant={type === 'answer' ? 'success' : type === 'root' ? 'purple' : 'default'}>
                {type === 'root' ? 'Root' : type === 'answer' ? 'Answer' : type === 'referral' ? 'Referral' : 'Hop'}
              </Badge>
              <span class="hop-time">{hop.responseTime}ms</span>
              <Icon name={expandedHop === i ? 'chevron-down' : 'chevron-right'} size={14} />
            </div>

            <!-- Quick summary line -->
            <div class="hop-quick">
              {#if hop.answers.length > 0}
                <span class="quick-records">
                  {#each hop.answers.slice(0, 3) as a}
                    <code class="record-pill">{a.type} {a.value}</code>
                  {/each}
                  {#if hop.answers.length > 3}
                    <span class="more">+{hop.answers.length - 3}</span>
                  {/if}
                </span>
              {:else if hop.authority.length > 0}
                <span class="quick-records">
                  {#each hop.authority.slice(0, 3) as a}
                    <code class="record-pill ns">{a.type} {a.value}</code>
                  {/each}
                </span>
              {/if}
            </div>

            {#if expandedHop === i}
              <div class="hop-details">
                <div class="detail-grid">
                  <div class="detail-item">
                    <span class="dl">Status</span>
                    <span style="color: {statusColor(hop.status)}">{hop.status || '—'}</span>
                  </div>
                  <div class="detail-item">
                    <span class="dl">Flags</span>
                    <span>{hop.flags || '—'}</span>
                  </div>
                  <div class="detail-item">
                    <span class="dl">Server</span>
                    <code>{hop.server || hop.serverIp || '—'}</code>
                  </div>
                  <div class="detail-item">
                    <span class="dl">Server IP</span>
                    <code>{hop.serverIp || '—'}</code>
                  </div>
                  <div class="detail-item">
                    <span class="dl">Response</span>
                    <span>{hop.responseTime}ms</span>
                  </div>
                  <div class="detail-item">
                    <span class="dl">Msg Size</span>
                    <span>{hop.msgSize} bytes</span>
                  </div>
                </div>

                {#if hop.answers.length > 0}
                  <div class="record-section">
                    <h4>Answer Section ({hop.answers.length})</h4>
                    <table class="record-table">
                      <thead>
                        <tr><th>Name</th><th>Type</th><th>Value</th><th>TTL</th></tr>
                      </thead>
                      <tbody>
                        {#each hop.answers as r}
                          <tr>
                            <td><code>{r.name}</code></td>
                            <td><Badge variant="accent">{r.type}</Badge></td>
                            <td><code>{r.value}</code></td>
                            <td>{r.ttl}s</td>
                          </tr>
                        {/each}
                      </tbody>
                    </table>
                  </div>
                {/if}

                {#if hop.authority.length > 0}
                  <div class="record-section">
                    <h4>Authority Section ({hop.authority.length})</h4>
                    <table class="record-table">
                      <thead>
                        <tr><th>Name</th><th>Type</th><th>Value</th><th>TTL</th></tr>
                      </thead>
                      <tbody>
                        {#each hop.authority as r}
                          <tr>
                            <td><code>{r.name}</code></td>
                            <td><Badge variant="info">{r.type}</Badge></td>
                            <td><code>{r.value}</code></td>
                            <td>{r.ttl}s</td>
                          </tr>
                        {/each}
                      </tbody>
                    </table>
                  </div>
                {/if}

                {#if hop.additional.length > 0}
                  <div class="record-section">
                    <h4>Additional Section ({hop.additional.length})</h4>
                    <table class="record-table">
                      <thead>
                        <tr><th>Name</th><th>Type</th><th>Value</th><th>TTL</th></tr>
                      </thead>
                      <tbody>
                        {#each hop.additional as r}
                          <tr>
                            <td><code>{r.name}</code></td>
                            <td><Badge>{r.type}</Badge></td>
                            <td><code>{r.value}</code></td>
                            <td>{r.ttl}s</td>
                          </tr>
                        {/each}
                      </tbody>
                    </table>
                  </div>
                {/if}
              </div>
            {/if}
          </div>
        </div>
      {/each}
    </div>

    {#if showRaw}
      <Card padding="sm">
        <pre class="raw-output">{rawOutput}</pre>
      </Card>
    {/if}
  {/if}
</div>

<style>
  .page {
    max-width: 900px;
    margin: 0 auto;
  }

  .trace-form {
    display: flex;
    gap: 8px;
    margin-bottom: 20px;
    align-items: center;
  }

  .domain-input {
    flex: 1;
    padding: 8px 12px;
    border: 1px solid var(--border);
    border-radius: 6px;
    background: var(--input-bg);
    color: var(--text-primary);
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.85rem;
  }

  .type-select {
    padding: 8px 12px;
    border: 1px solid var(--border);
    border-radius: 6px;
    background: var(--input-bg);
    color: var(--text-primary);
    font-size: 0.82rem;
    cursor: pointer;
  }

  .trace-summary {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 0.78rem;
    color: var(--text-muted);
    margin-bottom: 16px;
    padding: 8px 12px;
    background: var(--bg-secondary);
    border-radius: 8px;
    border: 1px solid var(--border);
  }

  .sep {
    color: var(--border);
  }

  .raw-toggle {
    margin-left: auto;
    font-size: 0.7rem;
    background: none;
    border: 1px solid var(--border);
    border-radius: 4px;
    color: var(--text-faint);
    padding: 2px 8px;
    cursor: pointer;
    font-family: inherit;
  }

  .raw-toggle:hover {
    border-color: var(--accent);
    color: var(--accent);
  }

  .trace-path {
    position: relative;
  }

  .hop {
    display: flex;
    gap: 12px;
    cursor: pointer;
    transition: background 0.1s;
  }

  .hop:hover {
    background: var(--bg-hover);
    border-radius: 8px;
  }

  .hop.answer {
    background: color-mix(in srgb, var(--success) 5%, transparent);
    border-radius: 8px;
  }

  .hop-connector {
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 20px;
    flex-shrink: 0;
  }

  .hop-line {
    width: 2px;
    flex: 1;
    background: var(--border);
    min-height: 10px;
  }

  .hop-dot {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: var(--bg-hover);
    border: 2px solid var(--border);
    flex-shrink: 0;
    z-index: 1;
  }

  .hop-dot.root {
    border-color: var(--purple);
    background: var(--purple);
  }

  .hop-dot.referral {
    border-color: var(--accent);
    background: var(--accent);
  }

  .hop-dot.answer {
    border-color: var(--success);
    background: var(--success);
  }

  .hop-content {
    flex: 1;
    padding: 8px 10px;
    min-width: 0;
  }

  .hop-header {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }

  .hop-number {
    font-size: 0.65rem;
    font-weight: 700;
    color: var(--text-faint);
    font-family: 'JetBrains Mono', monospace;
  }

  .hop-label {
    font-size: 0.82rem;
    font-weight: 600;
    color: var(--text-primary);
  }

  .hop-ip {
    font-size: 0.68rem;
    color: var(--text-faint);
  }

  .hop-time {
    font-size: 0.68rem;
    font-family: 'JetBrains Mono', monospace;
    color: var(--text-faint);
    margin-left: auto;
  }

  .hop-quick {
    margin-top: 4px;
  }

  .quick-records {
    display: flex;
    gap: 4px;
    flex-wrap: wrap;
  }

  .record-pill {
    font-size: 0.62rem;
    padding: 1px 6px;
    border-radius: 4px;
    background: var(--bg-hover);
    color: var(--text-muted);
  }

  .record-pill.ns {
    background: var(--accent-bg);
    color: var(--accent);
  }

  .more {
    font-size: 0.62rem;
    color: var(--text-faint);
  }

  .hop-details {
    margin-top: 10px;
    padding-top: 10px;
    border-top: 1px solid var(--border-subtle);
  }

  .detail-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
    gap: 6px 16px;
    margin-bottom: 12px;
  }

  .detail-item {
    display: flex;
    gap: 6px;
    font-size: 0.72rem;
  }

  .detail-item .dl {
    color: var(--text-faint);
    font-weight: 600;
    text-transform: uppercase;
    font-size: 0.62rem;
    min-width: 55px;
  }

  .detail-item code {
    font-size: 0.68rem;
    word-break: break-all;
  }

  .record-section {
    margin-top: 10px;
  }

  .record-section h4 {
    font-size: 0.72rem;
    font-weight: 600;
    color: var(--text-muted);
    margin: 0 0 6px;
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }

  .record-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.72rem;
  }

  .record-table th {
    text-align: left;
    padding: 4px 8px;
    color: var(--text-faint);
    font-weight: 600;
    border-bottom: 1px solid var(--border);
    font-size: 0.65rem;
    text-transform: uppercase;
  }

  .record-table td {
    padding: 3px 8px;
    color: var(--text-secondary);
    border-bottom: 1px solid var(--border-subtle);
  }

  .record-table code {
    font-size: 0.68rem;
    word-break: break-all;
  }

  .history-section {
    margin-bottom: 20px;
  }

  .history-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 8px;
  }

  .history-label {
    font-size: 0.72rem;
    font-weight: 600;
    color: var(--text-faint);
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }

  .history-clear {
    font-size: 0.65rem;
    background: none;
    border: 1px solid var(--border);
    border-radius: 4px;
    color: var(--text-faint);
    padding: 2px 8px;
    cursor: pointer;
    font-family: inherit;
  }

  .history-clear:hover {
    border-color: var(--danger);
    color: var(--danger);
  }

  .history-item {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 6px 10px;
    border: 1px solid var(--border-subtle);
    border-radius: 6px;
    background: var(--bg-secondary);
    cursor: pointer;
    font-family: inherit;
    color: var(--text-primary);
    margin-bottom: 4px;
    text-align: left;
    transition:
      border-color 0.15s,
      background 0.15s;
  }

  .history-item:hover {
    border-color: var(--accent);
    background: var(--bg-hover);
  }

  .history-item code {
    font-size: 0.75rem;
  }

  .history-meta {
    font-size: 0.68rem;
    color: var(--text-faint);
  }

  .history-time {
    font-size: 0.65rem;
    color: var(--text-faint);
    margin-left: auto;
  }

  .raw-output {
    font-size: 0.68rem;
    font-family: 'JetBrains Mono', monospace;
    color: var(--text-muted);
    white-space: pre-wrap;
    word-break: break-all;
    max-height: 400px;
    overflow-y: auto;
    margin: 0;
  }
</style>
