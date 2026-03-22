import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { apiJson, BASE } from '../helpers/api';

describe('/api/terminal (integration)', () => {
  it('GET /api/terminal lists sessions', async () => {
    const { res, data } = await apiJson('/api/terminal');
    assert.equal(res.status, 200);
    assert.ok(data.sessions !== undefined, 'should have sessions field');
    assert.ok(Array.isArray(data.sessions), 'sessions should be an array');
  });

  it('sessions have expected shape when present', async () => {
    const { data } = await apiJson('/api/terminal');
    if (data.sessions.length === 0) return;
    const session = data.sessions[0];
    assert.ok(typeof session.id === 'string' || typeof session.id === 'number', 'session should have an id');
  });

  // Note: WebSocket terminal tests require a WebSocket client library.
  // Since we are using only node:test with no external deps, we test
  // the REST API portions. Full WebSocket lifecycle testing would need
  // the 'ws' package.

  it('terminal endpoint is reachable', async () => {
    const res = await fetch(`${BASE}/api/terminal`);
    assert.equal(res.status, 200);
  });
});
