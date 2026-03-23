import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { apiJson } from '../helpers/api';

describe('/api/databases', () => {
  it('GET /api/databases returns services list', async () => {
    const { res, data } = await apiJson('/api/databases');
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(data.services), 'services should be an array');
  });

  it('services have name, installed, running fields', async () => {
    const { data } = await apiJson('/api/databases');
    for (const svc of data.services) {
      assert.ok(typeof svc.name === 'string', 'name should be string');
      assert.ok(typeof svc.installed === 'boolean', 'installed should be boolean');
      assert.ok(typeof svc.running === 'boolean', 'running should be boolean');
    }
  });

  it('checks PostgreSQL, Redis, MongoDB, PM2', async () => {
    const { data } = await apiJson('/api/databases');
    const names = data.services.map((s: any) => s.name);
    assert.ok(names.includes('PostgreSQL'), 'should check PostgreSQL');
    assert.ok(names.includes('Redis'), 'should check Redis');
    assert.ok(names.includes('MongoDB'), 'should check MongoDB');
    assert.ok(names.includes('PM2'), 'should check PM2');
  });

  it('installed services have version', async () => {
    const { data } = await apiJson('/api/databases');
    for (const svc of data.services) {
      if (svc.installed) {
        assert.ok(typeof svc.version === 'string', `${svc.name} version should be string`);
      }
    }
  });
});
