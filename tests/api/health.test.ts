import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { apiJson } from '../helpers/api';

describe('/api/health', () => {
  it('GET /api/health returns 200 with status', async () => {
    const { res, data } = await apiJson('/api/health');
    assert.equal(res.status, 200);
    assert.ok(['green', 'yellow', 'red'].includes(data.status), 'status should be green/yellow/red');
  });

  it('returns hostname and uptime for local check', async () => {
    const { data } = await apiJson('/api/health');
    assert.ok(typeof data.hostname === 'string', 'hostname should be a string');
    assert.ok(typeof data.uptime === 'number', 'uptime should be a number');
    assert.ok(data.uptime >= 0, 'uptime should be non-negative');
  });

  it('returns load and memory info', async () => {
    const { data } = await apiJson('/api/health');
    assert.ok(typeof data.load === 'number', 'load should be a number');
    assert.ok(typeof data.memPercent === 'number', 'memPercent should be a number');
    assert.ok(data.memPercent >= 0 && data.memPercent <= 100, 'memPercent should be 0-100');
  });

  it('latency is 0 for local check', async () => {
    const { data } = await apiJson('/api/health');
    assert.equal(data.latency, 0, 'local check latency should be 0');
  });

  it('remote check returns error for unreachable target', async () => {
    const { res, data } = await apiJson('/api/health?target=192.0.2.1:9999');
    assert.equal(res.status, 200);
    assert.equal(data.status, 'red', 'unreachable target should be red');
    assert.ok(data.error, 'should have error message');
  });
});
