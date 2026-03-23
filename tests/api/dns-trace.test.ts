import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { apiPost } from '../helpers/api';

describe('/api/dns/trace', () => {
  it('traces DNS resolution for example.com', async () => {
    const { res, data } = await apiPost('/api/dns/trace', {
      domain: 'example.com',
      type: 'A',
    });
    assert.equal(res.status, 200);
    assert.equal(data.domain, 'example.com');
    assert.ok(Array.isArray(data.hops), 'hops should be an array');
    assert.ok(data.hopCount >= 0, 'hopCount should be non-negative');
  });

  it('returns raw dig output', async () => {
    const { data } = await apiPost('/api/dns/trace', {
      domain: 'example.com',
      type: 'A',
    });
    assert.ok(typeof data.raw === 'string', 'raw should be a string');
  });

  it('returns 400 when domain is missing', async () => {
    const { res, data } = await apiPost('/api/dns/trace', { type: 'A' });
    assert.equal(res.status, 400);
    assert.ok(data.error);
  });

  it('hops have server and response time', async () => {
    const { data } = await apiPost('/api/dns/trace', {
      domain: 'example.com',
      type: 'A',
    });
    for (const hop of data.hops) {
      assert.ok(typeof hop.responseTime === 'number', 'responseTime should be number');
      assert.ok(Array.isArray(hop.answers), 'answers should be array');
      assert.ok(Array.isArray(hop.authority), 'authority should be array');
    }
  });
});
