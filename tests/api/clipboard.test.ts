import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import { apiJson, apiPost } from '../helpers/api';

describe('/api/clipboard', () => {
  after(async () => {
    // Clear test entries
    await apiPost('/api/clipboard', { _action: 'clear' });
  });

  it('GET /api/clipboard returns 200 with an array', async () => {
    const { res, data } = await apiJson('/api/clipboard');
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(data), 'should return an array');
  });

  it('POST /api/clipboard adds an entry', async () => {
    const { res, data } = await apiPost('/api/clipboard', {
      content: 'Test clipboard content',
      deviceId: 'test-device',
      deviceName: 'Test Runner',
    });
    assert.equal(res.status, 201);
    assert.ok(data.id, 'should have an id');
    assert.equal(data.content, 'Test clipboard content');
    assert.equal(data.deviceId, 'test-device');
    assert.equal(data.deviceName, 'Test Runner');
    assert.ok(data.timestamp, 'should have a timestamp');
  });

  it('new entries appear at the top (FIFO)', async () => {
    const { data: first } = await apiPost('/api/clipboard', {
      content: 'First entry',
      deviceId: 'test',
      deviceName: 'Test',
    });
    const { data: second } = await apiPost('/api/clipboard', {
      content: 'Second entry',
      deviceId: 'test',
      deviceName: 'Test',
    });

    const { data: listing } = await apiJson('/api/clipboard');
    assert.equal(listing[0].id, second.id, 'newest entry should be first');
    assert.equal(listing[0].content, 'Second entry');
  });

  it('POST with _action=delete removes a specific entry', async () => {
    const { data: created } = await apiPost('/api/clipboard', {
      content: 'Delete me',
      deviceId: 'test',
      deviceName: 'Test',
    });

    const { res, data } = await apiPost('/api/clipboard', {
      _action: 'delete',
      id: created.id,
    });
    assert.equal(res.status, 200);
    assert.ok(data.ok, 'should return ok');

    const { data: listing } = await apiJson('/api/clipboard');
    const found = listing.find((e: any) => e.id === created.id);
    assert.ok(!found, 'deleted entry should not appear');
  });

  it('POST with _action=clear removes all entries', async () => {
    // Add a few entries
    await apiPost('/api/clipboard', { content: 'A', deviceId: 'test', deviceName: 'T' });
    await apiPost('/api/clipboard', { content: 'B', deviceId: 'test', deviceName: 'T' });

    const { res, data } = await apiPost('/api/clipboard', { _action: 'clear' });
    assert.equal(res.status, 200);
    assert.ok(data.ok, 'should return ok');

    const { data: listing } = await apiJson('/api/clipboard');
    assert.equal(listing.length, 0, 'clipboard should be empty after clear');
  });

  it('content is truncated to 10000 characters', async () => {
    const longContent = 'x'.repeat(15000);
    const { data } = await apiPost('/api/clipboard', {
      content: longContent,
      deviceId: 'test',
      deviceName: 'Test',
    });
    assert.ok(data.content.length <= 10000, 'content should be truncated');
  });

  it('defaults deviceId and deviceName when not provided', async () => {
    const { data } = await apiPost('/api/clipboard', {
      content: 'No device info',
    });
    assert.equal(data.deviceId, 'unknown', 'deviceId should default to unknown');
    assert.equal(data.deviceName, 'Unknown Device', 'deviceName should default');
  });
});
