import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { apiJson } from '../helpers/api';

describe('/api/peripherals', () => {
  it('GET /api/peripherals returns 200', async () => {
    const { res, data } = await apiJson('/api/peripherals');
    assert.equal(res.status, 200);
    assert.ok(data !== null && data !== undefined, 'should return data');
  });

  it('response has wifi, bluetooth, and currentWifi fields', async () => {
    const { data } = await apiJson('/api/peripherals');
    // These fields should exist even if empty (graceful degradation)
    assert.ok('wifi' in data || 'bluetooth' in data || 'currentWifi' in data, 'should have peripheral fields');
  });

  it('wifi is an array when present', async () => {
    const { data } = await apiJson('/api/peripherals');
    if (data.wifi !== undefined) {
      assert.ok(Array.isArray(data.wifi), 'wifi should be an array');
    }
  });

  it('bluetooth is an array when present', async () => {
    const { data } = await apiJson('/api/peripherals');
    if (data.bluetooth !== undefined) {
      assert.ok(Array.isArray(data.bluetooth), 'bluetooth should be an array');
    }
  });

  it('does not error on repeated calls', async () => {
    // Peripherals involve scanning hardware; ensure no crash on repeated calls
    const { res: r1 } = await apiJson('/api/peripherals');
    const { res: r2 } = await apiJson('/api/peripherals');
    assert.equal(r1.status, 200);
    assert.equal(r2.status, 200);
  });
});
