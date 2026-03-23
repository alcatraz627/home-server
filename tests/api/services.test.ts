import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { apiJson, apiPost } from '../helpers/api';

describe('/api/services', () => {
  it('GET /api/services returns 200', async () => {
    const { res, data } = await apiJson('/api/services');
    assert.equal(res.status, 200);
    assert.ok(data !== null, 'should return data');
    assert.ok(Array.isArray(data.statuses), 'statuses should be an array');
  });

  it('statuses have service info if configured', async () => {
    const { data } = await apiJson('/api/services');
    if (data.statuses.length === 0) return;
    const svc = data.statuses[0];
    assert.ok(svc.service, 'should have service info');
  });
});
