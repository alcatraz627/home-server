import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { apiJson, apiPost } from '../helpers/api';

describe('/api/benchmarks', () => {
  it('GET /api/benchmarks returns 200 with an array of results', async () => {
    const { res, data } = await apiJson('/api/benchmarks');
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(data), 'should return an array');
  });

  it('POST with _action=run benchmark=cpu runs CPU benchmark', async () => {
    const { res, data } = await apiPost('/api/benchmarks', {
      _action: 'run',
      benchmark: 'cpu',
    });
    assert.equal(res.status, 200);
    assert.ok(data.cpu, 'should have cpu result');
    assert.ok(typeof data.cpu.primes === 'number', 'primes should be a number');
    assert.ok(data.cpu.primes > 0, 'should find primes');
    assert.ok(typeof data.cpu.timeMs === 'number', 'timeMs should be a number');
    assert.ok(data.cpu.timeMs > 0, 'should take some time');
    assert.ok(typeof data.cpu.primesPerSec === 'number', 'primesPerSec should be a number');
    assert.ok(data.cpu.primesPerSec > 0, 'primesPerSec should be positive');
  });

  it('POST with _action=run benchmark=memory runs memory benchmark', async () => {
    const { res, data } = await apiPost('/api/benchmarks', {
      _action: 'run',
      benchmark: 'memory',
    });
    assert.equal(res.status, 200);
    assert.ok(data.memory, 'should have memory result');
    assert.equal(data.memory.sizeMB, 64, 'should test 64MB');
    assert.ok(data.memory.timeMs > 0, 'should take some time');
    assert.ok(data.memory.throughputMBps > 0, 'throughput should be positive');
  });

  it('POST with _action=run benchmark=disk runs disk benchmark', async () => {
    const { res, data } = await apiPost('/api/benchmarks', {
      _action: 'run',
      benchmark: 'disk',
    });
    assert.equal(res.status, 200);
    assert.ok(data.disk, 'should have disk result');
    assert.equal(data.disk.sizeMB, 32, 'should test 32MB');
    assert.ok(data.disk.writeMs > 0, 'write should take some time');
    assert.ok(data.disk.readMs > 0, 'read should take some time');
    assert.ok(data.disk.writeMBps > 0, 'write throughput should be positive');
    assert.ok(data.disk.readMBps > 0, 'read throughput should be positive');
  });

  it('POST with _action=run benchmark=all runs all and saves result', async () => {
    const { res, data } = await apiPost('/api/benchmarks', {
      _action: 'run',
      benchmark: 'all',
    });
    assert.equal(res.status, 201, 'all benchmark should return 201 (saved)');
    assert.ok(data.id, 'should have an id');
    assert.ok(data.timestamp, 'should have a timestamp');
    assert.ok(data.cpu, 'should have cpu');
    assert.ok(data.memory, 'should have memory');
    assert.ok(data.disk, 'should have disk');
  });

  it('saved benchmark appears in GET listing', async () => {
    const { data } = await apiJson('/api/benchmarks');
    assert.ok(data.length > 0, 'should have at least one saved result');
    const latest = data[0];
    assert.ok(latest.id, 'should have an id');
    assert.ok(latest.timestamp, 'should have a timestamp');
    assert.ok(latest.cpu, 'should have cpu data');
  });

  it('POST without valid _action returns 400', async () => {
    const { res, data } = await apiPost('/api/benchmarks', {});
    assert.equal(res.status, 400);
    assert.ok(data.error, 'should have error');
  });

  it('DELETE /api/benchmarks clears history', async () => {
    const res = await fetch(`${process.env.TEST_URL || 'http://localhost:5555'}/api/benchmarks`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(data.ok, 'should return ok');

    const { data: listing } = await apiJson('/api/benchmarks');
    assert.equal(listing.length, 0, 'should be empty after delete');
  });
});
