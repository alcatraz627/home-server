import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import { apiJson, apiPost, testId } from '../helpers/api';

describe('/api/kanban', () => {
  const createdIds: string[] = [];

  after(async () => {
    for (const id of createdIds) {
      await apiPost('/api/kanban', { _action: 'delete', id });
    }
  });

  it('GET /api/kanban returns 200 with an array', async () => {
    const { res, data } = await apiJson('/api/kanban');
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(data), 'should return an array');
  });

  it('POST /api/kanban creates a card in todo column', async () => {
    const { res, data } = await apiPost('/api/kanban', {
      title: 'Test Card',
      color: '#ff0000',
    });
    assert.equal(res.status, 201);
    assert.ok(data.id, 'should have an id');
    assert.equal(data.title, 'Test Card');
    assert.equal(data.color, '#ff0000');
    assert.equal(data.column, 'todo', 'should default to todo column');
    assert.ok(typeof data.order === 'number', 'order should be a number');
    assert.ok(data.createdAt, 'should have createdAt');
    createdIds.push(data.id);
  });

  it('POST /api/kanban creates a card in specific column', async () => {
    const { res, data } = await apiPost('/api/kanban', {
      title: 'Doing Card',
      column: 'doing',
    });
    assert.equal(res.status, 201);
    assert.equal(data.column, 'doing');
    createdIds.push(data.id);
  });

  it('created cards appear in listing', async () => {
    const { data } = await apiJson('/api/kanban');
    for (const id of createdIds) {
      const found = data.find((c: any) => c.id === id);
      assert.ok(found, `card ${id} should appear in listing`);
    }
  });

  it('POST with _action=move moves card to another column', async () => {
    const id = createdIds[0];
    if (!id) return;
    const { res, data } = await apiPost('/api/kanban', {
      _action: 'move',
      id,
      column: 'done',
      order: 0,
    });
    assert.equal(res.status, 200);
    assert.equal(data.column, 'done');
  });

  it('POST with _action=move returns 404 for nonexistent card', async () => {
    const { res, data } = await apiPost('/api/kanban', {
      _action: 'move',
      id: 'nonexistent-xyz',
      column: 'doing',
    });
    assert.equal(res.status, 404);
  });

  it('POST with _action=update updates card properties', async () => {
    const id = createdIds[0];
    if (!id) return;
    const { res, data } = await apiPost('/api/kanban', {
      _action: 'update',
      id,
      title: 'Updated Card',
      color: '#00ff00',
      dueDate: '2026-12-31',
    });
    assert.equal(res.status, 200);
    assert.equal(data.title, 'Updated Card');
    assert.equal(data.color, '#00ff00');
    assert.equal(data.dueDate, '2026-12-31');
  });

  it('POST with _action=update returns 404 for nonexistent card', async () => {
    const { res } = await apiPost('/api/kanban', {
      _action: 'update',
      id: 'nonexistent-xyz',
      title: 'nope',
    });
    assert.equal(res.status, 404);
  });

  it('POST with _action=delete removes a card', async () => {
    const { data: created } = await apiPost('/api/kanban', {
      title: 'Delete Me',
    });

    const { res, data } = await apiPost('/api/kanban', {
      _action: 'delete',
      id: created.id,
    });
    assert.equal(res.status, 200);
    assert.ok(data.ok, 'should return ok');

    // Verify it is gone
    const { data: listing } = await apiJson('/api/kanban');
    const found = listing.find((c: any) => c.id === created.id);
    assert.ok(!found, 'deleted card should not appear');
  });

  it('card without title defaults to Untitled', async () => {
    const { data } = await apiPost('/api/kanban', {});
    assert.equal(data.title, 'Untitled');
    createdIds.push(data.id);
  });

  it('card without color defaults to empty string', async () => {
    const { data } = await apiPost('/api/kanban', { title: 'No Color' });
    assert.equal(data.color, '');
    createdIds.push(data.id);
  });

  it('dueDate can be cleared by passing empty string', async () => {
    const id = createdIds[0];
    if (!id) return;
    const { data } = await apiPost('/api/kanban', {
      _action: 'update',
      id,
      dueDate: '',
    });
    assert.equal(data.dueDate, null, 'empty dueDate should become null');
  });
});
