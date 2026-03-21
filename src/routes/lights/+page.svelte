<script lang="ts">
	import type { PageData } from './$types';
	import type { WizBulb } from '$lib/server/wiz';
	import { onMount } from 'svelte';
	import { toast } from '$lib/toast';

	let { data } = $props<{ data: PageData }>();
	let bulbs = $state<WizBulb[]>([]);
	let discovering = $state(true);
	let polling = $state(false);
	let pollInterval: ReturnType<typeof setInterval> | null = null;
	let initialLoad = $state(true);

	onMount(async () => {
		await rediscover();
		initialLoad = false;
	});

	// Bulb names stored in localStorage
	let bulbNames = $state<Record<string, string>>(loadNames());

	// Group select
	let selectedBulbs = $state<Set<string>>(new Set());
	let selectAll = $state(false);

	const WIZ_SCENES: Record<string, Record<number, string>> = {
		'Functional': { 11: 'Warm White', 12: 'Daylight', 13: 'Cool White', 14: 'Night Light', 15: 'Focus', 16: 'Relax' },
		'Ambient': { 6: 'Cozy', 29: 'Candlelight', 30: 'Golden White', 2: 'Romance', 5: 'Fireplace' },
		'Nature': { 1: 'Ocean', 7: 'Forest', 20: 'Spring', 21: 'Summer', 22: 'Fall', 23: 'Deep Dive', 24: 'Jungle', 25: 'Mojito' },
		'Festive': { 3: 'Sunset', 4: 'Party', 26: 'Club', 27: 'Christmas', 28: 'Halloween', 32: 'Steampunk' },
		'Dynamic': { 8: 'Pastel Colors', 9: 'Wake Up', 10: 'Bedtime', 17: 'True Colors', 18: 'TV Time', 31: 'Pulse' }
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
		const fresh: WizBulb[] = await res.json();
		mergeBulbs(fresh);
		discovering = false;
	}

	/** Merge new bulb data without disrupting existing UI state */
	function mergeBulbs(fresh: WizBulb[]) {
		if (bulbs.length === 0) {
			bulbs = fresh;
			return;
		}
		const existing = new Map(bulbs.map(b => [b.mac, b]));
		const merged: WizBulb[] = [];
		for (const b of fresh) {
			const old = existing.get(b.mac);
			if (old) {
				// Update server-side state, preserve position
				Object.assign(old, b);
				merged.push(old);
				existing.delete(b.mac);
			} else {
				merged.push(b); // New bulb
			}
		}
		bulbs = merged;
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

	function allSceneIds(): Record<number, string> {
		const all: Record<number, string> = {};
		for (const group of Object.values(WIZ_SCENES)) {
			Object.assign(all, group);
		}
		return all;
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
		mergeBulbs(fresh);
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
		for (const b of targets) {
			if ('state' in params) b.state = params.state;
			if ('dimming' in params) b.brightness = params.dimming;
		}
		bulbs = [...bulbs];
		const action = 'state' in params ? (params.state ? 'ON' : 'OFF') : `${params.dimming}%`;
		toast.success(`${targets.length} bulbs → ${action}`);
	}

	// Room grouping (localStorage)
	let rooms = $state<Record<string, string>>(loadRooms());
	let editingRoom = $state<string | null>(null);
	let roomValue = $state('');

	function loadRooms(): Record<string, string> {
		if (typeof localStorage === 'undefined') return {};
		try { return JSON.parse(localStorage.getItem('hs:bulb-rooms') || '{}'); }
		catch { return {}; }
	}

	function saveRoom(mac: string, room: string) {
		rooms = { ...rooms, [mac]: room };
		if (typeof localStorage !== 'undefined') localStorage.setItem('hs:bulb-rooms', JSON.stringify(rooms));
	}

	let allRooms = $derived([...new Set(Object.values(rooms))].filter(Boolean).sort());
	let roomFilter = $state('');

	let filteredBulbs = $derived.by(() => {
		if (!roomFilter) return bulbs;
		return bulbs.filter(b => rooms[b.mac] === roomFilter);
	});

	// Quick presets
	const QUICK_PRESETS = [
		{ label: 'All Off', action: () => groupAction({ state: false }), icon: '⏻' },
		{ label: 'Movie Mode', action: () => { groupAction({ dimming: 15 }); groupAction({ temp: 2700 }); }, icon: '🎬' },
		{ label: 'Work Mode', action: () => { groupAction({ dimming: 80 }); groupAction({ temp: 5000 }); }, icon: '💼' },
		{ label: 'All On 100%', action: () => { groupAction({ state: true }); groupAction({ dimming: 100 }); }, icon: '☀' },
	];

	// Power estimate (~10W per bulb at full brightness)
	function estimatePower(): string {
		const totalWatts = bulbs.reduce((sum, b) => {
			if (!b.state) return sum;
			return sum + (b.brightness / 100) * 10;
		}, 0);
		return totalWatts.toFixed(1);
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
			{#if discovering && bulbs.length > 0}
				<span class="btn-spinner"></span> Refreshing...
			{:else if discovering}
				Scanning...
			{:else}
				Rediscover
			{/if}
		</button>
		<button class="btn" class:active={polling} onclick={togglePolling}>
			Poll {polling ? 'ON' : 'OFF'}
		</button>
	</div>
</div>

<!-- Quick Presets -->
{#if bulbs.length > 0}
	<div class="quick-presets">
		{#each QUICK_PRESETS as preset}
			<button class="preset-btn" onclick={() => { selectedBulbs = new Set(bulbs.map(b => b.mac)); preset.action(); }} disabled={bulbs.length === 0}>
				<span class="preset-icon">{preset.icon}</span> {preset.label}
			</button>
		{/each}
		<span class="power-est" title="Estimated power consumption">⚡ {estimatePower()}W</span>
	</div>
{/if}

<!-- Room Filter + Group Controls -->
{#if bulbs.length > 1}
	<div class="group-controls">
		<label class="select-all">
			<input type="checkbox" checked={selectAll} onchange={toggleSelectAll} />
			Select All
		</label>
		{#if selectedBulbs.size > 0}
			<span class="group-info">{selectedBulbs.size} selected</span>
			<button class="btn btn-sm" onclick={() => groupAction({ state: true })}>ON</button>
			<button class="btn btn-sm" onclick={() => groupAction({ state: false })}>OFF</button>
			<button class="btn btn-sm" onclick={() => groupAction({ dimming: 100 })}>100%</button>
			<button class="btn btn-sm" onclick={() => groupAction({ dimming: 50 })}>50%</button>
			<button class="btn btn-sm" onclick={() => groupAction({ dimming: 10 })}>10%</button>
		{/if}
		{#if allRooms.length > 0}
			<div class="room-filter">
				<button class="btn btn-sm" class:active={!roomFilter} onclick={() => (roomFilter = '')}>All</button>
				{#each allRooms as room}
					<button class="btn btn-sm" class:active={roomFilter === room} onclick={() => (roomFilter = roomFilter === room ? '' : room)}>{room}</button>
				{/each}
			</div>
		{/if}
	</div>
{/if}

{#if initialLoad}
	<div class="loading-state">
		<div class="spinner"></div>
		<p>Scanning for Wiz bulbs on the network...</p>
		<p class="hint">This takes about 3 seconds</p>
	</div>
{:else if bulbs.length === 0}
	<div class="empty">
		<p>No Wiz bulbs found on the network.</p>
		<p class="hint">Make sure your bulbs are powered on and connected to the same Wi-Fi network.</p>
	</div>
{:else}
	<div class="bulb-grid">
		{#each filteredBulbs as bulb}
			<div class="bulb-card" class:off={!bulb.state} class:selected={selectedBulbs.has(bulb.mac)}>
				<!-- Color swatch header -->
				<div class="bulb-swatch" style="background: {bulb.state ? (bulb.color ? colorHex(bulb) : bulb.colorTemp ? `color-mix(in srgb, #ff9329 ${Math.round((1 - (bulb.colorTemp - 2700) / 3800) * 100)}%, #b4d7ff)` : 'var(--warning)') : 'var(--border)'}; opacity: {bulb.state ? (bulb.brightness / 100) * 0.7 + 0.3 : 0.2}"></div>

				<div class="bulb-top">
					<div class="bulb-info">
						{#if bulbs.length > 1}
							<input type="checkbox" checked={selectedBulbs.has(bulb.mac)} onchange={() => toggleSelect(bulb.mac)} class="bulb-checkbox" />
						{/if}
						<div class="bulb-details">
							<div class="bulb-header">
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
								<button class="toggle" class:on={bulb.state} onclick={() => toggleBulb(bulb)}>
									{bulb.state ? 'ON' : 'OFF'}
								</button>
							</div>
							<div class="bulb-meta">
								<span>{bulb.ip}</span>
								{#if rooms[bulb.mac]}
									<span class="room-tag">{rooms[bulb.mac]}</span>
								{/if}
								{#if bulb.rssi != null}<span>{bulb.rssi}dBm</span>{/if}
								{#if bulb.sceneId && allSceneIds()[bulb.sceneId]}
									<span class="current-scene">Scene: {allSceneIds()[bulb.sceneId]}</span>
								{/if}
							</div>
						</div>
					</div>
				</div>

				<!-- Room assignment -->
				<div class="room-assign">
					{#if editingRoom === bulb.mac}
						<input class="room-input" type="text" bind:value={roomValue} placeholder="Room name..."
							onkeydown={(e) => { if (e.key === 'Enter') { saveRoom(bulb.mac, roomValue.trim()); editingRoom = null; } if (e.key === 'Escape') editingRoom = null; }}
							onblur={() => { saveRoom(bulb.mac, roomValue.trim()); editingRoom = null; }}
						/>
					{:else}
						<button class="room-btn" onclick={() => { editingRoom = bulb.mac; roomValue = rooms[bulb.mac] || ''; }}>
							{rooms[bulb.mac] || '+ Room'}
						</button>
					{/if}
				</div>

				{#if bulb.state}
					<div class="bulb-controls">
						<label class="control-row brightness-row">
							<span class="control-label">Brightness</span>
							<div class="brightness-arc">
								<div class="arc-track" style="background: conic-gradient(from 200deg, {bulb.color ? colorHex(bulb) : 'var(--accent)'} {bulb.brightness * 2.8}deg, var(--border-subtle) 0deg)"></div>
								<span class="arc-value">{bulb.brightness}%</span>
							</div>
							<input type="range" min="10" max="100" value={bulb.brightness}
								oninput={(e) => handleBrightness(bulb, e)} />
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

						<div class="scenes-section">
							{#each Object.entries(WIZ_SCENES) as [category, scenes]}
								<div class="scene-category">
									<span class="scene-category-label">{category}</span>
									<div class="scene-presets">
										{#each Object.entries(scenes) as [id, name]}
											<button
												class:active={bulb.sceneId === parseInt(id)}
												onclick={() => setScene(bulb, parseInt(id))}
											>{name}</button>
										{/each}
									</div>
								</div>
							{/each}
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
	.btn { padding: 6px 14px; font-size: 0.8rem; border-radius: 6px; border: 1px solid var(--border); background: var(--btn-bg); color: var(--text-secondary); cursor: pointer; font-family: inherit; }
	.btn:hover:not(:disabled) { border-color: var(--accent); }
	.btn:disabled { opacity: 0.5; }
	.btn.active { border-color: var(--success); color: var(--success); }
	.btn-sm { padding: 4px 10px; font-size: 0.75rem; }

	/* Quick presets */
	.quick-presets { display: flex; gap: 8px; align-items: center; margin-bottom: 12px; flex-wrap: wrap; }
	.preset-btn { display: flex; align-items: center; gap: 6px; padding: 8px 16px; font-size: 0.8rem; border-radius: 8px; border: 1px solid var(--border); background: var(--bg-secondary); color: var(--text-secondary); cursor: pointer; font-family: inherit; transition: all 0.15s; }
	.preset-btn:hover:not(:disabled) { border-color: var(--accent); color: var(--text-primary); }
	.preset-icon { font-size: 1rem; }
	.power-est { font-size: 0.75rem; color: var(--warning); font-family: 'JetBrains Mono', monospace; margin-left: auto; }

	.group-controls { display: flex; gap: 8px; align-items: center; margin-bottom: 14px; flex-wrap: wrap; padding: 10px 14px; background: var(--bg-secondary); border: 1px solid var(--border); border-radius: 8px; }
	.select-all { font-size: 0.8rem; color: var(--text-muted); display: flex; align-items: center; gap: 6px; cursor: pointer; }
	.group-info { font-size: 0.75rem; color: var(--accent); }
	.room-filter { display: flex; gap: 4px; margin-left: auto; }

	.empty { text-align: center; padding: 40px; }
	.empty p { color: var(--text-muted); }
	.hint { font-size: 0.8rem; margin-top: 8px; }

	.bulb-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 16px; }

	.bulb-card { background: var(--bg-secondary); border: 1px solid var(--border); border-radius: 10px; padding: 0; overflow: hidden; transition: border-color 0.15s; }
	.bulb-card:hover { border-color: var(--text-faint); }
	.bulb-card.off { opacity: 0.65; }
	.bulb-card.selected { border-color: var(--accent); }

	/* Color swatch */
	.bulb-swatch { height: 6px; transition: background 0.3s, opacity 0.3s; }

	.bulb-top { margin-bottom: 12px; padding: 16px 16px 0; }
	.bulb-info { display: flex; align-items: flex-start; gap: 8px; }
	.bulb-checkbox { margin-top: 5px; }
	.bulb-details { flex: 1; }
	.bulb-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; }
	.bulb-name { font-size: 1rem; font-weight: 600; cursor: pointer; }
	.bulb-name:hover { color: var(--accent); }
	.bulb-meta { display: flex; flex-wrap: wrap; gap: 4px 10px; }
	.bulb-meta span { font-size: 0.7rem; color: var(--text-faint); font-family: monospace; }
	.current-scene { color: var(--accent) !important; font-weight: 500; }

	.rename-input { width: 140px; padding: 2px 6px; font-size: 0.85rem; border-radius: 4px; border: 1px solid var(--accent); background: var(--input-bg); color: var(--text-primary); font-family: inherit; }

	.toggle { padding: 4px 12px; font-size: 0.75rem; font-weight: 600; border-radius: 12px; border: 1px solid var(--border); background: var(--btn-bg); color: var(--text-muted); cursor: pointer; font-family: monospace; }
	.toggle.on { background: var(--success); border-color: var(--success); color: #fff; }

	/* Room assignment */
	.room-assign { padding: 0 16px 4px; }
	.room-btn { background: none; border: 1px dashed var(--border); border-radius: 4px; color: var(--text-faint); font-size: 0.65rem; padding: 2px 8px; cursor: pointer; font-family: inherit; }
	.room-btn:hover { border-color: var(--accent); color: var(--accent); }
	.room-input { width: 120px; padding: 2px 6px; font-size: 0.7rem; border-radius: 4px; border: 1px solid var(--accent); background: var(--input-bg); color: var(--text-primary); font-family: inherit; }
	.room-tag { color: var(--purple) !important; font-weight: 500; }

	/* Brightness arc */
	.brightness-row { flex-wrap: wrap; }
	.brightness-arc { width: 48px; height: 48px; border-radius: 50%; position: relative; flex-shrink: 0; }
	.arc-track { width: 100%; height: 100%; border-radius: 50%; }
	.arc-value { position: absolute; inset: 6px; background: var(--bg-secondary); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 0.6rem; font-family: 'JetBrains Mono', monospace; color: var(--text-primary); font-weight: 600; }

	.bulb-controls { display: flex; flex-direction: column; gap: 10px; padding: 12px 16px 16px; border-top: 1px solid var(--border-subtle); }
	.control-row { display: flex; align-items: center; gap: 10px; }
	.control-label { font-size: 0.75rem; color: var(--text-muted); width: 70px; flex-shrink: 0; }
	.control-value { font-size: 0.75rem; color: var(--text-muted); font-family: monospace; width: 40px; text-align: right; }
	input[type='range'] { flex: 1; accent-color: var(--accent); }
	input[type='color'] { width: 32px; height: 28px; border: 1px solid var(--border); border-radius: 4px; background: none; cursor: pointer; padding: 0; }

	.temp-presets, .scene-presets { display: flex; gap: 4px; flex-wrap: wrap; }
	.temp-presets button, .scene-presets button { padding: 3px 10px; font-size: 0.7rem; border-radius: 12px; border: 1px solid var(--border); background: var(--btn-bg); color: var(--text-secondary); cursor: pointer; }
	.temp-presets button:hover, .scene-presets button:hover { border-color: var(--accent); }
	.temp-presets button.active, .scene-presets button.active { background: var(--accent-bg); border-color: var(--accent); color: var(--accent); }

	.scenes-section { padding-top: 10px; border-top: 1px solid var(--border-subtle); display: flex; flex-direction: column; gap: 8px; }
	.scene-category { display: flex; align-items: flex-start; gap: 10px; }
	.scene-category-label { font-size: 0.7rem; color: var(--text-muted); width: 70px; flex-shrink: 0; padding-top: 4px; text-transform: uppercase; letter-spacing: 0.03em; }
	.scene-presets { max-width: 100%; }

	.btn-spinner {
		display: inline-block;
		width: 10px; height: 10px;
		border: 2px solid var(--border);
		border-top-color: var(--accent);
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
		vertical-align: middle;
	}

	.loading-state { text-align: center; padding: 60px 20px; }
	.loading-state p { color: var(--text-muted); font-size: 0.9rem; }

	.spinner {
		width: 32px; height: 32px;
		border: 3px solid var(--border);
		border-top-color: var(--accent);
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
		margin: 0 auto 16px;
	}

	@keyframes spin {
		to { transform: rotate(360deg); }
	}
</style>
