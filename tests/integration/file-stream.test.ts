import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { apiJson, BASE } from '../helpers/api';
import { deleteFile } from '../helpers/cleanup';

const STREAM_TEST_FILE = `stream-test-${Date.now()}.txt`;
const STREAM_CONTENT = 'A'.repeat(1024) + 'B'.repeat(1024) + 'C'.repeat(1024); // 3KB

describe('/api/files/stream (integration)', () => {
  before(async () => {
    // Upload a test file for streaming
    const formData = new FormData();
    const blob = new Blob([STREAM_CONTENT], { type: 'text/plain' });
    formData.append('file', blob, STREAM_TEST_FILE);
    const res = await fetch(`${BASE}/api/files`, {
      method: 'POST',
      body: formData,
    });
    assert.equal(res.status, 201, 'setup: file upload should succeed');
  });

  after(async () => {
    await deleteFile(STREAM_TEST_FILE);
  });

  it('GET /api/files/stream/:path returns full file', async () => {
    const res = await fetch(`${BASE}/api/files/stream/${STREAM_TEST_FILE}`);
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('accept-ranges'), 'bytes', 'should advertise range support');
    assert.equal(res.headers.get('content-length'), String(STREAM_CONTENT.length));
    const body = await res.text();
    assert.equal(body, STREAM_CONTENT, 'full content should match');
  });

  it('supports Range header (206 Partial Content)', async () => {
    const res = await fetch(`${BASE}/api/files/stream/${STREAM_TEST_FILE}`, {
      headers: { Range: 'bytes=0-1023' },
    });
    assert.equal(res.status, 206, 'should return 206 for range request');
    assert.ok(res.headers.get('content-range'), 'should have Content-Range header');
    assert.equal(res.headers.get('content-length'), '1024', 'should return 1024 bytes');
    const body = await res.text();
    assert.equal(body, 'A'.repeat(1024), 'should return first 1024 bytes (all As)');
  });

  it('supports mid-file range', async () => {
    const res = await fetch(`${BASE}/api/files/stream/${STREAM_TEST_FILE}`, {
      headers: { Range: 'bytes=1024-2047' },
    });
    assert.equal(res.status, 206);
    const body = await res.text();
    assert.equal(body, 'B'.repeat(1024), 'should return middle chunk (all Bs)');
    const contentRange = res.headers.get('content-range');
    assert.ok(contentRange?.startsWith('bytes 1024-2047/'), 'Content-Range should be correct');
  });

  it('supports end-of-file range', async () => {
    const res = await fetch(`${BASE}/api/files/stream/${STREAM_TEST_FILE}`, {
      headers: { Range: 'bytes=2048-' },
    });
    assert.equal(res.status, 206);
    const body = await res.text();
    assert.equal(body, 'C'.repeat(1024), 'should return last chunk (all Cs)');
  });

  it('returns 416 for out-of-range request', async () => {
    const res = await fetch(`${BASE}/api/files/stream/${STREAM_TEST_FILE}`, {
      headers: { Range: `bytes=${STREAM_CONTENT.length + 100}-` },
    });
    assert.equal(res.status, 416, 'should return 416 Range Not Satisfiable');
  });

  it('returns 404 for nonexistent file', async () => {
    const res = await fetch(`${BASE}/api/files/stream/nonexistent-file-${Date.now()}.xyz`);
    assert.equal(res.status, 404);
  });

  it('blocks path traversal attempts', async () => {
    const res = await fetch(`${BASE}/api/files/stream/../../etc/passwd`);
    assert.ok(res.status === 403 || res.status === 404, 'should block path traversal');
  });
});
