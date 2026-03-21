<script lang="ts">
	import type { PageData } from './$types';
	import type { WizBulb } from '$lib/server/wiz';

	let { data } = $props<{ data: PageData }>();
	// svelte-ignore state_referenced_locally
	const { bulbs: initialBulbs } = data;
	let bulbs = $state<WizBulb[]>(initialBulbs);
	let discovering = $state(false);
	let polling = $state(false);
	let pollInterval: ReturnType<typeof setInterval> | null = null;

	// Bulb names stored in localStorage
	let bulbNames = $state<Record<string, string>>(loadNames());

	// Group select
	let selectedBulbs = $state<Set<string>>(new Set());
	let selectAll = $state(false);

	const WIZ_SCENES: Record<number, string> = {
		6: 'Cozy', 11: 'Warm White', 12: 'Daylight', 13: 'Cool White',
		14: 'Night Light', 15: 'Focus', 16: 'Relax', 29: 'Candlelight',
		1: 'Ocean', 2: 'Romance', 3: 'Sunset', 4: 'Party',
		5: 'Fireplace', 7: 'Forest', 9: 'Wake Up', 10: 'Bedtime'
	};

	let debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();

	function loadNames(): Record<string, string> {
		if (typeof localStorage === 'undefined') return {};
		try { return JSON.parse(localStorage.getItem('hs:bulb-names') || '{}'); }
		catch { return {}; }
	}

	function saveName(mac: string, name: string) {
		bulbNames = { ...bulbNames, [mac]: name };
		if (typeof localStorage !== 'undefined') {
			localStorage.setItem('hs:bulb-names', JSON.stringify(bulbNames));
		}
	}

	function bulbName(bulb: WizBulb): string {
		return bulbNames[bulb.mac] || bulb.moduleName || bulb.mac;
	}

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
		debounceTimers.set(ip, setTimeout(() => {
			setBulb(ip, params);
			debounceTimers.delete(ip);
		}, 300));
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
		bulb.sceneId = null;
		debouncedSet(bulb.ip, { r, g, b });
	}

	function setTemp(bulb: WizBulb, temp: number) {
		bulb.colorTemp = temp;
		bulb.color = null;
		bulb.sceneId = null;
		setBulb(bulb.ip, { temp });
	}

	function setScene(bulb: WizBulb, sceneId: number) {
		bulb.sceneId = sceneId;
		bulb.color = null;
		bulb.colorTemp = null;
		setBulb(bulb.ip, { sceneId });
	}

	function colorHex(bulb: WizBulb): string {
		if (!bulb.color) return '#ffffff';
		const { r, g, b } = bulb.color;
		return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
	}

	// Polling
	function togglePolling() {
		polling = !polling;
		if (polling) {
			pollInterval = setInterval(refreshStates, 5000);
		} else if (pollInterval) {
			clearInterval(pollInterval);
			pollInterval = null;
		}
	}

	async function refreshStates() {
		const res = await fetch('/api/lights');
		const fresh: WizBulb[] = await res.json();
		// Merge — preserve local UI state for bulbs not in response
		bulbs = fresh;
	}

	// Group control
	function toggleSelectAll() {
		selectAll = !selectAll;
		if (selectAll) {
			selectedBulbs = new Set(bulbs.map(b => b.mac));
		} else {
			selectedBulbs = new Set();
		}
	}

	function toggleSelect(mac: string) {
		if (selectedBulbs.has(mac)) {
			selectedBulbs.delete(mac);
		} else {
			selectedBulbs.add(mac);
		}
		selectedBulbs = new Set(selectedBulbs);
		selectAll = selectedBulbs.size === bulbs.length;
	}

	async function groupAction(params: Record<string, any>) {
		const targets = bulbs.filter(b => selectedBulbs.has(b.mac));
		await Promise.all(targets.map(b => setBulb(b.ip, params)));
		// Update local state
		for (const b of targets) {
			if ('state' in params) b.state = params.state;
			if ('dimming' in params) b.brightness = params.dimming;
		}
		bulbs = [...bulbs]; // trigger reactivity
	}

	// Rename
	let renamingMac = $state<string | null>(null);
	let renameValue = $state('');

	function startRename(bulb: WizBulb) {
		renamingMac = bulb.mac;
		renameValue = bulbName(bulb);
	}

	function submitRename(mac: string) {
		if (renameValue.trim()) saveName(mac, renameValue.trim());
		renamingMac = null;
	}
</script>

<svelte:head>
	<title>Lights | Home Server</title>
</svelte:head>

<div class="header">
	<h2>Smart Lights</h2>
	<div class="controls">
		<button class="btn" onclick={rediscover} disabled={discovering}>
			{discovering ? 'Scanning...' : 'Rediscover'}
		</button>
		<button class="btn" class:active={polling} onclick={togglePolling}>
			Poll {polling ? 'ON' : 'OFF'}
		</button>
	</div>
</div>

{#if bulbs.length > 1}
	<div class="group-controls">
		<label class="select-all">
			<input type="checkbox" checked={selectAll} onchange={toggleSelectAll} />
			Select All
		</label>
		{#if selectedBulbs.size > 0}
			<span class="group-info">{selectedBulbs.size} selected</span>
			<button class="btn btn-sm" onclick={() => groupAction({ state: true })}>All ON</button>
			<button class="btn btn-sm" onclick={() => groupAction({ state: false })}>All OFF</button>
			<button class="btn btn-sm" onclick={() => groupAction({ dimming: 100 })}>100%</button>
			<button class="btn btn-sm" onclick={() => groupAction({ dimming: 50 })}>50%</button>
			<button class="btn btn-sm" onclick={() => groupAction({ dimming: 10 })}>10%</button>
		{/if}
	</div>
{/if}

{#if bulbs.length === 0}
	<div class="empty">
		<p>No Wiz bulbs found on the network.</p>
		<p class="hint">Make sure your bulbs are powered on and connected to the same network.</p>
	</div>
{:else}
	<div class="bulb-grid">
		{#each bulbs as bulb}
			<div class="bulb-card" class:off={!bulb.state} class:selected={selectedBulbs.has(bulb.mac)}>
				<div class="bulb-top">
					<div class="bulb-info">
						{#if bulbs.length > 1}
							<input type="checkbox" checked={selectedBulbs.has(bulb.mac)} onchange={() => toggleSelect(bulb.mac)} class="bulb-checkbox" />
						{/if}
						<div>
							{#if renamingMac === bulb.mac}
								<input
									class="rename-input"
									type="text"
									bind:value={renameValue}
									onkeydown={(e) => { if (e.key === 'Enter') submitRename(bulb.mac); if (e.key === 'Escape') renamingMac = null; }}
									onblur={() => submitRename(bulb.mac)}
								/>
							{:else}
								<span class="bulb-name" role="button" tabindex="0" ondblclick={() => startRename(bulb)} onkeydown={(e) => { if (e.key === 'Enter') startRename(bulb); }}>{bulbName(bulb)}</span>
							{/if}
							<span class="bulb-ip">{bulb.ip}</span>
							{#if bulb.fwVersion}
								<span class="bulb-fw">fw {bulb.fwVersion}</span>
							{/if}
							{#if bulb.rssi != null}
								<span class="bulb-signal">signal: {bulb.rssi}dBm</span>
							{/if}
						</div>
					</div>
					<button class="toggle" class:on={bulb.state} onclick={() => toggleBulb(bulb)}>
						{bulb.state ? 'ON' : 'OFF'}
					</button>
				</div>

				{#if bulb.state}
					<div class="bulb-controls">
						<label class="control-row">
							<span class="control-label">Brightness</span>
							<input type="range" min="10" max="100" value={bulb.brightness}
								oninput={(e) => handleBrightness(bulb, e)} />
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

						<div class="control-row scenes-row">
							<span class="control-label">Scene</span>
							<div class="scene-presets">
								{#each Object.entries(WIZ_SCENES) as [id, name]}
									<button
										class:active={bulb.sceneId === parseInt(id)}
										onclick={() => setScene(bulb, parseInt(id))}
									>{name}</button>
								{/each}
							</div>
						</div>
					</div>
				{/if}
			</div>
		{/each}
	</div>
{/if}

<style>
	.header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
	h2 { font-size: 1.3rem; }
	.controls { display: flex; gap: 8px; }
	.btn { padding: 6px 14px; font-size: 0.8rem; border-radius: 6px; border: 1px solid #30363d; background: #21262d; color: #c9d1d9; cursor: pointer; font-family: inherit; }
	.btn:hover:not(:disabled) { border-color: #58a6ff; }
	.btn:disabled { opacity: 0.5; }
	.btn.active { border-color: #3fb950; color: #3fb950; }
	.btn-sm { padding: 4px 10px; font-size: 0.75rem; }

	.group-controls { display: flex; gap: 8px; align-items: center; margin-bottom: 14px; flex-wrap: wrap; padding: 10px 14px; background: #161b22; border: 1px solid #30363d; border-radius: 8px; }
	.select-all { font-size: 0.8rem; color: #8b949e; display: flex; align-items: center; gap: 6px; cursor: pointer; }
	.group-info { font-size: 0.75rem; color: #58a6ff; }

	.empty { text-align: center; padding: 40px; }
	.empty p { color: #8b949e; }
	.hint { font-size: 0.8rem; margin-top: 8px; }

	.bulb-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 16px; }

	.bulb-card { background: #161b22; border: 1px solid #30363d; border-radius: 8px; padding: 16px; transition: border-color 0.15s; }
	.bulb-card:hover { border-color: #484f58; }
	.bulb-card.off { opacity: 0.6; }
	.bulb-card.selected { border-color: #58a6ff; }

	.bulb-top { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px; }
	.bulb-info { display: flex; align-items: flex-start; gap: 8px; }
	.bulb-checkbox { margin-top: 3px; }
	.bulb-name { font-size: 0.85rem; font-weight: 500; cursor: pointer; }
	.bulb-name:hover { color: #58a6ff; }
	.bulb-ip { display: block; font-size: 0.7rem; color: #8b949e; font-family: monospace; }
	.bulb-fw { display: block; font-size: 0.65rem; color: #484f58; }
	.bulb-signal { display: block; font-size: 0.65rem; color: #484f58; }

	.rename-input { width: 140px; padding: 2px 6px; font-size: 0.85rem; border-radius: 4px; border: 1px solid #58a6ff; background: #0d1117; color: #e1e4e8; font-family: inherit; }

	.toggle { padding: 4px 12px; font-size: 0.75rem; font-weight: 600; border-radius: 12px; border: 1px solid #30363d; background: #21262d; color: #8b949e; cursor: pointer; font-family: monospace; }
	.toggle.on { background: #238636; border-color: #2ea043; color: #fff; }

	.bulb-controls { display: flex; flex-direction: column; gap: 10px; padding-top: 12px; border-top: 1px solid #21262d; }
	.control-row { display: flex; align-items: center; gap: 10px; }
	.control-label { font-size: 0.75rem; color: #8b949e; width: 70px; flex-shrink: 0; }
	.control-value { font-size: 0.75rem; color: #8b949e; font-family: monospace; width: 40px; text-align: right; }
	input[type='range'] { flex: 1; accent-color: #58a6ff; }
	input[type='color'] { width: 32px; height: 28px; border: 1px solid #30363d; border-radius: 4px; background: none; cursor: pointer; padding: 0; }

	.temp-presets, .scene-presets { display: flex; gap: 4px; flex-wrap: wrap; }
	.temp-presets button, .scene-presets button { padding: 3px 10px; font-size: 0.7rem; border-radius: 12px; border: 1px solid #30363d; background: #21262d; color: #c9d1d9; cursor: pointer; }
	.temp-presets button:hover, .scene-presets button:hover { border-color: #58a6ff; }
	.temp-presets button.active, .scene-presets button.active { background: #1f6feb33; border-color: #58a6ff; color: #58a6ff; }

	.scenes-row { align-items: flex-start; }
	.scene-presets { max-width: 100%; }
</style>
