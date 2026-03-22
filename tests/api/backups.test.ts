import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import { apiJson, api, testId } from '../helpers/api';

describe('/api/backups', () => {
  const createdIds: string[] = [];

  after(async () => {
    for (const id of createdIds) {
      await apiJson('/api/backups', {
        method: 'DELETE',
        body: JSON.stringify({ id }),
      });
    }
  });

  it('GET /api/backups returns 200 with statuses and rsync flag', async () => {
    const { res, data } = await apiJson('/api/backups');
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(data.statuses), 'statuses should be an array');
    assert.ok(typeof data.rsyncAvailable === 'boolean', 'rsyncAvailable should be a boolean');
  });

  it('POST /api/backups creates a backup config', async () => {
    const id = testId('backup');
    const { res, data } = await apiJson('/api/backups', {
      method: 'POST',
      body: JSON.stringify({
        id,
        name: 'Test Backup',
        sourcePath: '/tmp/test-source',
        destPath: '/tmp/test-dest',
        excludes: ['.git', 'node_modules'],
      }),
    });
    assert.equal(res.status, 201);
    assert.equal(data.id, id);
    assert.equal(data.name, 'Test Backup');
    assert.equal(data.sourcePath, '/tmp/test-source');
    assert.deepEqual(data.excludes, ['.git', 'node_modules']);
    createdIds.push(id);
  });

  it('created backup appears in listing', async () => {
    const id = createdIds[0];
    if (!id) return;
    const { data } = await apiJson('/api/backups');
    const found = data.statuses.find((s: any) => s.config.id === id);
    assert.ok(found, 'created backup should appear in listing');
    assert.equal(found.config.name, 'Test Backup');
  });

  it('PATCH /api/backups updates a config', async () => {
    const id = createdIds[0];
    if (!id) return;
    const { res, data } = await apiJson('/api/backups', {
      method: 'PATCH',
      body: JSON.stringify({
        id,
        name: 'Updated Backup',
        sourcePath: '/tmp/test-source',
        destPath: '/tmp/test-dest-updated',
        excludes: [],
      }),
    });
    assert.equal(res.status, 200);
    assert.equal(data.name, 'Updated Backup');
    assert.equal(data.destPath, '/tmp/test-dest-updated');
  });

  it('DELETE /api/backups removes the config', async () => {
    const id = testId('del-backup');
    // Create
    await apiJson('/api/backups', {
      method: 'POST',
      body: JSON.stringify({
        id,
        name: 'Delete Me',
        sourcePath: '/tmp/del-src',
        destPath: '/tmp/del-dst',
      }),
    });

    // Delete
    const { res, data } = await apiJson('/api/backups', {
      method: 'DELETE',
      body: JSON.stringify({ id }),
    });
    assert.equal(res.status, 200);
    assert.ok(data.ok, 'should return ok');

    // Verify it is gone
    const { data: listing } = await apiJson('/api/backups');
    const found = listing.statuses.find((s: any) => s.config.id === id);
    assert.ok(!found, 'deleted backup should not appear');
  });

  it('DELETE /api/backups without id returns 400', async () => {
    const { res, data } = await apiJson('/api/backups', {
      method: 'DELETE',
      body: JSON.stringify({}),
    });
    assert.equal(res.status, 400);
    assert.ok(data.error, 'should have error');
  });
});
