import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { apiJson, apiPost } from '../helpers/api';

describe('/api/terminal/pin', () => {
  it('GET returns pin enabled status', async () => {
    const { res, data } = await apiJson('/api/terminal/pin');
    assert.equal(res.status, 200);
    assert.ok(typeof data.enabled === 'boolean', 'enabled should be boolean');
  });

  it('verify with no pin when disabled returns valid', async () => {
    const { res, data } = await apiPost('/api/terminal/pin', {
      action: 'verify',
      pin: null,
    });
    assert.equal(res.status, 200);
    // If pin is not enabled, should be valid
    if (!data.required) {
      assert.ok(data.valid, 'should be valid when pin not required');
    }
  });

  it('invalid action returns 400', async () => {
    const { res, data } = await apiPost('/api/terminal/pin', {
      action: 'invalidAction',
    });
    assert.equal(res.status, 400);
    assert.ok(data.error);
  });

  it('set with short pin returns 400', async () => {
    const { res, data } = await apiPost('/api/terminal/pin', {
      action: 'set',
      pin: '12', // too short
    });
    assert.equal(res.status, 400);
    assert.ok(data.error);
  });
});
