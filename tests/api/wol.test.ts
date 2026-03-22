import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import { apiJson, apiPost, testId } from '../helpers/api';

describe('/api/wol', () => {
  const createdIds: string[] = [];

  after(async () => {
    for (const id of createdIds) {
      await apiPost('/api/wol', { _action: 'delete', id });
    }
  });

  it('GET /api/wol returns 200 with an array of devices', async () => {
    const { res, data } = await apiJson('/api/wol');
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(data), 'should return an array');
  });

  it('POST /api/wol adds a new device', async () => {
    const { res, data } = await apiPost('/api/wol', {
      name: 'Test Device',
      mac: 'AA:BB:CC:DD:EE:01',
      ip: '192.168.1.99',
    });
    assert.equal(res.status, 201);
    assert.ok(data.id, 'should have an id');
    assert.equal(data.name, 'Test Device');
    assert.equal(data.mac, 'AA:BB:CC:DD:EE:01');
    assert.equal(data.ip, '192.168.1.99');
    createdIds.push(data.id);
  });

  it('created device appears in listing', async () => {
    const { data } = await apiJson('/api/wol');
    const found = data.find((d: any) => d.mac === 'AA:BB:CC:DD:EE:01');
    assert.ok(found, 'created device should appear in listing');
  });

  it('POST with _action=update modifies a device', async () => {
    const id = createdIds[0];
    if (!id) return;
    const { res, data } = await apiPost('/api/wol', {
      _action: 'update',
      id,
      name: 'Updated Device',
      mac: 'AA:BB:CC:DD:EE:02',
      ip: '192.168.1.100',
    });
    assert.equal(res.status, 200);
    assert.equal(data.name, 'Updated Device');
    assert.equal(data.mac, 'AA:BB:CC:DD:EE:02');
  });

  it('POST with _action=update returns 404 for nonexistent', async () => {
    const { res, data } = await apiPost('/api/wol', {
      _action: 'update',
      id: 'nonexistent-xyz',
      name: 'nope',
      mac: 'FF:FF:FF:FF:FF:FF',
    });
    assert.equal(res.status, 404);
  });

  it('POST with _action=delete removes a device', async () => {
    // Create one to delete
    const { data: created } = await apiPost('/api/wol', {
      name: 'Delete Me',
      mac: 'AA:BB:CC:DD:EE:FF',
    });

    const { res, data } = await apiPost('/api/wol', {
      _action: 'delete',
      id: created.id,
    });
    assert.equal(res.status, 200);
    assert.ok(data.ok, 'should return ok');

    // Verify
    const { data: listing } = await apiJson('/api/wol');
    const found = listing.find((d: any) => d.id === created.id);
    assert.ok(!found, 'deleted device should not appear');
  });

  it('GET /api/wol?action=ping pings a host', async () => {
    const { res, data } = await apiJson('/api/wol?action=ping&ip=127.0.0.1');
    assert.equal(res.status, 200);
    assert.equal(data.ip, '127.0.0.1');
    assert.ok(typeof data.alive === 'boolean', 'alive should be a boolean');
    // localhost should be pingable
    assert.equal(data.alive, true, 'localhost should be alive');
  });

  it('GET /api/wol?action=ping requires ip', async () => {
    const { res, data } = await apiJson('/api/wol?action=ping');
    assert.equal(res.status, 400);
    assert.ok(data.error, 'should have error');
  });

  it('device without ip gets empty string', async () => {
    const { data } = await apiPost('/api/wol', {
      name: 'No IP',
      mac: 'AA:BB:CC:DD:EE:03',
    });
    assert.equal(data.ip, '');
    createdIds.push(data.id);
  });
});
