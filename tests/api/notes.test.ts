import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { apiJson, apiPost, apiDelete } from '../helpers/api';

describe('/api/notes', () => {
  let createdId: string;

  it('GET /api/notes returns 200 with notes array', async () => {
    const { res, data } = await apiJson('/api/notes');
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(data.notes), 'notes should be an array');
    assert.ok(typeof data.total === 'number', 'total should be a number');
  });

  it('POST creates a new note', async () => {
    const { res, data } = await apiPost('/api/notes', {
      title: 'Test Note',
    });
    assert.equal(res.status, 201);
    assert.ok(data.id, 'should have an id');
    assert.equal(data.title, 'Test Note');
    assert.ok(Array.isArray(data.blocks), 'should have blocks');
    assert.ok(data.blocks.length > 0, 'should have at least one block');
    createdId = data.id;
  });

  it('GET with id returns the created note', async () => {
    const { res, data } = await apiJson(`/api/notes?id=${createdId}`);
    assert.equal(res.status, 200);
    assert.equal(data.id, createdId);
    assert.equal(data.title, 'Test Note');
  });

  it('PUT updates a note', async () => {
    const { res, data } = await apiJson('/api/notes', {
      method: 'PUT',
      body: JSON.stringify({
        id: createdId,
        title: 'Updated Test Note',
        blocks: [
          { id: 'b1', type: 'heading1', content: 'Hello' },
          { id: 'b2', type: 'text', content: 'World' },
        ],
      }),
    });
    assert.equal(res.status, 200);
    assert.equal(data.title, 'Updated Test Note');
    assert.equal(data.blocks.length, 2);
  });

  it('GET returns updated title in list', async () => {
    const { data } = await apiJson('/api/notes');
    const found = data.notes.find((n: any) => n.id === createdId);
    assert.ok(found, 'note should be in list');
    assert.equal(found.title, 'Updated Test Note');
  });

  it('DELETE removes the note', async () => {
    const { res } = await apiDelete('/api/notes', { id: createdId });
    assert.equal(res.status, 200);

    // Verify it's gone
    const { res: getRes } = await apiJson(`/api/notes?id=${createdId}`);
    assert.equal(getRes.status, 404);
  });

  it('GET with invalid id returns 404', async () => {
    const { res } = await apiJson('/api/notes?id=nonexistent');
    assert.equal(res.status, 404);
  });

  it('DELETE with missing id returns 400', async () => {
    const { res, data } = await apiDelete('/api/notes', {});
    assert.equal(res.status, 400);
    assert.ok(data.error);
  });
});
