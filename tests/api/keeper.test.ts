import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import { apiJson, api, testId } from '../helpers/api';

describe('/api/keeper', () => {
  const createdIds: string[] = [];

  after(async () => {
    for (const id of createdIds) {
      await api('/api/keeper', {
        method: 'DELETE',
        body: JSON.stringify({ id }),
      });
    }
  });

  it('GET /api/keeper returns 200 with requests, stats, and claudeAvailable', async () => {
    const { res, data } = await apiJson('/api/keeper');
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(data.requests), 'requests should be an array');
    assert.ok(data.stats !== undefined, 'should have stats');
    assert.ok(typeof data.claudeAvailable === 'boolean', 'claudeAvailable should be a boolean');
    assert.ok(Array.isArray(data.runningAgents), 'runningAgents should be an array');
  });

  it('POST /api/keeper creates a feature request', async () => {
    const { res, data } = await apiJson('/api/keeper', {
      method: 'POST',
      body: JSON.stringify({
        title: 'Test Feature Request',
        description: 'Created by test suite',
        priority: 'low',
      }),
    });
    assert.equal(res.status, 201);
    assert.ok(data.id, 'should have an id');
    assert.equal(data.title, 'Test Feature Request');
    createdIds.push(data.id);
  });

  it('created request appears in listing', async () => {
    const id = createdIds[0];
    if (!id) return;
    const { data } = await apiJson('/api/keeper');
    const found = data.requests.find((r: any) => r.id === id);
    assert.ok(found, 'created request should appear in listing');
    assert.equal(found.title, 'Test Feature Request');
  });

  it('PUT /api/keeper updates a request', async () => {
    const id = createdIds[0];
    if (!id) return;
    const { res, data } = await apiJson('/api/keeper', {
      method: 'PUT',
      body: JSON.stringify({
        id,
        title: 'Updated Feature Request',
        priority: 'high',
      }),
    });
    assert.equal(res.status, 200);
    assert.equal(data.title, 'Updated Feature Request');
  });

  it('PUT /api/keeper returns 404 for nonexistent request', async () => {
    const { res, data } = await apiJson('/api/keeper', {
      method: 'PUT',
      body: JSON.stringify({ id: 'nonexistent-id-xyz', title: 'nope' }),
    });
    assert.equal(res.status, 404);
    assert.ok(data.error, 'should have error message');
  });

  it('DELETE /api/keeper removes a request', async () => {
    // Create one to delete
    const { data: created } = await apiJson('/api/keeper', {
      method: 'POST',
      body: JSON.stringify({
        title: 'Delete Me',
        description: 'Will be deleted',
      }),
    });

    const res = await api('/api/keeper', {
      method: 'DELETE',
      body: JSON.stringify({ id: created.id }),
    });
    assert.equal(res.status, 204);

    // Verify it is gone
    const { data: listing } = await apiJson('/api/keeper');
    const found = listing.requests.find((r: any) => r.id === created.id);
    assert.ok(!found, 'deleted request should not appear');
  });

  it('DELETE /api/keeper returns 404 for nonexistent id', async () => {
    const { res } = await apiJson('/api/keeper', {
      method: 'DELETE',
      body: JSON.stringify({ id: 'nonexistent-xyz' }),
    });
    assert.equal(res.status, 404);
  });
});
