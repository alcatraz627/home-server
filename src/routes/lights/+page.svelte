<script lang="ts">
	import type { PageData } from './$types';
	import type { WizBulb } from '$lib/server/wiz';

	let { data } = $props<{ data: PageData }>();
	let bulbs = $state<WizBulb[]>(data.bulbs);
	let discovering = $state(false);

	let debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();

	async function rediscover() {
		discovering = true;
		const res = await fetch('/api/lights');
		bulbs = await res.json();
		discovering = false;
	}

	async function setBulb(ip: string, params: Record<string, any>) {
		await fetch(`/api/lights/${encodeURIComponent(ip)}`, {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(params)
		});
	}

	function toggleBulb(bulb: WizBulb) {
		bulb.state = !bulb.state;
		setBulb(bulb.ip, { state: bulb.state });
	}

	function debouncedSet(ip: string, params: Record<string, any>) {
		const existing = debounceTimers.get(ip);
		if (existing) clearTimeout(existing);
		debounceTimers.set(
			ip,
			setTimeout(() => {
				setBulb(ip, params);
				debounceTimers.delete(ip);
			}, 300)
		);
	}

	function handleBrightness(bulb: WizBulb, e: Event) {
		const val = parseInt((e.target as HTMLInputElement).value);
		bulb.brightness = val;
		debouncedSet(bulb.ip, { dimming: val });
	}

	function handleColor(bulb: WizBulb, e: Event) {
		const hex = (e.target as HTMLInputElement).value;
		const r = parseInt(hex.slice(1, 3), 16);
		const g = parseInt(hex.slice(3, 5), 16);
		const b = parseInt(hex.slice(5, 7), 16);
		bulb.color = { r, g, b };
		bulb.colorTemp = null;
		debouncedSet(bulb.ip, { r, g, b });
	}

	function setTemp(bulb: WizBulb, temp: number) {
		bulb.colorTemp = temp;
		bulb.color = null;
		setBulb(bulb.ip, { temp });
	}

	function colorHex(bulb: WizBulb): string {
		if (!bulb.color) return '#ffffff';
		const { r, g, b } = bulb.color;
		return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
	}
</script>

<svelte:head>
	<title>Lights | Home Server</title>
</svelte:head>

<div class="header">
	<h2>Smart Lights</h2>
	<button class="btn" onclick={rediscover} disabled={discovering}>
		{discovering ? 'Scanning...' : 'Rediscover'}
	</button>
</div>

{#if bulbs.length === 0}
	<div class="empty">
		<p>No Wiz bulbs found on the network.</p>
		<p class="hint">Make sure your bulbs are powered on and connected to the same network.</p>
	</div>
{:else}
	<div class="bulb-grid">
		{#each bulbs as bulb}
			<div class="bulb-card" class:off={!bulb.state}>
				<div class="bulb-top">
					<div class="bulb-info">
						<span class="bulb-mac">{bulb.mac}</span>
						<span class="bulb-ip">{bulb.ip}</span>
					</div>
					<button
						class="toggle"
						class:on={bulb.state}
						onclick={() => toggleBulb(bulb)}
					>
						{bulb.state ? 'ON' : 'OFF'}
					</button>
				</div>

				{#if bulb.state}
					<div class="bulb-controls">
						<label class="control-row">
							<span class="control-label">Brightness</span>
							<input
								type="range"
								min="10"
								max="100"
								value={bulb.brightness}
								oninput={(e) => handleBrightness(bulb, e)}
							/>
							<span class="control-value">{bulb.brightness}%</span>
						</label>

						<div class="control-row">
							<span class="control-label">Color</span>
							<input type="color" value={colorHex(bulb)} oninput={(e) => handleColor(bulb, e)} />
						</div>

						<div class="control-row">
							<span class="control-label">Temp</span>
							<div class="temp-presets">
								<button class:active={bulb.colorTemp === 2700} onclick={() => setTemp(bulb, 2700)}>Warm</button>
								<button class:active={bulb.colorTemp === 4000} onclick={() => setTemp(bulb, 4000)}>Neutral</button>
								<button class:active={bulb.colorTemp === 6500} onclick={() => setTemp(bulb, 6500)}>Cool</button>
							</div>
						</div>
					</div>
				{/if}
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
		border: 1px solid #30363d;
		background: #21262d;
		color: #c9d1d9;
		cursor: pointer;
		font-family: inherit;
	}

	.btn:hover:not(:disabled) {
		border-color: #58a6ff;
	}

	.btn:disabled {
		opacity: 0.5;
	}

	.empty {
		text-align: center;
		padding: 40px;
	}

	.empty p {
		color: #8b949e;
	}

	.hint {
		font-size: 0.8rem;
		margin-top: 8px;
	}

	.bulb-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
		gap: 16px;
	}

	.bulb-card {
		background: #161b22;
		border: 1px solid #30363d;
		border-radius: 8px;
		padding: 16px;
		transition: border-color 0.15s;
	}

	.bulb-card:hover {
		border-color: #484f58;
	}

	.bulb-card.off {
		opacity: 0.6;
	}

	.bulb-top {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		margin-bottom: 12px;
	}

	.bulb-info {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.bulb-mac {
		font-size: 0.85rem;
		font-weight: 500;
	}

	.bulb-ip {
		font-size: 0.75rem;
		color: #8b949e;
		font-family: monospace;
	}

	.toggle {
		padding: 4px 12px;
		font-size: 0.75rem;
		font-weight: 600;
		border-radius: 12px;
		border: 1px solid #30363d;
		background: #21262d;
		color: #8b949e;
		cursor: pointer;
		font-family: monospace;
	}

	.toggle.on {
		background: #238636;
		border-color: #2ea043;
		color: #fff;
	}

	.bulb-controls {
		display: flex;
		flex-direction: column;
		gap: 10px;
		padding-top: 12px;
		border-top: 1px solid #21262d;
	}

	.control-row {
		display: flex;
		align-items: center;
		gap: 10px;
	}

	.control-label {
		font-size: 0.75rem;
		color: #8b949e;
		width: 70px;
		flex-shrink: 0;
	}

	.control-value {
		font-size: 0.75rem;
		color: #8b949e;
		font-family: monospace;
		width: 40px;
		text-align: right;
	}

	input[type='range'] {
		flex: 1;
		accent-color: #58a6ff;
	}

	input[type='color'] {
		width: 32px;
		height: 28px;
		border: 1px solid #30363d;
		border-radius: 4px;
		background: none;
		cursor: pointer;
		padding: 0;
	}

	.temp-presets {
		display: flex;
		gap: 6px;
	}

	.temp-presets button {
		padding: 3px 10px;
		font-size: 0.7rem;
		border-radius: 12px;
		border: 1px solid #30363d;
		background: #21262d;
		color: #c9d1d9;
		cursor: pointer;
	}

	.temp-presets button:hover {
		border-color: #58a6ff;
	}

	.temp-presets button.active {
		background: #1f6feb33;
		border-color: #58a6ff;
		color: #58a6ff;
	}
</style>
