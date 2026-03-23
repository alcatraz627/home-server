import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { apiJson, apiPost } from '../helpers/api';

describe('/api/notifications', () => {
  it('GET /api/notifications returns 200', async () => {
    const { res, data } = await apiJson('/api/notifications');
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(data.notifications), 'notifications should be an array');
    assert.ok(typeof data.unreadCount === 'number', 'unreadCount should be a number');
  });

  it('unreadCount matches unread notifications', async () => {
    const { data } = await apiJson('/api/notifications');
    const unread = data.notifications.filter((n: any) => !n.read);
    assert.equal(data.unreadCount, unread.length, 'unreadCount should match unread items');
  });

  it('markAllRead sets unread to 0', async () => {
    await apiPost('/api/notifications', { action: 'markAllRead' });
    const { data } = await apiJson('/api/notifications');
    assert.equal(data.unreadCount, 0, 'should have 0 unread after markAllRead');
  });

  it('invalid action returns 400', async () => {
    const { res, data } = await apiPost('/api/notifications', { action: 'invalidAction' });
    assert.equal(res.status, 400);
    assert.ok(data.error);
  });
});
