import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import { apiJson } from '../helpers/api';

const isMac = os.platform() === 'darwin';

describe('macOS-specific tests', () => {
  if (!isMac) {
    it('skips on non-macOS', () => {
      console.log('  SKIP: Not running on macOS');
    });
    return;
  }

  it('/api/system returns macOS swap info via sysctl', async () => {
    const { data } = await apiJson('/api/system');
    assert.ok(data.swap, 'should have swap data on macOS');
    // macOS always has swap configured
    assert.ok(data.swap.total >= 0, 'swap total should be >= 0');
  });

  it('/api/system returns network throughput via netstat', async () => {
    const { data } = await apiJson('/api/system');
    // On macOS with en0, bytesIn/Out should be non-zero if network is active
    assert.ok(typeof data.network.bytesIn === 'number', 'bytesIn should be a number');
    assert.ok(typeof data.network.bytesOut === 'number', 'bytesOut should be a number');
  });

  it('/api/apps returns macOS .app bundles', async () => {
    const { data } = await apiJson('/api/apps');
    assert.ok(data.apps.length > 0, 'should find macOS applications');
    const hasSystem = data.apps.some(
      (a: any) => a.name === 'Safari' || a.name === 'Finder' || a.name === 'System Settings',
    );
    assert.ok(hasSystem, 'should include standard macOS apps');
  });

  it('/api/peripherals returns macOS peripheral data', async () => {
    const { data } = await apiJson('/api/peripherals');
    // On macOS, peripherals uses system_profiler which should return some data
    assert.ok(data !== null, 'should return peripheral data on macOS');
  });

  it('/api/wifi returns WiFi data via system_profiler', async () => {
    const { data } = await apiJson('/api/wifi');
    // WiFi scanning should work on macOS (may be empty if no WiFi adapter)
    assert.ok(data !== null, 'should return wifi data');
  });

  it('/api/processes returns processes with state info', async () => {
    const { data } = await apiJson('/api/processes');
    assert.ok(data.length > 0, 'should have processes');
    // macOS ps output includes state column
    const proc = data[0];
    assert.ok(proc.state !== undefined, 'should have process state on macOS');
  });

  it('/api/tailscale handles macOS Tailscale.app path', async () => {
    const { res } = await apiJson('/api/tailscale');
    // Should not crash even if Tailscale is not installed
    assert.equal(res.status, 200);
  });
});
