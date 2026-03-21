<script lang="ts">
	import type { PageData } from './$types';
	import type { TailscaleDevice } from '$lib/server/tailscale';

	let { data } = $props<{ data: PageData }>();
	// svelte-ignore state_referenced_locally
	const { devices: initialDevices, error: initialError } = data;
	let devices = $state<TailscaleDevice[]>(initialDevices);
	let error = $state<string | undefined>(initialError);
	let refreshing = $state(false);

	async function refresh() {
		refreshing = true;
		const res = await fetch('/api/tailscale');
		const result = await res.json();
		devices = result.devices;
		error = result.error;
		refreshing = false;
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
		</div>
		{#each devices as device}
			<div class="device-row" class:self={device.isSelf}>
				<span class="col-status">
					<span class="dot" class:online={device.online}></span>
				</span>
				<span class="col-host">
					{device.hostname}
					{#if device.isSelf}<span class="tag">this device</span>{/if}
				</span>
				<span class="col-ip"><code>{device.ipv4}</code></span>
				<span class="col-os">{device.os}</span>
			</div>
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
		grid-template-columns: 28px 1fr 160px 80px;
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
	}

	.device-row:hover {
		background: var(--bg-secondary);
	}

	.device-row.self {
		background: var(--accent-bg);
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

	code {
		font-size: 0.8rem;
		color: var(--text-muted);
	}

	.col-os {
		color: var(--text-muted);
		font-size: 0.8rem;
	}

	@media (max-width: 640px) {
		.device-header,
		.device-row {
			grid-template-columns: 28px 1fr 120px;
		}
		.col-os {
			display: none;
		}
	}
</style>
