<script lang="ts">
  import type { PageData } from './$types';
  import type { WizBulb } from '$lib/server/wiz';
  import { onMount } from 'svelte';
  import { toast } from '$lib/toast';
  import Button from '$lib/components/Button.svelte';
  import Loading from '$lib/components/Loading.svelte';
  import Collapsible from '$lib/components/Collapsible.svelte';

  import { browser } from '$app/environment';

  let { data } = $props<{ data: PageData }>();

  // Load cached bulbs for instant render, then refresh
  const CACHE_KEY = 'hs:lights-cache';
  function loadCachedBulbs(): WizBulb[] {
    if (!browser) return [];
    try {
      const raw = sessionStorage.getItem(CACHE_KEY);
      if (raw) return JSON.parse(raw);
    } catch {}
    return [];
  }

  function cacheBulbs(b: WizBulb[]) {
    if (browser) {
      try {
        sessionStorage.setItem(CACHE_KEY, JSON.stringify(b));
      } catch {}
    }
  }

  let bulbs = $state<WizBulb[]>(loadCachedBulbs());
  let discovering = $state(bulbs.length === 0);
  let polling = $state(false);
  let pollInterval: ReturnType<typeof setInterval> | null = null;
  let initialLoad = $state(bulbs.length === 0);

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
    Functional: { 11: 'Warm White', 12: 'Daylight', 13: 'Cool White', 14: 'Night Light', 15: 'Focus', 16: 'Relax' },
    Ambient: { 6: 'Cozy', 29: 'Candlelight', 30: 'Golden White', 2: 'Romance', 5: 'Fireplace' },
    Nature: {
      1: 'Ocean',
      7: 'Forest',
      20: 'Spring',
      21: 'Summer',
      22: 'Fall',
      23: 'Deep Dive',
      24: 'Jungle',
      25: 'Mojito',
    },
    Festive: { 3: 'Sunset', 4: 'Party', 26: 'Club', 27: 'Christmas', 28: 'Halloween', 32: 'Steampunk' },
    Dynamic: { 8: 'Pastel Colors', 9: 'Wake Up', 10: 'Bedtime', 17: 'True Colors', 18: 'TV Time', 31: 'Pulse' },
  };

  // Characteristic color dot for each scene ID
  const SCENE_COLORS: Record<number, string> = {
    1: '#0077cc', // Ocean
    2: '#ff6699', // Romance
    3: '#ff6633', // Sunset
    4: '#ff00ff', // Party
    5: '#ff4400', // Fireplace
    6: '#ff8844', // Cozy
    7: '#33aa44', // Forest
    8: '#cc99ff', // Pastel Colors
    9: '#ffee88', // Wake Up
    10: '#6644aa', // Bedtime
    11: '#ffcc66', // Warm White
    12: '#eef4ff', // Daylight
    13: '#d4e6ff', // Cool White
    14: '#ff9933', // Night Light
    15: '#e8f0ff', // Focus
    16: '#ffe0b0', // Relax
    17: '#ffffff', // True Colors
    18: '#4466ff', // TV Time
    19: '#44bb44', // Plant Growth
    20: '#66cc66', // Spring
    21: '#ffdd44', // Summer
    22: '#cc6622', // Fall
    23: '#003388', // Deep Dive
    24: '#228844', // Jungle
    25: '#88ddaa', // Mojito
    26: '#aa00ff', // Club
    27: '#cc0000', // Christmas
    28: '#ff6600', // Halloween
    29: '#ffaa33', // Candlelight
    30: '#ffdd99', // Golden White
    31: '#ff66aa', // Pulse
    32: '#886633', // Steampunk
  };

  // Quick color presets for the color picker row
  const COLOR_PRESETS = [
    { label: 'Warm White', hex: '#ffcc66' },
    { label: 'Cool White', hex: '#d4e6ff' },
    { label: 'Red', hex: '#ff2222' },
    { label: 'Orange', hex: '#ff8800' },
    { label: 'Green', hex: '#22cc44' },
    { label: 'Blue', hex: '#2266ff' },
    { label: 'Purple', hex: '#9933ff' },
    { label: 'Pink', hex: '#ff44bb' },
  ];

  function applyColorPreset(bulb: WizBulb, hex: string) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    bulb.color = { r, g, b };
    bulb.colorTemp = null;
    bulb.sceneId = null;
    debouncedSet(bulb.ip, { r, g, b });
  }

  let debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();

  function loadNames(): Record<string, string> {
    if (typeof localStorage === 'undefined') return {};
    try {
      return JSON.parse(localStorage.getItem('hs:bulb-names') || '{}');
    } catch {
      return {};
    }
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
    try {
      const res = await fetch('/api/lights');
      if (!res.ok) throw new Error('Failed to discover lights');
      const fresh: WizBulb[] = await res.json();
      mergeBulbs(fresh);
    } catch (e: any) {
      toast.error(e.message || 'Failed to discover lights');
    }
    discovering = false;
  }

  /** Merge new bulb data without disrupting existing UI state */
  function mergeBulbs(fresh: WizBulb[]) {
    if (bulbs.length === 0) {
      bulbs = fresh;
      cacheBulbs(fresh);
      return;
    }
    const existing = new Map(bulbs.map((b) => [b.mac, b]));
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
    cacheBulbs(merged);
  }

  async function setBulb(ip: string, params: Record<string, any>) {
    try {
      const res = await fetch(`/api/lights/${encodeURIComponent(ip)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });
      if (!res.ok) throw new Error('Failed to set bulb');
    } catch (e: any) {
      toast.error(e.message || 'Failed to control light', { key: 'light-control' });
    }
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
      }, 300),
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
    try {
      const res = await fetch('/api/lights');
      if (!res.ok) throw new Error('Failed to refresh lights');
      const fresh: WizBulb[] = await res.json();
      mergeBulbs(fresh);
    } catch (e: any) {
      toast.error(e.message || 'Failed to refresh lights', { key: 'light-control' });
    }
  }

  // Group control
  function toggleSelectAll() {
    selectAll = !selectAll;
    if (selectAll) {
      selectedBulbs = new Set(bulbs.map((b) => b.mac));
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
    const targets = bulbs.filter((b) => selectedBulbs.has(b.mac));
    await Promise.all(targets.map((b) => setBulb(b.ip, params)));
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
    try {
      return JSON.parse(localStorage.getItem('hs:bulb-rooms') || '{}');
    } catch {
      return {};
    }
  }

  function saveRoom(mac: string, room: string) {
    rooms = { ...rooms, [mac]: room };
    if (typeof localStorage !== 'undefined') localStorage.setItem('hs:bulb-rooms', JSON.stringify(rooms));
  }

  let allRooms = $derived([...new Set(Object.values(rooms))].filter(Boolean).sort());
  let roomFilter = $state('');

  // Drag-and-drop reordering
  const ORDER_KEY = 'hs:bulb-order';
  let draggedMac = $state<string | null>(null);
  let dragOverMac = $state<string | null>(null);

  function loadOrder(): string[] {
    if (typeof localStorage === 'undefined') return [];
    try {
      return JSON.parse(localStorage.getItem(ORDER_KEY) || '[]');
    } catch {
      return [];
    }
  }

  function saveOrder(order: string[]) {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(ORDER_KEY, JSON.stringify(order));
    }
  }

  let storedOrder = $state<string[]>(loadOrder());

  function sortByOrder(list: WizBulb[]): WizBulb[] {
    if (storedOrder.length === 0) return list;
    return [...list].sort((a, b) => {
      const ai = storedOrder.indexOf(a.mac);
      const bi = storedOrder.indexOf(b.mac);
      if (ai === -1 && bi === -1) return 0;
      if (ai === -1) return 1;
      if (bi === -1) return -1;
      return ai - bi;
    });
  }

  function handleDragStart(mac: string) {
    draggedMac = mac;
  }

  function handleDragOver(e: DragEvent, mac: string) {
    e.preventDefault();
    dragOverMac = mac;
  }

  function handleDrop(mac: string) {
    if (!draggedMac || draggedMac === mac) {
      draggedMac = null;
      dragOverMac = null;
      return;
    }
    const currentList = sortByOrder(roomFilter ? bulbs.filter((b) => rooms[b.mac] === roomFilter) : bulbs);
    const macs = currentList.map((b) => b.mac);
    const fromIdx = macs.indexOf(draggedMac);
    const toIdx = macs.indexOf(mac);
    if (fromIdx !== -1 && toIdx !== -1) {
      macs.splice(fromIdx, 1);
      macs.splice(toIdx, 0, draggedMac);
      storedOrder = macs;
      saveOrder(macs);
    }
    draggedMac = null;
    dragOverMac = null;
  }

  function handleDragEnd() {
    draggedMac = null;
    dragOverMac = null;
  }

  let filteredBulbs = $derived.by(() => {
    let list = roomFilter ? bulbs.filter((b) => rooms[b.mac] === roomFilter) : bulbs;
    return sortByOrder(list);
  });

  // Quick presets (built-in)
  const BUILTIN_PRESETS = [
    { label: 'All Off', icon: '⏻', dimming: 0, temp: 0, state: false },
    { label: 'Movie Mode', icon: '🎬', dimming: 15, temp: 2700, state: true },
    { label: 'Work Mode', icon: '💼', dimming: 80, temp: 5000, state: true },
    { label: 'All On', icon: '☀', dimming: 100, temp: 4000, state: true },
    { label: 'Night Light', icon: '🌙', dimming: 5, temp: 2200, state: true },
    { label: 'Reading', icon: '📖', dimming: 60, temp: 4500, state: true },
  ];

  // Custom presets (localStorage)
  interface CustomPreset {
    label: string;
    icon: string;
    dimming: number;
    temp: number;
    color?: { r: number; g: number; b: number };
  }

  const PRESETS_KEY = 'hs:light-presets';

  function loadCustomPresets(): CustomPreset[] {
    try {
      const raw = localStorage.getItem(PRESETS_KEY);
      if (raw) return JSON.parse(raw);
    } catch {}
    return [];
  }

  let customPresets = $state<CustomPreset[]>(browser ? loadCustomPresets() : []);
  let showPresetForm = $state(false);
  let presetFormName = $state('');
  let presetFormIcon = $state('🔆');
  let presetFormDimming = $state(50);
  let presetFormTemp = $state(4000);

  function saveCustomPresets() {
    if (browser) localStorage.setItem(PRESETS_KEY, JSON.stringify(customPresets));
  }

  function addCustomPreset() {
    if (!presetFormName.trim()) return;
    customPresets = [
      ...customPresets,
      {
        label: presetFormName.trim(),
        icon: presetFormIcon,
        dimming: presetFormDimming,
        temp: presetFormTemp,
      },
    ];
    saveCustomPresets();
    showPresetForm = false;
    presetFormName = '';
  }

  function deleteCustomPreset(idx: number) {
    customPresets = customPresets.filter((_, i) => i !== idx);
    saveCustomPresets();
  }

  function applyPreset(preset: {
    dimming: number;
    temp: number;
    state?: boolean;
    color?: { r: number; g: number; b: number };
  }) {
    if (preset.state === false) {
      groupAction({ state: false });
    } else {
      groupAction({ state: true });
      if (preset.dimming) groupAction({ dimming: preset.dimming });
      if (preset.color) {
        groupAction(preset.color);
      } else if (preset.temp) {
        groupAction({ temp: preset.temp });
      }
    }
  }

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
  <h2 class="page-title">Smart Lights</h2>
  {#if bulbs.length > 0}
    <span class="bulb-count">{bulbs.length} {bulbs.length === 1 ? 'Bulb' : 'Bulbs'} Online</span>
  {/if}
  <div class="controls">
    <Button onclick={rediscover} disabled={discovering} loading={discovering}>
      {#if discovering && bulbs.length > 0}
        Refreshing...
      {:else if discovering}
        Scanning...
      {:else}
        Rediscover
      {/if}
    </Button>
    <Button variant={polling ? 'accent' : 'default'} onclick={togglePolling}>
      Poll {polling ? 'ON' : 'OFF'}
    </Button>
  </div>
</div>
<p class="page-desc">
  Discover and control smart bulbs on your network. Adjust brightness, color temperature, and scenes.
</p>

<!-- Quick Presets -->
{#if bulbs.length > 0}
  <div class="presets-section">
    <div class="presets-header">
      <span class="presets-label">Presets</span>
      <span class="power-est" title="Estimated power consumption">⚡ {estimatePower()}W</span>
      <Button size="sm" onclick={() => (showPresetForm = !showPresetForm)}>
        {showPresetForm ? '✕' : '+ Custom'}
      </Button>
    </div>
    <div class="quick-presets">
      {#each BUILTIN_PRESETS as preset}
        <button
          class="preset-btn"
          onclick={(e) => {
            e.stopPropagation();
            if (selectedBulbs.size === 0) selectedBulbs = new Set(bulbs.map((b) => b.mac));
            applyPreset(preset);
          }}
        >
          <span class="preset-icon">{preset.icon}</span>
          <span class="preset-name">{preset.label}</span>
        </button>
      {/each}
      {#each customPresets as preset, i}
        <div class="preset-custom-wrap">
          <button
            class="preset-btn preset-custom"
            onclick={(e) => {
              e.stopPropagation();
              if (selectedBulbs.size === 0) selectedBulbs = new Set(bulbs.map((b) => b.mac));
              applyPreset(preset);
            }}
          >
            <span class="preset-icon">{preset.icon}</span>
            <span class="preset-name">{preset.label}</span>
          </button>
          <button
            class="preset-delete"
            onclick={(e) => {
              e.stopPropagation();
              deleteCustomPreset(i);
            }}
            title="Remove">✕</button
          >
        </div>
      {/each}
    </div>
    {#if showPresetForm}
      <div class="preset-form slide-down">
        <input type="text" bind:value={presetFormName} placeholder="Preset name" class="preset-input" />
        <input
          type="text"
          bind:value={presetFormIcon}
          placeholder="Icon"
          class="preset-input preset-icon-input"
          maxlength="2"
        />
        <label class="preset-field">
          <span>Brightness</span>
          <input type="range" min="1" max="100" bind:value={presetFormDimming} />
          <span class="preset-val">{presetFormDimming}%</span>
        </label>
        <label class="preset-field">
          <span>Temperature</span>
          <input type="range" min="2200" max="6500" step="100" bind:value={presetFormTemp} />
          <span class="preset-val">{presetFormTemp}K</span>
        </label>
        <Button onclick={addCustomPreset} disabled={!presetFormName.trim()}>Save Preset</Button>
      </div>
    {/if}
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
      <Button size="sm" onclick={() => groupAction({ state: true })}>ON</Button>
      <Button size="sm" onclick={() => groupAction({ state: false })}>OFF</Button>
      <Button size="sm" onclick={() => groupAction({ dimming: 100 })}>100%</Button>
      <Button size="sm" onclick={() => groupAction({ dimming: 50 })}>50%</Button>
      <Button size="sm" onclick={() => groupAction({ dimming: 10 })}>10%</Button>
    {/if}
    {#if allRooms.length > 0}
      <div class="room-filter">
        <Button size="sm" variant={!roomFilter ? 'accent' : 'default'} onclick={() => (roomFilter = '')}>All</Button>
        {#each allRooms as room}
          <Button
            size="sm"
            variant={roomFilter === room ? 'accent' : 'default'}
            onclick={() => (roomFilter = roomFilter === room ? '' : room)}>{room}</Button
          >
        {/each}
      </div>
    {/if}
  </div>
{/if}

{#if discovering && bulbs.length === 0}
  <Loading count={4} height="200px" columns={2} />
{:else if bulbs.length === 0}
  <div class="empty">
    <p>No Wiz bulbs found on the network.</p>
    <p class="hint">Make sure your bulbs are powered on and connected to the same Wi-Fi network.</p>
  </div>
{:else}
  <div class="bulb-grid">
    {#each filteredBulbs as bulb, i}
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div
        class="bulb-card card-stagger"
        style="animation-delay: {i * 40}ms"
        class:off={!bulb.state}
        class:selected={selectedBulbs.has(bulb.mac)}
        class:drag-over={dragOverMac === bulb.mac}
        ondragover={(e) => handleDragOver(e, bulb.mac)}
        ondrop={() => handleDrop(bulb.mac)}
        ondragend={handleDragEnd}
      >
        <!-- Drag handle -->
        <div class="drag-handle" title="Drag to reorder" draggable="true" ondragstart={() => handleDragStart(bulb.mac)}>
          ≡
        </div>
        <!-- Color swatch header -->
        <div
          class="bulb-swatch"
          style="background: {bulb.state
            ? bulb.color
              ? colorHex(bulb)
              : bulb.colorTemp
                ? `color-mix(in srgb, #ff9329 ${Math.round((1 - (bulb.colorTemp - 2700) / 3800) * 100)}%, #b4d7ff)`
                : 'var(--warning)'
            : 'var(--border)'}; opacity: {bulb.state ? (bulb.brightness / 100) * 0.7 + 0.3 : 0.2}"
        ></div>

        <div class="bulb-top" draggable="true" ondragstart={() => handleDragStart(bulb.mac)}>
          <div class="bulb-info">
            {#if bulbs.length > 1}
              <input
                type="checkbox"
                checked={selectedBulbs.has(bulb.mac)}
                onchange={() => toggleSelect(bulb.mac)}
                class="bulb-checkbox"
              />
            {/if}
            <div class="bulb-details">
              <!-- Room tag above name -->
              {#if rooms[bulb.mac]}
                <div class="room-tag-row">
                  <span class="room-tag">{rooms[bulb.mac]}</span>
                </div>
              {/if}
              <div class="bulb-header">
                {#if renamingMac === bulb.mac}
                  <input
                    class="rename-input"
                    type="text"
                    bind:value={renameValue}
                    onkeydown={(e) => {
                      if (e.key === 'Enter') submitRename(bulb.mac);
                      if (e.key === 'Escape') renamingMac = null;
                    }}
                    onblur={() => submitRename(bulb.mac)}
                  />
                {:else}
                  <span
                    class="bulb-name"
                    role="button"
                    tabindex="0"
                    ondblclick={() => startRename(bulb)}
                    onkeydown={(e) => {
                      if (e.key === 'Enter') startRename(bulb);
                    }}>{bulbName(bulb)}</span
                  >
                {/if}
                <button class="toggle" class:on={bulb.state} onclick={() => toggleBulb(bulb)}>
                  {bulb.state ? 'ON' : 'OFF'}
                </button>
              </div>
              <div class="bulb-meta">
                <span>{bulb.ip}</span>
                {#if bulb.rssi != null}<span title="WiFi signal strength">{bulb.rssi}dBm</span>{/if}
                {#if bulb.moduleName}<span title="Module">{bulb.moduleName}</span>{/if}
                {#if bulb.fwVersion}<span title="Firmware">fw {bulb.fwVersion}</span>{/if}
                {#if bulb.brightness && bulb.state}<span title="Brightness">{bulb.brightness}%</span>{/if}
                {#if bulb.colorTemp && bulb.state}<span title="Color temp">{bulb.colorTemp}K</span>{/if}
                {#if bulb.sceneId && allSceneIds()[bulb.sceneId]}
                  <span class="current-scene">Scene: {allSceneIds()[bulb.sceneId]}</span>
                {/if}
              </div>
            </div>
          </div>
        </div>

        <!-- Room assignment (independent save) -->
        <div class="room-assign">
          {#if editingRoom === bulb.mac}
            <input
              class="room-input"
              type="text"
              bind:value={roomValue}
              placeholder="Room name..."
              onkeydown={(e) => {
                if (e.key === 'Enter') {
                  saveRoom(bulb.mac, roomValue.trim());
                  editingRoom = null;
                }
                if (e.key === 'Escape') editingRoom = null;
              }}
              onblur={() => {
                saveRoom(bulb.mac, roomValue.trim());
                editingRoom = null;
              }}
            />
          {:else}
            <button
              class="room-btn"
              onclick={() => {
                editingRoom = bulb.mac;
                roomValue = rooms[bulb.mac] || '';
              }}
            >
              {rooms[bulb.mac] || '+ Room'}
            </button>
          {/if}
        </div>

        {#if bulb.state}
          <div class="bulb-controls">
            <!-- Brightness slider — prominent full-width -->
            <div class="card-section brightness-section">
              <div class="brightness-header">
                <span class="brightness-label">Brightness</span>
                <span class="brightness-value">{bulb.brightness}%</span>
              </div>
              <input
                type="range"
                min="10"
                max="100"
                value={bulb.brightness}
                oninput={(e) => handleBrightness(bulb, e)}
                class="brightness-slider-lg"
              />
            </div>

            <div class="card-divider"></div>

            <!-- Color section -->
            <div class="control-row color-row">
              <span class="control-label">Color</span>
              <div class="color-picker-wrap">
                <div class="color-quick-row">
                  {#each COLOR_PRESETS as preset}
                    <button
                      class="color-dot"
                      class:color-dot-active={bulb.color && colorHex(bulb).toLowerCase() === preset.hex.toLowerCase()}
                      style="--dot-color: {preset.hex}"
                      title={preset.label}
                      onclick={() => applyColorPreset(bulb, preset.hex)}
                      aria-label={preset.label}
                    ></button>
                  {/each}
                  <input
                    type="color"
                    value={colorHex(bulb)}
                    oninput={(e) => handleColor(bulb, e)}
                    title="Custom color"
                    class="color-custom"
                  />
                </div>
              </div>
            </div>

            <div class="card-divider"></div>

            <!-- Temperature section -->
            <div class="control-row">
              <span class="control-label">Temp</span>
              <div class="temp-presets">
                <button class:active={bulb.colorTemp === 2700} onclick={() => setTemp(bulb, 2700)}>Warm</button>
                <button class:active={bulb.colorTemp === 4000} onclick={() => setTemp(bulb, 4000)}>Neutral</button>
                <button class:active={bulb.colorTemp === 6500} onclick={() => setTemp(bulb, 6500)}>Cool</button>
              </div>
            </div>

            <Collapsible title="Scenes" open={false}>
              <div class="scenes-section">
                {#each Object.entries(WIZ_SCENES) as [category, scenes]}
                  <div class="scene-category">
                    <span class="scene-category-label">{category}</span>
                    <div class="scene-presets">
                      {#each Object.entries(scenes) as [id, name]}
                        <button
                          class:active={bulb.sceneId === parseInt(id)}
                          onclick={() => setScene(bulb, parseInt(id))}
                        >
                          {#if SCENE_COLORS[parseInt(id)]}
                            <span
                              class="scene-dot"
                              style="--scene-color: {SCENE_COLORS[parseInt(id)]}"
                              aria-hidden="true"
                            ></span>
                          {/if}
                          {name}
                        </button>
                      {/each}
                    </div>
                  </div>
                {/each}
              </div>
            </Collapsible>
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
  .bulb-count {
    font-size: 0.8rem;
    color: var(--text-muted);
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    padding: 3px 12px;
    border-radius: 12px;
    font-weight: 600;
  }
  .controls {
    display: flex;
    gap: 8px;
  }
  /* Presets section */
  .presets-section {
    margin-bottom: 16px;
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 12px 16px;
  }

  .presets-header {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 10px;
  }

  .presets-label {
    font-size: 0.72rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--text-faint);
  }

  .quick-presets {
    display: flex;
    gap: 6px;
    align-items: center;
    flex-wrap: wrap;
  }

  .preset-btn {
    display: flex;
    align-items: center;
    gap: 5px;
    padding: 6px 12px;
    font-size: 0.75rem;
    border-radius: 20px;
    border: 1px solid var(--border);
    background: var(--btn-bg);
    color: var(--text-secondary);
    cursor: pointer;
    font-family: inherit;
    transition: all 0.15s;
    position: relative;
  }

  .preset-btn:hover:not(:disabled) {
    border-color: var(--accent);
    color: var(--text-primary);
    background: var(--accent-bg);
  }

  .preset-custom {
    border-style: dashed;
  }

  .preset-custom-wrap {
    display: flex;
    align-items: center;
    position: relative;
  }

  .preset-name {
    white-space: nowrap;
  }

  .preset-delete {
    background: none;
    border: none;
    color: var(--text-faint);
    font-size: 0.65rem;
    cursor: pointer;
    padding: 0 2px;
    margin-left: 2px;
  }

  .preset-delete:hover {
    color: var(--danger);
  }

  .preset-icon {
    font-size: 0.9rem;
  }

  .power-est {
    font-size: 0.72rem;
    color: var(--warning);
    font-family: 'JetBrains Mono', monospace;
    margin-left: auto;
  }

  /* Preset form */
  .preset-form {
    margin-top: 10px;
    padding: 10px;
    border-top: 1px solid var(--border-subtle);
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
  }

  .preset-input {
    padding: 5px 10px;
    font-size: 0.78rem;
    border-radius: 6px;
    border: 1px solid var(--border);
    background: var(--input-bg);
    color: var(--text-primary);
    font-family: inherit;
    width: 140px;
  }

  .preset-icon-input {
    width: 44px;
    text-align: center;
  }

  .preset-field {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 0.72rem;
    color: var(--text-muted);
  }

  .preset-field input[type='range'] {
    width: 80px;
    accent-color: var(--accent);
  }

  .preset-val {
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.68rem;
    min-width: 36px;
  }

  .group-controls {
    display: flex;
    gap: 8px;
    align-items: center;
    margin-bottom: 14px;
    flex-wrap: wrap;
    padding: 10px 14px;
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: 8px;
  }
  .select-all {
    font-size: 0.8rem;
    color: var(--text-muted);
    display: flex;
    align-items: center;
    gap: 6px;
    cursor: pointer;
  }
  .group-info {
    font-size: 0.75rem;
    color: var(--accent);
  }
  .room-filter {
    display: flex;
    gap: 4px;
    margin-left: auto;
  }

  .empty {
    text-align: center;
    padding: 40px;
  }
  .empty p {
    color: var(--text-muted);
  }
  .hint {
    font-size: 0.8rem;
    margin-top: 8px;
  }

  .bulb-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
    gap: 16px;
  }

  .bulb-card {
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 0;
    overflow: hidden;
    transition: border-color 0.15s;
    position: relative;
  }
  .bulb-card:hover {
    border-color: var(--text-faint);
  }
  .bulb-card.off {
    opacity: 0.65;
  }
  .bulb-card.selected {
    border-color: var(--accent);
  }
  .bulb-card.drag-over {
    border-color: var(--accent);
    border-style: dashed;
    opacity: 0.8;
  }

  /* Drag handle */
  .drag-handle {
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: 22px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1rem;
    color: var(--text-faint);
    cursor: grab;
    opacity: 0;
    transition: opacity 0.15s;
    z-index: 2;
    user-select: none;
  }
  .drag-handle:active {
    cursor: grabbing;
  }
  .bulb-card:hover .drag-handle {
    opacity: 1;
  }

  /* Color swatch */
  .bulb-swatch {
    height: 6px;
    transition:
      background 0.3s,
      opacity 0.3s;
  }

  .bulb-top {
    margin-bottom: 12px;
    padding: 16px 16px 0;
  }
  .bulb-info {
    display: flex;
    align-items: flex-start;
    gap: 8px;
  }
  .bulb-checkbox {
    margin-top: 5px;
  }
  .bulb-details {
    flex: 1;
  }
  .bulb-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 6px;
  }
  .bulb-name {
    font-size: 1rem;
    font-weight: 600;
    cursor: pointer;
  }
  .bulb-name:hover {
    color: var(--accent);
  }
  .bulb-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 4px 10px;
  }
  .bulb-meta span {
    font-size: 0.7rem;
    color: var(--text-faint);
    font-family: monospace;
  }
  .room-tag-row {
    margin-bottom: 2px;
  }
  .room-tag-row .room-tag {
    display: inline-block;
    font-size: 0.6rem;
    padding: 1px 8px;
    border-radius: 8px;
    background: color-mix(in srgb, var(--purple, #9333ea) 12%, transparent);
    color: var(--purple, #9333ea);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }
  .current-scene {
    color: var(--accent) !important;
    font-weight: 500;
  }

  .rename-input {
    width: 140px;
    padding: 2px 6px;
    font-size: 0.85rem;
    border-radius: 4px;
    border: 1px solid var(--accent);
    background: var(--input-bg);
    color: var(--text-primary);
    font-family: inherit;
  }

  .toggle {
    padding: 8px 18px;
    font-size: 0.85rem;
    font-weight: 700;
    border-radius: 16px;
    border: 2px solid var(--border);
    background: var(--btn-bg);
    color: var(--text-muted);
    cursor: pointer;
    min-width: 56px;
    transition: all 0.2s;
    font-family: monospace;
  }
  .toggle.on {
    background: var(--success);
    border-color: var(--success);
    color: #fff;
  }

  /* Room assignment */
  .room-assign {
    padding: 0 16px 4px;
  }
  .room-btn {
    background: none;
    border: 1px dashed var(--border);
    border-radius: 4px;
    color: var(--text-faint);
    font-size: 0.65rem;
    padding: 2px 8px;
    cursor: pointer;
    font-family: inherit;
  }
  .room-btn:hover {
    border-color: var(--accent);
    color: var(--accent);
  }
  .room-input {
    width: 120px;
    padding: 2px 6px;
    font-size: 0.7rem;
    border-radius: 4px;
    border: 1px solid var(--accent);
    background: var(--input-bg);
    color: var(--text-primary);
    font-family: inherit;
  }
  /* room-tag in meta row (legacy compat) */

  /* Card section dividers */
  .card-divider {
    height: 1px;
    background: var(--border-subtle);
    margin: 2px 0;
  }

  /* Brightness section */
  .brightness-section {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 4px 0;
  }
  .brightness-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .brightness-label {
    font-size: 0.75rem;
    color: var(--text-muted);
  }
  .brightness-value {
    font-size: 0.8rem;
    font-family: 'JetBrains Mono', monospace;
    color: var(--text-primary);
    font-weight: 700;
  }
  .brightness-slider-lg {
    width: 100%;
    height: 8px;
    accent-color: var(--accent);
    cursor: pointer;
    -webkit-appearance: none;
    appearance: none;
    background: var(--border-subtle);
    border-radius: 4px;
    outline: none;
  }
  .brightness-slider-lg::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: var(--accent);
    border: 2px solid var(--bg-secondary);
    cursor: pointer;
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.3);
  }
  .brightness-slider-lg::-moz-range-thumb {
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: var(--accent);
    border: 2px solid var(--bg-secondary);
    cursor: pointer;
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.3);
  }
  .brightness-slider-lg::-webkit-slider-runnable-track {
    height: 8px;
    border-radius: 4px;
    background: var(--border-subtle);
  }
  .brightness-slider-lg::-moz-range-track {
    height: 8px;
    border-radius: 4px;
    background: var(--border-subtle);
  }

  .bulb-controls {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 12px 16px 16px;
    border-top: 1px solid var(--border-subtle);
  }
  .control-row {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .control-label {
    font-size: 0.75rem;
    color: var(--text-muted);
    width: 70px;
    flex-shrink: 0;
  }
  .control-value {
    font-size: 0.75rem;
    color: var(--text-muted);
    font-family: monospace;
    width: 40px;
    text-align: right;
  }
  input[type='range'] {
    flex: 1;
    accent-color: var(--accent);
  }

  .temp-presets,
  .scene-presets {
    display: flex;
    gap: 4px;
    flex-wrap: wrap;
  }
  .temp-presets button,
  .scene-presets button {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 3px 10px;
    font-size: 0.7rem;
    border-radius: 12px;
    border: 1px solid var(--border);
    background: var(--btn-bg);
    color: var(--text-secondary);
    cursor: pointer;
    font-family: inherit;
  }
  .temp-presets button:hover,
  .scene-presets button:hover {
    border-color: var(--accent);
  }
  .temp-presets button.active,
  .scene-presets button.active {
    background: var(--accent-bg);
    border-color: var(--accent);
    color: var(--accent);
  }

  /* Scene color dot */
  .scene-dot {
    display: inline-block;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--scene-color, #888);
    flex-shrink: 0;
    border: 1px solid rgba(0, 0, 0, 0.15);
  }

  /* Enhanced color picker */
  .color-row {
    align-items: flex-start;
    padding-top: 2px;
  }
  .color-picker-wrap {
    flex: 1;
    min-width: 0;
  }
  .color-quick-row {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
  }
  .color-dot {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    background: var(--dot-color, #888);
    border: 2px solid transparent;
    cursor: pointer;
    flex-shrink: 0;
    padding: 0;
    transition:
      border-color 0.12s,
      transform 0.12s;
  }
  .color-dot:hover {
    border-color: var(--text-primary);
    transform: scale(1.15);
  }
  .color-dot.color-dot-active {
    border-color: var(--text-primary);
    box-shadow: 0 0 0 2px var(--accent);
  }
  .color-custom {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    border: 2px solid var(--border);
    background: none;
    cursor: pointer;
    padding: 0;
    overflow: hidden;
    flex-shrink: 0;
  }
  .color-custom:hover {
    border-color: var(--text-primary);
  }

  .scenes-section {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .scene-category {
    display: flex;
    align-items: flex-start;
    gap: 10px;
  }
  .scene-category-label {
    font-size: 0.7rem;
    color: var(--text-muted);
    width: 70px;
    flex-shrink: 0;
    padding-top: 4px;
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }
  .scene-presets {
    max-width: 100%;
  }

  .loading-state {
    text-align: center;
    padding: 60px 20px;
  }
  .loading-state p {
    color: var(--text-muted);
    font-size: 0.9rem;
  }

  .spinner {
    width: 32px;
    height: 32px;
    border: 3px solid var(--border);
    border-top-color: var(--accent);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
    margin: 0 auto 16px;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
</style>
