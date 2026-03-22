import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { apiJson, BASE } from '../helpers/api';

describe('/api/screenshots', () => {
  it('GET /api/screenshots returns 200 with an array', async () => {
    const { res, data } = await apiJson('/api/screenshots');
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(data), 'should return an array');
  });

  it('screenshot entries have expected shape', async () => {
    const { data } = await apiJson('/api/screenshots');
    if (data.length === 0) return; // no screenshots is valid
    const s = data[0];
    assert.ok(typeof s.filename === 'string', 'filename should be a string');
    assert.ok(typeof s.size === 'number', 'size should be a number');
    assert.ok(typeof s.timestamp === 'string', 'timestamp should be a string');
    // Validate timestamp is a valid ISO date
    assert.ok(!isNaN(Date.parse(s.timestamp)), 'timestamp should be parseable');
  });

  it('screenshots are sorted newest first', async () => {
    const { data } = await apiJson('/api/screenshots');
    if (data.length < 2) return;
    const t1 = new Date(data[0].timestamp).getTime();
    const t2 = new Date(data[1].timestamp).getTime();
    assert.ok(t1 >= t2, 'should be sorted newest first');
  });

  it('GET with action=image requires file parameter', async () => {
    const { res, data } = await apiJson('/api/screenshots?action=image');
    assert.equal(res.status, 400);
    assert.ok(data.error, 'should have error');
  });

  it('GET with action=image returns 404 for nonexistent file', async () => {
    const { res, data } = await apiJson('/api/screenshots?action=image&file=nonexistent.png');
    assert.equal(res.status, 404);
    assert.ok(data.error, 'should have error');
  });

  // Note: We skip the actual capture test (POST _action=capture) because it requires
  // screen recording permissions and a display. The listing test above is sufficient
  // for CI/automated testing.

  it('POST without valid action returns 400', async () => {
    const res = await fetch(`${BASE}/api/screenshots`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    assert.equal(res.status, 400);
  });

  it('POST with _action=delete handles nonexistent file gracefully', async () => {
    const res = await fetch(`${BASE}/api/screenshots`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ _action: 'delete', filename: 'nonexistent-xyz.png' }),
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(data.ok, 'should return ok even if file does not exist');
  });
});
