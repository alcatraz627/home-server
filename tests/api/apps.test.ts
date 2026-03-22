import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import { apiJson } from '../helpers/api';

describe('/api/apps', () => {
  const isMac = os.platform() === 'darwin';

  it('GET /api/apps returns 200 with an array', async () => {
    const { res, data } = await apiJson('/api/apps');
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(data), 'should return an array');
  });

  it('on macOS, returns installed applications', async () => {
    if (!isMac) return; // skip on non-macOS
    const { data } = await apiJson('/api/apps');
    assert.ok(data.length > 0, 'macOS should have applications in /Applications');
  });

  it('app entries have name and path', async () => {
    const { data } = await apiJson('/api/apps');
    if (data.length === 0) return;
    const app = data[0];
    assert.ok(typeof app.name === 'string', 'name should be a string');
    assert.ok(typeof app.path === 'string', 'path should be a string');
    assert.ok(app.name.length > 0, 'name should not be empty');
  });

  it('apps are sorted alphabetically', async () => {
    const { data } = await apiJson('/api/apps');
    if (data.length < 2) return;
    for (let i = 1; i < data.length; i++) {
      assert.ok(
        data[i].name.localeCompare(data[i - 1].name) >= 0,
        `${data[i].name} should come after ${data[i - 1].name}`,
      );
    }
  });

  it('on macOS, app paths point to .app bundles', async () => {
    if (!isMac) return;
    const { data } = await apiJson('/api/apps');
    if (data.length === 0) return;
    for (const app of data.slice(0, 5)) {
      assert.ok(app.path.endsWith('.app'), `${app.path} should end with .app`);
      assert.ok(app.path.startsWith('/Applications'), `${app.path} should start with /Applications`);
    }
  });
});
