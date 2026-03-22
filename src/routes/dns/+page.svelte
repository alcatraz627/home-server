<script lang="ts">
  import { toast } from '$lib/toast';

  interface DnsResult {
    provider: string;
    server: string;
    records: string[];
    time: number;
  }

  interface LookupResult {
    domain: string;
    type: string;
    results: DnsResult[];
  }

  let domain = $state('example.com');
  let recordType = $state('A');
  let loading = $state(false);
  let result = $state<LookupResult | null>(null);

  const RECORD_TYPES = ['A', 'AAAA', 'MX', 'CNAME', 'TXT', 'NS', 'SOA'];

  // History from localStorage
  let history = $state<{ domain: string; type: string; time: string }[]>([]);

  function loadHistory() {
    try {
      const raw = localStorage.getItem('dns-history');
      if (raw) history = JSON.parse(raw);
    } catch {
      // ignore
    }
  }

  function saveHistory() {
    try {
      localStorage.setItem('dns-history', JSON.stringify(history.slice(0, 20)));
    } catch {
      // ignore
    }
  }

  if (typeof window !== 'undefined') {
    loadHistory();
  }

  async function lookup() {
    if (!domain.trim()) {
      toast.error('Enter a domain name');
      return;
    }
    loading = true;
    result = null;
    try {
      const res = await fetch('/api/dns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain: domain.trim(), type: recordType }),
      });
      if (!res.ok) throw new Error();
      result = await res.json();

      // Add to history
      history = [
        { domain: domain.trim(), type: recordType, time: new Date().toISOString() },
        ...history.filter((h) => !(h.domain === domain.trim() && h.type === recordType)),
      ].slice(0, 20);
      saveHistory();
    } catch {
      toast.error('DNS lookup failed');
    } finally {
      loading = false;
    }
  }

  function quickLookup(d: string, t: string) {
    domain = d;
    recordType = t;
    lookup();
  }
</script>

<div class="page">
  <h2 class="page-title">DNS Lookup</h2>
  <p class="page-desc">Query DNS records for any domain. Supports A, AAAA, MX, CNAME, TXT, NS, and more.</p>

  <div class="card query-card">
    <div class="query-row">
      <input
        type="text"
        bind:value={domain}
        placeholder="Enter domain name..."
        onkeydown={(e) => e.key === 'Enter' && lookup()}
      />
      <select bind:value={recordType}>
        {#each RECORD_TYPES as rt}
          <option value={rt}>{rt}</option>
        {/each}
      </select>
      <button class="btn-primary" onclick={lookup} disabled={loading}>
        {loading ? 'Looking up...' : 'Lookup'}
      </button>
    </div>
  </div>

  {#if result}
    <div class="results">
      <h2>Results for <code>{result.domain}</code> ({result.type})</h2>
      <div class="results-grid">
        {#each result.results as r}
          <div class="card result-card">
            <div class="result-header">
              <h3>{r.provider}</h3>
              <span class="response-time">{r.time}ms</span>
            </div>
            <div class="result-server">{r.server === 'default' ? 'System resolver' : r.server}</div>
            <div class="records">
              {#if r.records.length === 0}
                <span class="no-records">No records found</span>
              {:else}
                {#each r.records as record}
                  <div class="record">{record}</div>
                {/each}
              {/if}
            </div>
          </div>
        {/each}
      </div>
    </div>
  {/if}

  {#if history.length > 0}
    <div class="history">
      <h2>Recent Lookups</h2>
      <div class="history-list">
        {#each history as h}
          <button class="history-item" onclick={() => quickLookup(h.domain, h.type)}>
            <span class="history-domain">{h.domain}</span>
            <span class="history-type">{h.type}</span>
          </button>
        {/each}
      </div>
    </div>
  {/if}
</div>

<style>
  .page {
    padding: 1.5rem;
    max-width: 900px;
    margin: 0 auto;
  }
  h1 {
    margin-bottom: 1.5rem;
    color: var(--text-primary);
  }
  .query-card {
    padding: 1.25rem;
    margin-bottom: 1.5rem;
  }
  .query-row {
    display: flex;
    gap: 0.5rem;
  }
  @media (max-width: 600px) {
    .query-row {
      flex-direction: column;
    }
  }
  .query-row input {
    flex: 1;
    padding: 0.5rem 0.75rem;
    border: 1px solid var(--border);
    border-radius: 6px;
    background: var(--bg-primary);
    color: var(--text-primary);
    font-size: 0.95rem;
  }
  .query-row select {
    padding: 0.5rem 0.75rem;
    border: 1px solid var(--border);
    border-radius: 6px;
    background: var(--bg-primary);
    color: var(--text-primary);
    font-size: 0.9rem;
    min-width: 80px;
  }
  .btn-primary {
    padding: 0.5rem 1.25rem;
    background: var(--accent);
    color: #fff;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-weight: 600;
    font-size: 0.9rem;
    white-space: nowrap;
  }
  .btn-primary:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
  .results {
    margin-bottom: 2rem;
  }
  .results h2 {
    font-size: 1.1rem;
    color: var(--text-primary);
    margin-bottom: 1rem;
  }
  .results h2 code {
    color: var(--accent);
    font-weight: 600;
  }
  .results-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
    gap: 1rem;
  }
  .result-card {
    padding: 1rem;
  }
  .result-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.25rem;
  }
  .result-header h3 {
    margin: 0;
    font-size: 1rem;
    color: var(--text-primary);
  }
  .response-time {
    background: var(--bg-secondary);
    padding: 0.15rem 0.5rem;
    border-radius: 10px;
    font-size: 0.75rem;
    color: var(--text-muted);
    font-family: monospace;
  }
  .result-server {
    font-size: 0.8rem;
    color: var(--text-muted);
    margin-bottom: 0.75rem;
  }
  .records {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
  }
  .record {
    padding: 0.35rem 0.5rem;
    background: var(--bg-primary);
    border-radius: 4px;
    font-family: monospace;
    font-size: 0.8rem;
    color: var(--text-secondary);
    word-break: break-all;
  }
  .no-records {
    color: var(--text-muted);
    font-size: 0.85rem;
    font-style: italic;
  }
  .history {
    margin-top: 1.5rem;
  }
  .history h2 {
    font-size: 1rem;
    color: var(--text-secondary);
    margin-bottom: 0.75rem;
  }
  .history-list {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
  }
  .history-item {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.3rem 0.7rem;
    border: 1px solid var(--border);
    border-radius: 6px;
    background: var(--bg-secondary);
    cursor: pointer;
    font-size: 0.8rem;
  }
  .history-item:hover {
    border-color: var(--accent);
  }
  .history-domain {
    color: var(--text-primary);
  }
  .history-type {
    color: var(--text-muted);
    font-size: 0.7rem;
    background: var(--bg-primary);
    padding: 0.1rem 0.3rem;
    border-radius: 3px;
  }
</style>
