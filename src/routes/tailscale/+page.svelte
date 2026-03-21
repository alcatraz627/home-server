<script lang="ts">
  import type { PageData } from './$types';
  import type { TailscaleDevice } from '$lib/server/tailscale';
  import { toast } from '$lib/toast';

  let { data } = $props<{ data: PageData }>();
  // svelte-ignore state_referenced_locally
  const { devices: initialDevices, error: initialError } = data;
  let devices = $state<TailscaleDevice[]>(initialDevices);
  let error = $state<string | undefined>(initialError);
  let refreshing = $state(false);
  let expandedHostnames = $state<Set<string>>(new Set()); // keyed by ipv4 or hostname

  async function refresh() {
    refreshing = true;
    const res = await fetch('/api/tailscale');
    const result = await res.json();
    devices = result.devices;
    error = result.error;
    refreshing = false;
  }

  function toggleExpanded(hostname: string) {
    const next = new Set(expandedHostnames);
    if (next.has(hostname)) {
      next.delete(hostname);
    } else {
      next.add(hostname);
    }
    expandedHostnames = next;
  }

  async function copyToClipboard(text: string, label = 'Copied!') {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(label);
    } catch {
      toast.error('Failed to copy');
    }
  }

  function getTsNetDomain(device: TailscaleDevice): string {
    // hostname may already contain the full DNS name; strip trailing dot
    const h = device.hostname.replace(/\.$/, '');
    // If it looks like a full domain already (contains dots beyond a simple label), use it
    // Otherwise just use it as-is — the .ts.net suffix is the Tailscale MagicDNS pattern
    if (h.includes('.')) return h;
    return `${h}.ts.net`;
  }

  function getMdnsName(device: TailscaleDevice): string {
    // Use only the first label of the hostname for mDNS
    const label = device.hostname.split('.')[0];
    return `${label}.local`;
  }
</script>

<svelte:head>
  <title>Tailscale | Home Server</title>
</svelte:head>

<div class="header">
  <h2>Tailscale Devices</h2>
  <button class="btn" onclick={refresh} disabled={refreshing}>
    {refreshing ? 'Refreshing...' : 'Refresh'}
  </button>
</div>

{#if error}
  <p class="error">{error}</p>
{/if}

{#if devices.length === 0}
  <p class="empty">No devices found on the tailnet.</p>
{:else}
  <div class="device-list">
    <div class="device-header">
      <span class="col-status"></span>
      <span class="col-host">Hostname</span>
      <span class="col-ip">IP Address</span>
      <span class="col-os">OS</span>
      <span class="col-chevron"></span>
    </div>
    {#each devices as device (device.ipv4 || device.hostname)}
      {@const isExpanded = expandedHostnames.has(device.ipv4 || device.hostname)}
      <div
        class="device-row"
        class:self={device.isSelf}
        class:expanded={isExpanded}
        onclick={() => toggleExpanded(device.ipv4 || device.hostname)}
        role="button"
        tabindex="0"
        onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && toggleExpanded(device.ipv4 || device.hostname)}
        aria-expanded={isExpanded}
      >
        <span class="col-status">
          <span class="dot" class:online={device.online}></span>
        </span>
        <span class="col-host">
          {device.hostname.split('.')[0]}
          {#if device.isSelf}<span class="tag">this device</span>{/if}
          {#if device.exitNode}<span class="tag exit">exit node</span>{/if}
        </span>
        <span class="col-ip">
          {#if device.ipv4}
            <button
              class="ip-btn"
              onclick={(e) => {
                e.stopPropagation();
                copyToClipboard(device.ipv4, 'Copied IP');
              }}
              title="Click to copy"
            >
              <code>{device.ipv4}</code>
            </button>
          {:else}
            <span class="muted">—</span>
          {/if}
        </span>
        <span class="col-os">{device.os}</span>
        <span class="col-chevron" aria-hidden="true">
          <span class="chevron" class:open={isExpanded}>›</span>
        </span>
      </div>

      {#if isExpanded}
        <div class="device-detail" class:self={device.isSelf}>
          <div class="detail-grid">
            {#if device.ipv4}
              <div class="detail-item">
                <span class="detail-label">IPv4</span>
                <button
                  class="ip-btn"
                  onclick={() => copyToClipboard(device.ipv4, 'Copied IPv4')}
                  title="Click to copy"
                >
                  <code>{device.ipv4}</code>
                </button>
              </div>
            {/if}

            <div class="detail-item">
              <span class="detail-label">MagicDNS</span>
              <button
                class="ip-btn"
                onclick={() => copyToClipboard(getTsNetDomain(device), 'Copied domain')}
                title="Click to copy"
              >
                <code>{getTsNetDomain(device)}</code>
              </button>
            </div>

            <div class="detail-item">
              <span class="detail-label">mDNS (local)</span>
              <button
                class="ip-btn"
                onclick={() => copyToClipboard(getMdnsName(device), 'Copied mDNS name')}
                title="Click to copy"
              >
                <code>{getMdnsName(device)}</code>
              </button>
            </div>

            {#if device.tags.length > 0}
              <div class="detail-item">
                <span class="detail-label">Tags</span>
                <span class="detail-tags">
                  {#each device.tags as tag}
                    <span class="tag">{tag}</span>
                  {/each}
                </span>
              </div>
            {/if}

            <div class="detail-item">
              <span class="detail-label">Status</span>
              <span class="detail-value" class:online-text={device.online}>
                {device.online ? 'Online' : 'Offline'}
              </span>
            </div>
          </div>
        </div>
      {/if}
    {/each}
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

  .error {
    color: var(--danger);
    margin-bottom: 12px;
    font-size: 0.85rem;
  }

  .empty {
    color: var(--text-muted);
    text-align: center;
    padding: 40px;
  }

  .device-list {
    border: 1px solid var(--border);
    border-radius: 8px;
    overflow: hidden;
  }

  .device-header,
  .device-row {
    display: grid;
    grid-template-columns: 28px 1fr 160px 80px 24px;
    padding: 10px 16px;
    align-items: center;
    gap: 8px;
  }

  .device-header {
    background: var(--bg-secondary);
    font-size: 0.75rem;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .device-row {
    border-top: 1px solid var(--border-subtle);
    font-size: 0.85rem;
    cursor: pointer;
    user-select: none;
  }

  .device-row:hover {
    background: var(--bg-secondary);
  }

  .device-row.self {
    background: var(--accent-bg);
  }

  .device-row.self:hover {
    background: var(--accent-bg);
    filter: brightness(1.05);
  }

  .device-row:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: -2px;
  }

  .device-detail {
    border-top: 1px solid var(--border-subtle);
    padding: 12px 16px 14px calc(28px + 16px + 8px);
    background: var(--bg-tertiary, var(--bg-secondary));
    font-size: 0.82rem;
  }

  .device-detail.self {
    background: var(--accent-bg);
    filter: brightness(0.97);
  }

  .detail-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 10px 24px;
  }

  .detail-item {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .detail-label {
    color: var(--text-muted);
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    white-space: nowrap;
  }

  .detail-value {
    color: var(--text-secondary);
  }

  .detail-value.online-text {
    color: var(--success);
  }

  .detail-tags {
    display: flex;
    gap: 4px;
    flex-wrap: wrap;
  }

  .dot {
    display: inline-block;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--text-faint);
  }

  .dot.online {
    background: var(--success);
  }

  .tag {
    font-size: 0.65rem;
    padding: 2px 6px;
    border-radius: 10px;
    background: var(--accent-bg);
    color: var(--accent);
    margin-left: 6px;
    vertical-align: middle;
  }

  .tag.exit {
    background: var(--warning-bg, var(--accent-bg));
    color: var(--warning, var(--accent));
    margin-left: 4px;
  }

  .detail-tags .tag {
    margin-left: 0;
  }

  code {
    font-size: 0.8rem;
    color: var(--text-muted);
  }

  .col-os {
    color: var(--text-muted);
    font-size: 0.8rem;
  }

  .col-chevron {
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .chevron {
    display: inline-block;
    color: var(--text-faint);
    font-size: 1rem;
    line-height: 1;
    transform: rotate(0deg);
    transition: transform 0.18s ease;
  }

  .chevron.open {
    transform: rotate(90deg);
  }

  .ip-btn {
    background: none;
    border: none;
    padding: 2px 4px;
    margin: 0;
    cursor: pointer;
    border-radius: 4px;
    font-family: inherit;
    display: inline-flex;
    align-items: center;
  }

  .ip-btn:hover {
    background: var(--border-subtle, var(--border));
  }

  .ip-btn:hover code {
    color: var(--accent);
  }

  .muted {
    color: var(--text-faint);
  }

  @media (max-width: 640px) {
    .device-header,
    .device-row {
      grid-template-columns: 28px 1fr 120px 24px;
    }
    .col-os {
      display: none;
    }
    .device-detail {
      padding-left: 16px;
    }
  }
</style>
