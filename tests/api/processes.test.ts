import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { apiJson, BASE } from '../helpers/api';

describe('/api/processes', () => {
  it('returns 200 with an array of processes', async () => {
    const { res, data } = await apiJson('/api/processes');
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(data), 'should return an array');
    assert.ok(data.length > 0, 'should have at least 1 process');
  });

  it('each process has required fields', async () => {
    const { data } = await apiJson('/api/processes');
    const proc = data[0];
    assert.ok(typeof proc.pid === 'number', 'pid should be a number');
    assert.ok(typeof proc.ppid === 'number', 'ppid should be a number');
    assert.ok(typeof proc.user === 'string', 'user should be a string');
    assert.ok(typeof proc.name === 'string', 'name should be a string');
    assert.ok(typeof proc.cpu === 'number', 'cpu should be a number');
    assert.ok(typeof proc.mem === 'number', 'mem should be a number');
    assert.ok(typeof proc.command === 'string', 'command should be a string');
  });

  it('CPU and memory percentages are in valid range', async () => {
    const { data } = await apiJson('/api/processes');
    for (const proc of data.slice(0, 20)) {
      assert.ok(proc.cpu >= 0, `PID ${proc.pid} CPU should be >= 0, got ${proc.cpu}`);
      assert.ok(proc.mem >= 0, `PID ${proc.pid} MEM should be >= 0, got ${proc.mem}`);
    }
  });

  it('PIDs are positive integers', async () => {
    const { data } = await apiJson('/api/processes');
    for (const proc of data.slice(0, 20)) {
      assert.ok(Number.isInteger(proc.pid), `PID should be integer, got ${proc.pid}`);
      assert.ok(proc.pid > 0, `PID should be positive, got ${proc.pid}`);
    }
  });

  it('can sort by cpu (default)', async () => {
    const { data } = await apiJson('/api/processes?sort=cpu');
    assert.ok(Array.isArray(data), 'should return an array');
    // First few entries should have higher CPU usage (descending sort)
    if (data.length >= 2) {
      assert.ok(data[0].cpu >= data[data.length - 1].cpu, 'should be sorted by CPU descending');
    }
  });

  it('can sort by mem', async () => {
    const { res } = await apiJson('/api/processes?sort=mem');
    assert.equal(res.status, 200);
  });

  it('can sort by pid', async () => {
    const { res } = await apiJson('/api/processes?sort=pid');
    assert.equal(res.status, 200);
  });

  it('can sort by name', async () => {
    const { res } = await apiJson('/api/processes?sort=name');
    assert.equal(res.status, 200);
  });

  it('includes node process (the server itself)', async () => {
    const { data } = await apiJson('/api/processes');
    const nodeProc = data.find((p: any) => p.name === 'node' || p.command?.includes('node'));
    assert.ok(nodeProc, 'should find at least one node process (the server)');
  });
});
