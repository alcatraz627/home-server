import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import { apiJson } from '../helpers/api';

const isLinux = os.platform() === 'linux';

describe('Linux-specific tests', () => {
  if (!isLinux) {
    it('skips on non-Linux', () => {
      console.log('  SKIP: Not running on Linux');
    });
    return;
  }

  it('/api/system returns swap info via free', async () => {
    const { data } = await apiJson('/api/system');
    assert.ok(data.swap, 'should have swap data');
    assert.ok(typeof data.swap.total === 'number', 'swap total should be a number');
    assert.ok(typeof data.swap.used === 'number', 'swap used should be a number');
  });

  it('/api/system returns network throughput from /proc/net/dev', async () => {
    const { data } = await apiJson('/api/system');
    assert.ok(typeof data.network.bytesIn === 'number', 'bytesIn should be a number');
    assert.ok(typeof data.network.bytesOut === 'number', 'bytesOut should be a number');
  });

  it('/api/processes lists Linux processes', async () => {
    const { data } = await apiJson('/api/processes');
    assert.ok(data.length > 0, 'should have processes');
  });

  it('/api/tailscale handles Linux tailscale binary', async () => {
    const { res } = await apiJson('/api/tailscale');
    assert.equal(res.status, 200);
  });

  it('/api/wifi handles nmcli fallback', async () => {
    const { res } = await apiJson('/api/wifi');
    assert.equal(res.status, 200);
  });

  it('/api/browse can browse /proc', async () => {
    const { data } = await apiJson('/api/browse?path=/proc');
    assert.equal(data.current, '/proc');
    assert.ok(data.entries.length > 0, '/proc should have entries');
  });

  it('/api/browse can browse /etc', async () => {
    const { data } = await apiJson('/api/browse?path=/etc');
    assert.equal(data.current, '/etc');
    assert.ok(data.entries.length > 0, '/etc should have entries');
  });
});
