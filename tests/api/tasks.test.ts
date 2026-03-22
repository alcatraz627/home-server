import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import { apiJson, api, testId } from '../helpers/api';
import { deleteTask } from '../helpers/cleanup';

describe('/api/tasks', () => {
  const createdIds: string[] = [];

  after(async () => {
    for (const id of createdIds) {
      await deleteTask(id);
    }
  });

  it('GET /api/tasks returns 200 with statuses and disk', async () => {
    const { res, data } = await apiJson('/api/tasks');
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(data.statuses), 'statuses should be an array');
    assert.ok(Array.isArray(data.disk), 'disk should be an array');
    assert.ok(typeof data.scheduledCount === 'number', 'scheduledCount should be a number');
  });

  it('disk usage entries have expected shape', async () => {
    const { data } = await apiJson('/api/tasks');
    if (data.disk.length === 0) return;
    const d = data.disk[0];
    assert.ok(typeof d.mount === 'string', 'mount should be a string');
    assert.ok(typeof d.total === 'string', 'total should be a string');
    assert.ok(typeof d.used === 'string', 'used should be a string');
    assert.ok(typeof d.available === 'string', 'available should be a string');
  });

  it('POST /api/tasks creates a new task', async () => {
    const id = testId('task');
    const { res, data } = await apiJson('/api/tasks', {
      method: 'POST',
      body: JSON.stringify({
        id,
        name: 'Test Task',
        command: 'echo "hello from test"',
        timeout: 10,
        maxRetries: 0,
      }),
    });
    assert.equal(res.status, 201);
    assert.equal(data.id, id);
    assert.equal(data.name, 'Test Task');
    assert.equal(data.command, 'echo "hello from test"');
    createdIds.push(id);
  });

  it('created task appears in listing', async () => {
    const id = createdIds[0];
    if (!id) return;
    const { data } = await apiJson('/api/tasks');
    const found = data.statuses.find((s: any) => s.config.id === id);
    assert.ok(found, 'created task should appear in listing');
    assert.equal(found.config.name, 'Test Task');
  });

  it('PUT /api/tasks triggers a task run', async () => {
    const id = createdIds[0];
    if (!id) return;
    const { res, data } = await apiJson('/api/tasks', {
      method: 'PUT',
      body: JSON.stringify({ taskId: id }),
    });
    assert.equal(res.status, 200);
    assert.ok(data.taskId || data.id, 'should return run info');
  });

  it('task run completes and has output', async () => {
    const id = createdIds[0];
    if (!id) return;
    // Wait a moment for the task to finish
    await new Promise((r) => setTimeout(r, 2000));
    const { data } = await apiJson('/api/tasks');
    const status = data.statuses.find((s: any) => s.config.id === id);
    if (status?.lastRun) {
      assert.ok(status.lastRun.status === 'success' || status.lastRun.status === 'error', 'task run should complete');
      if (status.lastRun.status === 'success') {
        assert.ok(status.lastRun.output?.includes('hello from test'), 'output should contain echo text');
      }
    }
  });

  it('PUT /api/tasks returns 400 for nonexistent task', async () => {
    const { res, data } = await apiJson('/api/tasks', {
      method: 'PUT',
      body: JSON.stringify({ taskId: 'nonexistent-task-xyz' }),
    });
    assert.equal(res.status, 400);
    assert.ok(data.error, 'should have error message');
  });

  it('DELETE /api/tasks removes the task', async () => {
    const id = testId('del-task');
    // Create
    await apiJson('/api/tasks', {
      method: 'POST',
      body: JSON.stringify({ id, name: 'Delete Me', command: 'echo hi', timeout: 5 }),
    });

    // Delete
    const res = await api('/api/tasks', {
      method: 'DELETE',
      body: JSON.stringify({ id }),
    });
    assert.equal(res.status, 204);

    // Verify it is gone
    const { data } = await apiJson('/api/tasks');
    const found = data.statuses.find((s: any) => s.config.id === id);
    assert.ok(!found, 'deleted task should not appear in listing');
  });

  it('POST /api/tasks with schedule creates a scheduled task', async () => {
    const id = testId('sched-task');
    const { res, data } = await apiJson('/api/tasks', {
      method: 'POST',
      body: JSON.stringify({
        id,
        name: 'Scheduled Test',
        command: 'echo scheduled',
        schedule: '0 0 * * *',
        timeout: 5,
      }),
    });
    assert.equal(res.status, 201);
    assert.equal(data.schedule, '0 0 * * *');
    createdIds.push(id);
  });
});
