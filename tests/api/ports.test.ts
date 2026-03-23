import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { apiPost } from '../helpers/api';

describe('/api/ports', () => {
  it('scans common ports on localhost', async () => {
    const { res, data } = await apiPost('/api/ports', {
      host: '127.0.0.1',
      preset: 'common',
    });
    assert.equal(res.status, 200);
    assert.ok(typeof data.host === 'string');
    assert.ok(typeof data.total === 'number');
    assert.ok(typeof data.open === 'number');
    assert.ok(Array.isArray(data.results));
    assert.ok(data.total > 0, 'should scan at least 1 port');
  });

  it('results have port, open, service fields', async () => {
    const { data } = await apiPost('/api/ports', {
      host: '127.0.0.1',
      preset: 'common',
    });
    for (const r of data.results.slice(0, 5)) {
      assert.ok(typeof r.port === 'number');
      assert.ok(typeof r.open === 'boolean');
      assert.ok(typeof r.service === 'string');
    }
  });

  it('port 5555 should be open (dev server)', async () => {
    const { data } = await apiPost('/api/ports', {
      host: '127.0.0.1',
      ports: '5555',
    });
    const devPort = data.results.find((r: any) => r.port === 5555);
    assert.ok(devPort, 'should find port 5555');
    assert.ok(devPort.open, 'port 5555 should be open (dev server)');
  });

  it('custom port range works', async () => {
    const { res, data } = await apiPost('/api/ports', {
      host: '127.0.0.1',
      ports: '80,443,8080',
    });
    assert.equal(res.status, 200);
    assert.equal(data.total, 3, 'should scan exactly 3 ports');
  });

  it('returns 400 when host is missing', async () => {
    const { res, data } = await apiPost('/api/ports', { preset: 'common' });
    assert.equal(res.status, 400);
    assert.ok(data.error);
  });
});
