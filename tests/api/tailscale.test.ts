import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { apiJson } from '../helpers/api';

describe('/api/tailscale', () => {
  it('returns 200', async () => {
    const { res, data } = await apiJson('/api/tailscale');
    assert.equal(res.status, 200);
    assert.ok(data !== null && data !== undefined, 'should return data');
  });

  it('returns devices array or error', async () => {
    const { data } = await apiJson('/api/tailscale');
    // Tailscale may or may not be installed/running
    if (data.error) {
      assert.ok(typeof data.error === 'string', 'error should be a string');
    } else {
      assert.ok(Array.isArray(data.devices), 'should have devices array when no error');
    }
  });

  it('devices have expected shape when tailscale is running', async () => {
    const { data } = await apiJson('/api/tailscale');
    if (data.error || !data.devices || data.devices.length === 0) {
      // Tailscale not available or no devices - skip validation
      return;
    }

    const device = data.devices[0];
    assert.ok(typeof device.hostname === 'string', 'hostname should be a string');
    assert.ok(typeof device.online === 'boolean', 'online should be a boolean');
  });

  it('includes self device when tailscale is running', async () => {
    const { data } = await apiJson('/api/tailscale');
    if (data.error || !data.devices) return;

    const self = data.devices.find((d: any) => d.isSelf === true);
    // Self device should exist if tailscale is configured
    if (data.devices.length > 0) {
      assert.ok(self, 'should include self device');
      assert.equal(self.online, true, 'self should be online');
    }
  });
});
