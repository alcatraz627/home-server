import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { apiJson, BASE } from '../helpers/api';

describe('/api/system', () => {
  it('returns 200 with system stats', async () => {
    const { res, data } = await apiJson('/api/system');
    assert.equal(res.status, 200);
    assert.ok(data.timestamp, 'should have a timestamp');
    assert.ok(typeof data.timestamp === 'number', 'timestamp should be a number');
  });

  it('returns CPU data with cores', async () => {
    const { data } = await apiJson('/api/system');
    assert.ok(data.cpu, 'should have cpu object');
    assert.ok(Array.isArray(data.cpu.cores), 'cpu.cores should be an array');
    assert.ok(data.cpu.cores.length > 0, 'should have at least 1 core');
    assert.ok(typeof data.cpu.avgUsage === 'number', 'avgUsage should be a number');
    assert.ok(data.cpu.avgUsage >= 0 && data.cpu.avgUsage <= 100, 'avgUsage should be 0-100');
    assert.ok(data.cpu.count > 0, 'cpu count should be positive');
  });

  it('returns per-core usage in valid range', async () => {
    const { data } = await apiJson('/api/system');
    for (const core of data.cpu.cores) {
      assert.ok(typeof core.core === 'number', 'core index should be a number');
      assert.ok(typeof core.usage === 'number', 'core usage should be a number');
      assert.ok(core.usage >= 0 && core.usage <= 100, `core ${core.core} usage ${core.usage} should be 0-100`);
    }
  });

  it('returns load averages', async () => {
    const { data } = await apiJson('/api/system');
    assert.ok(Array.isArray(data.cpu.loadAvg), 'loadAvg should be an array');
    assert.equal(data.cpu.loadAvg.length, 3, 'loadAvg should have 3 values (1, 5, 15 min)');
    for (const load of data.cpu.loadAvg) {
      assert.ok(typeof load === 'number', 'load average should be a number');
      assert.ok(load >= 0, 'load average should be non-negative');
    }
  });

  it('returns memory data with valid values', async () => {
    const { data } = await apiJson('/api/system');
    assert.ok(data.memory, 'should have memory object');
    assert.ok(data.memory.total > 0, 'total memory should be positive');
    assert.ok(data.memory.free >= 0, 'free memory should be non-negative');
    assert.ok(data.memory.used > 0, 'used memory should be positive');
    assert.ok(data.memory.usedPercent >= 0 && data.memory.usedPercent <= 100, 'usedPercent should be 0-100');
    // Sanity check: total = used + free
    assert.equal(data.memory.total, data.memory.used + data.memory.free, 'total should equal used + free');
  });

  it('returns swap data', async () => {
    const { data } = await apiJson('/api/system');
    assert.ok(data.swap !== undefined, 'should have swap object');
    assert.ok(typeof data.swap.total === 'number', 'swap.total should be a number');
    assert.ok(typeof data.swap.used === 'number', 'swap.used should be a number');
    assert.ok(typeof data.swap.usedPercent === 'number', 'swap.usedPercent should be a number');
  });

  it('returns network info', async () => {
    const { data } = await apiJson('/api/system');
    assert.ok(data.network !== undefined, 'should have network object');
    assert.ok(typeof data.network.interfaces === 'number', 'interfaces count should be a number');
    assert.ok(typeof data.network.bytesIn === 'number', 'bytesIn should be a number');
    assert.ok(typeof data.network.bytesOut === 'number', 'bytesOut should be a number');
  });

  it('returns process count', async () => {
    const { data } = await apiJson('/api/system');
    assert.ok(typeof data.processCount === 'number', 'processCount should be a number');
    assert.ok(data.processCount > 0, 'should have at least 1 process running');
  });

  it('returns uptime in seconds', async () => {
    const { data } = await apiJson('/api/system');
    assert.ok(typeof data.uptime === 'number', 'uptime should be a number');
    assert.ok(data.uptime > 0, 'uptime should be positive');
  });

  it('returns consistent data on repeated calls', async () => {
    const { data: d1 } = await apiJson('/api/system');
    const { data: d2 } = await apiJson('/api/system');
    // CPU count and memory total should be identical across calls
    assert.equal(d1.cpu.count, d2.cpu.count, 'CPU count should be consistent');
    assert.equal(d1.memory.total, d2.memory.total, 'total memory should be consistent');
  });
});
