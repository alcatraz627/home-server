import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { apiJson } from '../helpers/api';

describe('/api/audit', () => {
  it('GET /api/audit returns 200 with audit data', async () => {
    const { res, data } = await apiJson('/api/audit');
    assert.equal(res.status, 200);
    assert.ok(data.summary, 'should have summary');
    assert.ok(Array.isArray(data.pages), 'pages should be an array');
    assert.ok(Array.isArray(data.apiHealth), 'apiHealth should be an array');
    assert.ok(data.timestamp, 'should have timestamp');
  });

  it('pages is a list of page paths', async () => {
    const { data } = await apiJson('/api/audit');
    assert.ok(data.pages.length > 0, 'should have pages');
    for (const page of data.pages.slice(0, 5)) {
      assert.ok(typeof page === 'string', 'page should be a string path');
      assert.ok(page.startsWith('/'), 'page path should start with /');
    }
  });

  it('apiHealth entries have endpoint and status', async () => {
    const { data } = await apiJson('/api/audit');
    for (const entry of data.apiHealth.slice(0, 5)) {
      assert.ok(typeof entry.endpoint === 'string', 'endpoint should be string');
      assert.ok(typeof entry.status === 'number', 'status should be number');
    }
  });

  it('summary describes pass/fail', async () => {
    const { data } = await apiJson('/api/audit');
    assert.ok(typeof data.summary === 'string', 'summary should be a string');
    assert.ok(data.summary.includes('passing'), 'summary should mention passing');
  });
});
