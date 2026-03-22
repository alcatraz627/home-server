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
    try {
      const res = await fetch('/api/tailscale');
      if (!res.ok) throw new Error('Failed to fetch Tailscale devices');
      const result = await res.json();
      devices = result.devices;
      error = result.error;
    } catch (e: any) {
      toast.error(e.message || 'Failed to refresh Tailscale devices');
    }
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
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
      } else {
        // Fallback for HTTP contexts
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
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
    const label = device.hostname.split('.')[0];
    return `${label}.local`;
  }

  function formatRelativeTime(iso: string): string {
    if (!iso) return '—';
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 0) return 'in the future';
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
  }

  function formatBytes(b: number): string {
    if (b < 1024) return `${b} B`;
    if (b < 1048576) return `${(b / 1024).toFixed(0)} KB`;
    if (b < 1073741824) return `${(b / 1048576).toFixed(1)} MB`;
    return `${(b / 1073741824).toFixed(2)} GB`;
  }

  function isKeyExpiringSoon(expiry: string): boolean {
    if (!expiry) return false;
    const diff = new Date(expiry).getTime() - Date.now();
    return diff > 0 && diff < 7 * 24 * 60 * 60 * 1000; // < 7 days
  }

  function isKeyExpired(expiry: string): boolean {
    if (!expiry) return false;
    return new Date(expiry).getTime() < Date.now();
  }
</script>

<svelte:head>
  <title>Tailscale | Home Server</title>
</svelte:head>

<div class="header">
  <h2 class="page-title">Tailscale Devices</h2>
  <button class="btn" onclick={refresh} disabled={refreshing}>
    {refreshing ? 'Refreshing...' : 'Refresh'}
  </button>
</div>
<p class="page-desc">Monitor your Tailscale mesh network. See connected devices, IPs, and connection status.</p>

{#if error}
  <p class="error">{error}</p>
{/if}

{#if devices.length === 0 && !error}
  <div class="device-list">
    <div class="device-header">
      <span class="col-status"></span>
      <span class="col-host">Hostname</span>
      <span class="col-ip">IP Address</span>
      <span class="col-os">OS</span>
      <span class="col-chevron"></span>
    </div>
    {#each Array(3) as _, i}
      <div class="device-row" style="animation-delay: {i * 40}ms">
        <span class="col-status"
          ><div class="skeleton" style="width: 10px; height: 10px; border-radius: 50%;"></div></span
        >
        <span class="col-host"><div class="skeleton" style="width: 100px; height: 14px;"></div></span>
        <span class="col-ip"><div class="skeleton" style="width: 90px; height: 14px;"></div></span>
        <span class="col-os"><div class="skeleton" style="width: 60px; height: 14px;"></div></span>
        <span class="col-chevron"></span>
      </div>
    {/each}
  </div>
{:else if devices.length === 0}
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

            {#if device.ipv6}
              <div class="detail-item">
                <span class="detail-label">IPv6</span>
                <button
                  class="ip-btn"
                  onclick={() => copyToClipboard(device.ipv6, 'Copied IPv6')}
                  title="Click to copy"
                >
                  <code>{device.ipv6}</code>
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

            {#if device.dnsName}
              <div class="detail-item">
                <span class="detail-label">DNS Name</span>
                <button
                  class="ip-btn"
                  onclick={() => copyToClipboard(device.dnsName, 'Copied DNS name')}
                  title="Click to copy"
                >
                  <code>{device.dnsName}</code>
                </button>
              </div>
            {/if}

            <div class="detail-item">
              <span class="detail-label">mDNS</span>
              <button
                class="ip-btn"
                onclick={() => copyToClipboard(getMdnsName(device), 'Copied mDNS name')}
                title="Click to copy"
              >
                <code>{getMdnsName(device)}</code>
              </button>
            </div>

            <div class="detail-item">
              <span class="detail-label">Status</span>
              <span class="detail-value" class:online-text={device.online}>
                {device.online ? 'Online' : 'Offline'}
              </span>
            </div>

            {#if device.tailscaleVersion}
              <div class="detail-item">
                <span class="detail-label">Version</span>
                <span class="detail-value">{device.tailscaleVersion}</span>
              </div>
            {/if}

            {#if device.lastSeen}
              <div class="detail-item">
                <span class="detail-label">Last Seen</span>
                <span class="detail-value">{formatRelativeTime(device.lastSeen)}</span>
              </div>
            {/if}

            {#if device.created}
              <div class="detail-item">
                <span class="detail-label">Created</span>
                <span class="detail-value">{new Date(device.created).toLocaleDateString()}</span>
              </div>
            {/if}

            {#if device.keyExpiry}
              <div class="detail-item">
                <span class="detail-label">Key Expiry</span>
                <span
                  class="detail-value"
                  class:expiry-warn={isKeyExpiringSoon(device.keyExpiry)}
                  class:expiry-expired={isKeyExpired(device.keyExpiry)}
                >
                  {isKeyExpired(device.keyExpiry) ? 'Expired' : new Date(device.keyExpiry).toLocaleDateString()}
                  {#if isKeyExpiringSoon(device.keyExpiry)}
                    <span class="tag exit">expiring soon</span>
                  {/if}
                </span>
              </div>
            {/if}

            {#if device.relay}
              <div class="detail-item">
                <span class="detail-label">Relay/Addr</span>
                <span class="detail-value"><code>{device.relay}</code></span>
              </div>
            {/if}

            {#if device.rxBytes || device.txBytes}
              <div class="detail-item">
                <span class="detail-label">Traffic</span>
                <span class="detail-value">↓ {formatBytes(device.rxBytes)} / ↑ {formatBytes(device.txBytes)}</span>
              </div>
            {/if}

            {#if device.exitNodeOption}
              <div class="detail-item">
                <span class="detail-label">Exit Node</span>
                <span class="detail-value"><span class="tag">available</span></span>
              </div>
            {/if}

            {#if device.advertisedRoutes.length > 0}
              <div class="detail-item">
                <span class="detail-label">Routes</span>
                <span class="detail-tags">
                  {#each device.advertisedRoutes as route}
                    <span class="tag">{route}</span>
                  {/each}
                </span>
              </div>
            {/if}

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

  .detail-value.expiry-warn {
    color: var(--warning);
  }

  .detail-value.expiry-expired {
    color: var(--danger);
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
