import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { apiJson, apiPost } from '../helpers/api';

describe('/api/logs', () => {
  it('GET /api/logs returns entries', async () => {
    const { res, data } = await apiJson('/api/logs');
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(data.entries), 'entries should be an array');
    assert.ok(typeof data.count === 'number', 'count should be a number');
  });

  it('GET /api/logs?action=files lists log files', async () => {
    const { res, data } = await apiJson('/api/logs?action=files');
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(data.files), 'files should be an array');
  });

  it('GET /api/logs?action=stats returns stats', async () => {
    const { res, data } = await apiJson('/api/logs?action=stats');
    assert.equal(res.status, 200);
    assert.ok(typeof data.totalFiles === 'number');
    assert.ok(typeof data.totalSize === 'number');
  });

  it('GET /api/logs?action=diagnose returns diagnostics', async () => {
    const { res, data } = await apiJson('/api/logs?action=diagnose');
    assert.equal(res.status, 200);
    assert.ok(data.stats, 'should have stats');
    assert.ok(Array.isArray(data.recentErrors), 'recentErrors should be array');
    assert.ok(typeof data.summary === 'string', 'summary should be string');
  });

  it('POST /api/logs accepts client error report', async () => {
    const { res, data } = await apiPost('/api/logs', {
      message: 'Test client error',
      url: '/test',
    });
    assert.equal(res.status, 200);
    assert.ok(data.ok, 'should return ok');
  });

  it('GET /api/logs?action=raw requires file param', async () => {
    const { res, data } = await apiJson('/api/logs?action=raw');
    assert.equal(res.status, 400);
    assert.ok(data.error);
  });

  it('GET /api/logs supports level filter', async () => {
    const { res, data } = await apiJson('/api/logs?level=error&limit=10');
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(data.entries));
    for (const entry of data.entries) {
      assert.equal(entry.level, 'error', 'filtered entries should all be error level');
    }
  });
});
