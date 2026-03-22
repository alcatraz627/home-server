import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import { apiJson, apiPost, testId } from '../helpers/api';

describe('/api/bookmarks', () => {
  const createdIds: string[] = [];

  after(async () => {
    for (const id of createdIds) {
      await apiPost('/api/bookmarks', { _action: 'delete', id });
    }
  });

  it('GET /api/bookmarks returns 200 with an array', async () => {
    const { res, data } = await apiJson('/api/bookmarks');
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(data), 'should return an array');
  });

  it('POST /api/bookmarks creates a bookmark', async () => {
    const { res, data } = await apiPost('/api/bookmarks', {
      url: 'https://example.com/test-' + Date.now(),
      title: 'Test Bookmark',
      description: 'Created by test suite',
      tags: 'test,automated',
    });
    assert.equal(res.status, 201);
    assert.ok(data.id, 'should have an id');
    assert.equal(data.title, 'Test Bookmark');
    assert.ok(data.url.includes('example.com'), 'url should match');
    assert.ok(Array.isArray(data.tags), 'tags should be parsed into array');
    assert.ok(data.tags.includes('test'), 'should include "test" tag');
    assert.ok(data.tags.includes('automated'), 'should include "automated" tag');
    assert.ok(data.createdAt, 'should have createdAt');
    createdIds.push(data.id);
  });

  it('created bookmark appears in listing', async () => {
    const id = createdIds[0];
    if (!id) return;
    const { data } = await apiJson('/api/bookmarks');
    const found = data.find((b: any) => b.id === id);
    assert.ok(found, 'created bookmark should appear in listing');
  });

  it('new bookmarks appear at the top of the list', async () => {
    const { res, data } = await apiPost('/api/bookmarks', {
      url: 'https://example.com/newest-' + Date.now(),
      title: 'Newest Bookmark',
    });
    createdIds.push(data.id);

    const { data: listing } = await apiJson('/api/bookmarks');
    assert.equal(listing[0].id, data.id, 'newest bookmark should be first');
  });

  it('POST with _action=update updates a bookmark', async () => {
    const id = createdIds[0];
    if (!id) return;
    const { res, data } = await apiPost('/api/bookmarks', {
      _action: 'update',
      id,
      title: 'Updated Title',
      description: 'Updated description',
    });
    assert.equal(res.status, 200);
    assert.equal(data.title, 'Updated Title');
    assert.equal(data.description, 'Updated description');
  });

  it('POST with _action=update returns 404 for nonexistent', async () => {
    const { res, data } = await apiPost('/api/bookmarks', {
      _action: 'update',
      id: 'nonexistent-xyz',
      title: 'nope',
    });
    assert.equal(res.status, 404);
  });

  it('POST with _action=delete removes a bookmark', async () => {
    // Create one to delete
    const { data: created } = await apiPost('/api/bookmarks', {
      url: 'https://example.com/delete-me',
      title: 'Delete Me',
    });

    const { res, data } = await apiPost('/api/bookmarks', {
      _action: 'delete',
      id: created.id,
    });
    assert.equal(res.status, 200);
    assert.ok(data.ok, 'should return ok');

    // Verify it is gone
    const { data: listing } = await apiJson('/api/bookmarks');
    const found = listing.find((b: any) => b.id === created.id);
    assert.ok(!found, 'deleted bookmark should not appear');
  });

  it('bookmark with empty tags gets empty array', async () => {
    const { data } = await apiPost('/api/bookmarks', {
      url: 'https://example.com/no-tags-' + Date.now(),
      title: 'No Tags',
      tags: '',
    });
    assert.ok(Array.isArray(data.tags), 'tags should be an array');
    assert.equal(data.tags.length, 0, 'tags should be empty');
    createdIds.push(data.id);
  });

  it('bookmark without title uses URL as title', async () => {
    const url = 'https://example.com/no-title-' + Date.now();
    const { data } = await apiPost('/api/bookmarks', { url });
    assert.equal(data.title, url, 'title should default to URL');
    createdIds.push(data.id);
  });
});
