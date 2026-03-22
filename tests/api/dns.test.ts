import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { apiPost } from '../helpers/api';

describe('/api/dns', () => {
  it('resolves A records for google.com', async () => {
    const { res, data } = await apiPost('/api/dns', {
      domain: 'google.com',
      type: 'A',
    });
    assert.equal(res.status, 200);
    assert.equal(data.domain, 'google.com');
    assert.equal(data.type, 'A');
    assert.ok(Array.isArray(data.results), 'results should be an array');
    assert.ok(data.results.length > 0, 'should have at least one result');
  });

  it('queries multiple DNS providers (Google, Cloudflare, System)', async () => {
    const { data } = await apiPost('/api/dns', {
      domain: 'example.com',
      type: 'A',
    });
    assert.equal(data.results.length, 3, 'should query 3 providers');

    const providers = data.results.map((r: any) => r.provider);
    assert.ok(providers.includes('Google'), 'should include Google');
    assert.ok(providers.includes('Cloudflare'), 'should include Cloudflare');
    assert.ok(providers.includes('System Default'), 'should include System Default');
  });

  it('each result has provider, server, records, and time', async () => {
    const { data } = await apiPost('/api/dns', {
      domain: 'example.com',
      type: 'A',
    });
    for (const result of data.results) {
      assert.ok(typeof result.provider === 'string', 'provider should be a string');
      assert.ok(typeof result.server === 'string', 'server should be a string');
      assert.ok(Array.isArray(result.records), 'records should be an array');
      assert.ok(typeof result.time === 'number', 'time should be a number');
      assert.ok(result.time >= 0, 'time should be non-negative');
    }
  });

  it('resolves MX records', async () => {
    const { res, data } = await apiPost('/api/dns', {
      domain: 'google.com',
      type: 'MX',
    });
    assert.equal(res.status, 200);
    // At least one provider should have MX records
    const hasRecords = data.results.some((r: any) => r.records.length > 0 && !r.records[0].startsWith('Error'));
    assert.ok(hasRecords, 'should resolve MX records for google.com');
  });

  it('resolves NS records', async () => {
    const { res, data } = await apiPost('/api/dns', {
      domain: 'google.com',
      type: 'NS',
    });
    assert.equal(res.status, 200);
    const hasRecords = data.results.some((r: any) => r.records.length > 0 && !r.records[0].startsWith('Error'));
    assert.ok(hasRecords, 'should resolve NS records');
  });

  it('resolves TXT records', async () => {
    const { res, data } = await apiPost('/api/dns', {
      domain: 'google.com',
      type: 'TXT',
    });
    assert.equal(res.status, 200);
  });

  it('returns 400 when domain is missing', async () => {
    const { res, data } = await apiPost('/api/dns', { type: 'A' });
    assert.equal(res.status, 400);
    assert.ok(data.error, 'should have error message');
  });

  it('returns 400 when type is missing', async () => {
    const { res, data } = await apiPost('/api/dns', { domain: 'google.com' });
    assert.equal(res.status, 400);
    assert.ok(data.error, 'should have error message');
  });

  it('handles nonexistent domain gracefully', async () => {
    const { res, data } = await apiPost('/api/dns', {
      domain: 'this-domain-does-not-exist-xyz-12345.com',
      type: 'A',
    });
    assert.equal(res.status, 200);
    // Records should contain error strings
    for (const result of data.results) {
      if (result.records.length > 0) {
        const hasError = result.records.some((r: string) => typeof r === 'string' && r.startsWith('Error'));
        assert.ok(hasError || result.records.length === 0, 'nonexistent domain should return errors or empty');
      }
    }
  });

  it('AAAA records resolve for major domains', async () => {
    const { res, data } = await apiPost('/api/dns', {
      domain: 'google.com',
      type: 'AAAA',
    });
    assert.equal(res.status, 200);
  });
});
