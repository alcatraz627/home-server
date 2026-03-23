import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { apiJson } from '../helpers/api';

describe('/api/docker', () => {
  it('GET /api/docker returns 200', async () => {
    const { res, data } = await apiJson('/api/docker');
    assert.equal(res.status, 200);
    assert.ok(data !== null, 'should return data');
  });

  it('returns installed flag and containers array', async () => {
    const { data } = await apiJson('/api/docker');
    assert.ok(typeof data.installed === 'boolean', 'installed should be boolean');
    assert.ok(Array.isArray(data.containers), 'containers should be an array');
  });

  it('if docker is installed, containers have expected fields', async () => {
    const { data } = await apiJson('/api/docker');
    if (!data.installed || data.containers.length === 0) return;
    const c = data.containers[0];
    assert.ok(typeof c.id === 'string', 'id should be string');
    assert.ok(typeof c.name === 'string', 'name should be string');
    assert.ok(typeof c.image === 'string', 'image should be string');
    assert.ok(typeof c.state === 'string', 'state should be string');
  });
});
