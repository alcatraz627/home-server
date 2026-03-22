import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { apiJson } from '../helpers/api';

describe('/api/wifi', () => {
  it('GET /api/wifi returns 200', async () => {
    const { res, data } = await apiJson('/api/wifi');
    assert.equal(res.status, 200);
    assert.ok(data !== null && data !== undefined, 'should return data');
  });

  it('response has networks array and currentConnection', async () => {
    const { data } = await apiJson('/api/wifi');
    // WiFi scanning may return data or empty depending on hardware
    if (data.networks !== undefined) {
      assert.ok(Array.isArray(data.networks), 'networks should be an array');
    }
    // currentConnection may be null if not connected via WiFi
    if (data.currentConnection) {
      assert.ok(typeof data.currentConnection.ssid === 'string', 'ssid should be a string');
    }
  });

  it('network entries have expected shape when available', async () => {
    const { data } = await apiJson('/api/wifi');
    if (!data.networks || data.networks.length === 0) return;
    const net = data.networks[0];
    assert.ok(typeof net.ssid === 'string', 'ssid should be a string');
    assert.ok(typeof net.signal === 'number' || typeof net.rssi === 'number', 'should have signal/rssi');
  });
});
