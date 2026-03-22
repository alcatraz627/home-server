<script lang="ts">
  import type { PageData } from './$types';
  import { toast } from '$lib/toast';

  interface WolDevice {
    id: string;
    name: string;
    mac: string;
    ip: string;
  }

  let { data } = $props<{ data: PageData }>();
  let devices = $state<WolDevice[]>(data.devices ?? []);

  let showForm = $state(false);
  let editingId = $state<string | null>(null);
  let formName = $state('');
  let formMac = $state('');
  let formIp = $state('');
  let confirmDeleteId = $state<string | null>(null);
  let waking = $state<string | null>(null);
  let pingStatus = $state<Record<string, boolean | null>>({});

  function resetForm() {
    formName = '';
    formMac = '';
    formIp = '';
    editingId = null;
    showForm = false;
  }

  function startEdit(d: WolDevice) {
    editingId = d.id;
    formName = d.name;
    formMac = d.mac;
    formIp = d.ip;
    showForm = true;
  }

  async function saveDevice() {
    if (!formName.trim() || !formMac.trim()) {
      toast.error('Name and MAC address are required');
      return;
    }
    const macRegex = /^([0-9A-Fa-f]{2}[:-]){5}[0-9A-Fa-f]{2}$/;
    if (!macRegex.test(formMac.trim())) {
      toast.error('Invalid MAC address format (e.g., AA:BB:CC:DD:EE:FF)');
      return;
    }

    const payload: any = {
      name: formName.trim(),
      mac: formMac.trim().toUpperCase(),
      ip: formIp.trim(),
    };

    if (editingId) {
      payload._action = 'update';
      payload.id = editingId;
    }

    try {
      const res = await fetch('/api/wol', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error();

      if (editingId) {
        const updated = await res.json();
        devices = devices.map((d) => (d.id === editingId ? updated : d));
        toast.success('Device updated');
      } else {
        const created = await res.json();
        devices = [...devices, created];
        toast.success('Device added');
      }
      resetForm();
    } catch {
      toast.error('Failed to save device');
    }
  }

  async function deleteDevice(id: string) {
    try {
      const res = await fetch('/api/wol', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ _action: 'delete', id }),
      });
      if (!res.ok) throw new Error();
      devices = devices.filter((d) => d.id !== id);
      confirmDeleteId = null;
      toast.success('Device deleted');
    } catch {
      toast.error('Failed to delete device');
    }
  }

  async function wakeDevice(d: WolDevice) {
    waking = d.id;
    try {
      const res = await fetch('/api/wol', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ _action: 'wake', mac: d.mac }),
      });
      const result = await res.json();
      if (result.ok) {
        toast.success(`Magic packet sent to ${d.name}`);
      } else {
        toast.error(result.error || 'Failed to send magic packet');
      }
    } catch {
      toast.error('Failed to wake device');
    } finally {
      waking = null;
    }
  }

  async function pingDevice(d: WolDevice) {
    if (!d.ip) return;
    pingStatus = { ...pingStatus, [d.id]: null };
    try {
      const res = await fetch(`/api/wol?action=ping&ip=${encodeURIComponent(d.ip)}`);
      const result = await res.json();
      pingStatus = { ...pingStatus, [d.id]: result.alive };
    } catch {
      pingStatus = { ...pingStatus, [d.id]: false };
    }
  }
</script>

<div class="page">
  <div class="header">
    <h1>Wake-on-LAN</h1>
    <button
      class="btn-primary"
      onclick={() => {
        resetForm();
        showForm = true;
      }}>Add Device</button
    >
  </div>

  {#if showForm}
    <div class="card form-card">
      <h2>{editingId ? 'Edit' : 'Add'} Device</h2>
      <div class="form-grid">
        <label>
          <span>Device Name *</span>
          <input type="text" bind:value={formName} placeholder="e.g., Desktop PC" />
        </label>
        <label>
          <span>MAC Address *</span>
          <input type="text" bind:value={formMac} placeholder="AA:BB:CC:DD:EE:FF" />
        </label>
        <label>
          <span>IP Address (optional)</span>
          <input type="text" bind:value={formIp} placeholder="192.168.1.100" />
        </label>
      </div>
      <div class="form-actions">
        <button class="btn-primary" onclick={saveDevice}>Save</button>
        <button class="btn-secondary" onclick={resetForm}>Cancel</button>
      </div>
    </div>
  {/if}

  {#if devices.length === 0}
    <div class="card empty">
      <p>No devices configured. Add a device to get started.</p>
    </div>
  {:else}
    <div class="device-grid">
      {#each devices as device (device.id)}
        <div class="card device-card">
          <div class="device-header">
            <div class="device-name-row">
              <h3>{device.name}</h3>
              {#if device.ip && pingStatus[device.id] !== undefined}
                <span
                  class="status-dot"
                  class:online={pingStatus[device.id] === true}
                  class:offline={pingStatus[device.id] === false}
                ></span>
              {/if}
            </div>
            <div class="device-meta">
              <span class="mac">{device.mac}</span>
              {#if device.ip}
                <span class="ip">{device.ip}</span>
              {/if}
            </div>
          </div>
          <div class="device-actions">
            <button class="btn-wake" onclick={() => wakeDevice(device)} disabled={waking === device.id}>
              {waking === device.id ? 'Sending...' : 'Wake'}
            </button>
            {#if device.ip}
              <button class="btn-sm" onclick={() => pingDevice(device)}>Ping</button>
            {/if}
            <button class="btn-sm" onclick={() => startEdit(device)}>Edit</button>
            {#if confirmDeleteId === device.id}
              <button class="btn-sm btn-danger" onclick={() => deleteDevice(device.id)}>Confirm</button>
              <button class="btn-sm" onclick={() => (confirmDeleteId = null)}>Cancel</button>
            {:else}
              <button class="btn-sm btn-danger" onclick={() => (confirmDeleteId = device.id)}>Delete</button>
            {/if}
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .page {
    padding: 1.5rem;
    max-width: 900px;
    margin: 0 auto;
  }
  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1.5rem;
  }
  h1 {
    margin: 0;
    color: var(--text-primary);
  }
  .form-card {
    padding: 1.25rem;
    margin-bottom: 1.5rem;
  }
  .form-card h2 {
    margin: 0 0 1rem;
    font-size: 1.1rem;
    color: var(--text-primary);
  }
  .form-grid {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 0.75rem;
  }
  @media (max-width: 600px) {
    .form-grid {
      grid-template-columns: 1fr;
    }
  }
  label {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
  }
  label span {
    font-size: 0.8rem;
    color: var(--text-secondary);
    font-weight: 500;
  }
  input {
    padding: 0.5rem 0.75rem;
    border: 1px solid var(--border);
    border-radius: 6px;
    background: var(--bg-primary);
    color: var(--text-primary);
    font-size: 0.9rem;
  }
  .form-actions {
    display: flex;
    gap: 0.5rem;
    margin-top: 1rem;
  }
  .device-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
    gap: 1rem;
  }
  .device-card {
    padding: 1.25rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }
  .device-name-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  .device-name-row h3 {
    margin: 0;
    font-size: 1.05rem;
    color: var(--text-primary);
  }
  .status-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: var(--text-muted);
  }
  .status-dot.online {
    background: var(--success);
  }
  .status-dot.offline {
    background: var(--danger);
  }
  .device-meta {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
  }
  .mac {
    font-family: monospace;
    color: var(--text-secondary);
    font-size: 0.85rem;
  }
  .ip {
    color: var(--text-muted);
    font-size: 0.8rem;
  }
  .device-actions {
    display: flex;
    gap: 0.4rem;
    flex-wrap: wrap;
  }
  .btn-wake {
    padding: 0.4rem 1rem;
    background: var(--success);
    color: #fff;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-weight: 600;
    font-size: 0.85rem;
  }
  .btn-wake:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
  .btn-primary,
  .btn-secondary {
    padding: 0.5rem 1rem;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-weight: 600;
    font-size: 0.85rem;
  }
  .btn-primary {
    background: var(--accent);
    color: #fff;
  }
  .btn-secondary {
    background: var(--bg-secondary);
    color: var(--text-primary);
    border: 1px solid var(--border);
  }
  .btn-sm {
    padding: 0.3rem 0.6rem;
    border: 1px solid var(--border);
    border-radius: 4px;
    background: var(--bg-secondary);
    color: var(--text-secondary);
    cursor: pointer;
    font-size: 0.8rem;
  }
  .btn-danger {
    color: var(--danger);
    border-color: var(--danger);
  }
  .empty {
    padding: 2rem;
    text-align: center;
    color: var(--text-muted);
  }
</style>
