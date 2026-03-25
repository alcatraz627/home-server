import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { apiJson } from '../helpers/api';

describe('/api/status', () => {
  it('GET /api/status returns 200', async () => {
    const { res, data } = await apiJson('/api/status');
    assert.equal(res.status, 200);
    assert.ok(data.app, 'should have app section');
    assert.ok(data.server, 'should have server section');
    assert.ok(Array.isArray(data.storage), 'storage should be an array');
  });

  it('app section has version and git info', async () => {
    const { data } = await apiJson('/api/status');
    assert.ok(typeof data.app.version === 'string', 'version should be a string');
    assert.ok(data.app.version.length > 0, 'version should not be empty');
    assert.ok(typeof data.app.nodeVersion === 'string', 'nodeVersion should be a string');
    assert.ok(typeof data.app.pid === 'number', 'pid should be a number');
    assert.ok(typeof data.app.pageCount === 'number', 'pageCount should be a number');
    assert.ok(data.app.pageCount > 20, 'should have 20+ pages');
    assert.ok(data.app.git.branch, 'git branch should exist');
    assert.ok(data.app.git.commit, 'git commit should exist');
  });

  it('server section has hardware info', async () => {
    const { data } = await apiJson('/api/status');
    assert.ok(typeof data.server.hostname === 'string');
    assert.ok(typeof data.server.platform === 'string');
    assert.ok(typeof data.server.cpuCount === 'number');
    assert.ok(data.server.cpuCount > 0, 'should have at least 1 CPU');
  });

  it('process section has app memory info', async () => {
    const { data } = await apiJson('/api/status');
    assert.ok(data.process, 'should have process section');
    assert.ok(typeof data.process.heapUsedMB === 'number');
    assert.ok(typeof data.process.heapTotalMB === 'number');
    assert.ok(typeof data.process.rssMB === 'number');
    assert.ok(data.process.rssMB > 0, 'RSS should be > 0');
    assert.ok(data.process.heapPercent >= 0 && data.process.heapPercent <= 100);
  });

  it('storage entries have name, size, fileCount', async () => {
    const { data } = await apiJson('/api/status');
    for (const entry of data.storage) {
      assert.ok(typeof entry.name === 'string');
      assert.ok(typeof entry.sizeBytes === 'number');
      assert.ok(typeof entry.fileCount === 'number');
    }
  });

  it('totalStorageBytes is sum of entries', async () => {
    const { data } = await apiJson('/api/status');
    const sum = data.storage.reduce((s: number, e: any) => s + e.sizeBytes, 0);
    assert.equal(data.totalStorageBytes, sum);
  });
});
