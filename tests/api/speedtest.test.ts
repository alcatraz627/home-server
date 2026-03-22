import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { apiJson, BASE } from '../helpers/api';

describe('/api/speedtest', () => {
  it('GET with action=ping returns timestamp', async () => {
    const { res, data } = await apiJson('/api/speedtest?action=ping');
    assert.equal(res.status, 200);
    assert.ok(typeof data.ts === 'number', 'ts should be a number');
    assert.ok(data.ts > 0, 'ts should be a positive timestamp');
    // Should be close to current time
    const diff = Math.abs(Date.now() - data.ts);
    assert.ok(diff < 5000, 'timestamp should be within 5 seconds of now');
  });

  it('GET with action=download returns binary data', async () => {
    const res = await fetch(`${BASE}/api/speedtest?action=download&size=64`);
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('content-type'), 'application/octet-stream');
    const data = await res.arrayBuffer();
    assert.equal(data.byteLength, 64 * 1024, 'should return 64KB');
  });

  it('GET with action=download respects size parameter', async () => {
    const res = await fetch(`${BASE}/api/speedtest?action=download&size=128`);
    assert.equal(res.status, 200);
    const data = await res.arrayBuffer();
    assert.equal(data.byteLength, 128 * 1024, 'should return 128KB');
  });

  it('GET with action=download caps at 10MB', async () => {
    const res = await fetch(`${BASE}/api/speedtest?action=download&size=99999`);
    assert.equal(res.status, 200);
    const data = await res.arrayBuffer();
    assert.equal(data.byteLength, 10240 * 1024, 'should cap at 10MB');
  });

  it('POST receives upload and reports stats', async () => {
    const testData = new Uint8Array(32 * 1024); // 32KB
    const res = await fetch(`${BASE}/api/speedtest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/octet-stream' },
      body: testData,
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.receivedBytes, 32 * 1024, 'should report received bytes');
    assert.ok(typeof data.serverTime === 'number', 'serverTime should be a number');
    assert.ok(typeof data.ts === 'number', 'ts should be a number');
  });

  it('GET without valid action returns 400', async () => {
    const { res, data } = await apiJson('/api/speedtest');
    assert.equal(res.status, 400);
    assert.ok(data.error, 'should have error');
  });
});
