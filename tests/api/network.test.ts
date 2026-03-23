import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { apiJson, apiPost } from '../helpers/api';

describe('/api/network', () => {
  it('GET /api/network?tool=arp returns ARP table', async () => {
    const { res, data } = await apiJson('/api/network?tool=arp');
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(data.entries), 'entries should be array');
  });

  it('GET /api/network?tool=bandwidth returns interface stats', async () => {
    const { res, data } = await apiJson('/api/network?tool=bandwidth');
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(data.stats), 'stats should be array');
  });

  it('POST traceroute to localhost', async () => {
    const { res, data } = await apiPost('/api/network', {
      tool: 'traceroute',
      target: '127.0.0.1',
    });
    assert.equal(res.status, 200);
    assert.ok(data.hops || data.raw, 'should have hops or raw data');
  });

  it('POST whois for google.com', async () => {
    const { res, data } = await apiPost('/api/network', {
      tool: 'whois',
      target: 'google.com',
    });
    assert.equal(res.status, 200);
    assert.ok(typeof data.result === 'string', 'result should be string');
    assert.ok(data.result.length > 0, 'whois should return data');
  });

  it('POST without tool returns 400', async () => {
    const { res, data } = await apiPost('/api/network', {});
    assert.equal(res.status, 400);
    assert.ok(data.error);
  });

  it('unknown tool returns 400', async () => {
    const { res, data } = await apiPost('/api/network', { tool: 'nonexistent' });
    assert.equal(res.status, 400);
  });

  it('POST http-headers inspects a URL', async () => {
    const { res, data } = await apiPost('/api/network', {
      tool: 'http-headers',
      url: 'https://example.com',
    });
    assert.equal(res.status, 200);
    assert.ok(data.inspection, 'should have inspection data');
    assert.ok(typeof data.inspection.status === 'number', 'status should be number');
  });
});
