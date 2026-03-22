import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { apiJson } from '../helpers/api';

describe('/api/lights (integration)', () => {
  it('GET /api/lights returns 200', async () => {
    const { res, data } = await apiJson('/api/lights');
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(data), 'should return an array');
  });

  it('discovered bulbs have expected shape', async () => {
    const { data } = await apiJson('/api/lights');
    if (data.length === 0) {
      // No bulbs found on the network - this is expected in many environments
      console.log('  SKIP: No Wiz bulbs discovered on network');
      return;
    }
    const bulb = data[0];
    assert.ok(typeof bulb.ip === 'string', 'ip should be a string');
    assert.ok(typeof bulb.mac === 'string', 'mac should be a string');
    assert.ok(typeof bulb.state === 'boolean', 'state should be a boolean');
  });

  it('bulb IP addresses are valid when present', async () => {
    const { data } = await apiJson('/api/lights');
    if (data.length === 0) return;
    for (const bulb of data) {
      const parts = bulb.ip.split('.');
      assert.equal(parts.length, 4, `${bulb.ip} should have 4 octets`);
      for (const part of parts) {
        const n = parseInt(part, 10);
        assert.ok(n >= 0 && n <= 255, `octet ${part} should be 0-255`);
      }
    }
  });
});
