import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import { apiJson, api, testId, BASE } from '../helpers/api';
import { deleteFile } from '../helpers/cleanup';

const TEST_FILENAME = `test-upload-${Date.now()}.txt`;
const TEST_CONTENT = 'Hello from test suite ' + Date.now();
const TEST_DIR_NAME = `testdir-${Date.now()}`;

describe('/api/files', () => {
  // Track created resources for cleanup
  const createdFiles: string[] = [];
  const createdDirs: string[] = [];

  after(async () => {
    // Clean up test files
    for (const f of createdFiles) {
      await deleteFile(f);
    }
    for (const d of createdDirs) {
      await api(`/api/files/${encodeURIComponent(d)}?dir=true`, { method: 'DELETE' });
    }
  });

  it('GET /api/files returns 200 with array', async () => {
    const { res, data } = await apiJson('/api/files');
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(data), 'should return an array');
  });

  it('file entries have expected shape', async () => {
    const { data } = await apiJson('/api/files');
    if (data.length === 0) return; // empty is valid
    const file = data.find((f: any) => !f.isDirectory);
    if (!file) return;
    assert.ok(typeof file.name === 'string', 'name should be a string');
    assert.ok(typeof file.size === 'number', 'size should be a number');
    assert.ok(typeof file.isDirectory === 'boolean', 'isDirectory should be a boolean');
  });

  it('POST /api/files uploads a file', async () => {
    const formData = new FormData();
    const blob = new Blob([TEST_CONTENT], { type: 'text/plain' });
    formData.append('file', blob, TEST_FILENAME);

    const res = await fetch(`${BASE}/api/files`, {
      method: 'POST',
      body: formData,
    });
    assert.equal(res.status, 201, 'upload should return 201');
    const data = await res.json();
    assert.ok(data.name, 'response should have name');
    createdFiles.push(data.name);
  });

  it('uploaded file appears in listing', async () => {
    const { data } = await apiJson('/api/files');
    const found = data.find((f: any) => f.name === TEST_FILENAME);
    assert.ok(found, `uploaded file ${TEST_FILENAME} should appear in listing`);
    assert.ok(found.size > 0, 'file size should be positive');
  });

  it('GET /api/files/:filename downloads the file', async () => {
    const res = await fetch(`${BASE}/api/files/${encodeURIComponent(TEST_FILENAME)}`);
    assert.equal(res.status, 200);
    const text = await res.text();
    assert.equal(text, TEST_CONTENT, 'downloaded content should match uploaded content');
  });

  it('GET /api/files/:filename with preview=true serves inline', async () => {
    const res = await fetch(`${BASE}/api/files/${encodeURIComponent(TEST_FILENAME)}?preview=true`);
    assert.equal(res.status, 200);
    const disposition = res.headers.get('content-disposition');
    assert.ok(disposition?.includes('inline'), 'should have inline disposition for preview');
  });

  it('PATCH /api/files/:filename renames a file', async () => {
    const newName = `renamed-${TEST_FILENAME}`;
    const { res, data } = await apiJson(`/api/files/${encodeURIComponent(TEST_FILENAME)}`, {
      method: 'PATCH',
      body: JSON.stringify({ name: newName }),
    });
    assert.equal(res.status, 200);
    assert.ok(data.ok, 'should return ok: true');

    // Update our tracking
    const idx = createdFiles.indexOf(TEST_FILENAME);
    if (idx !== -1) createdFiles[idx] = newName;

    // Rename back for subsequent tests
    await apiJson(`/api/files/${encodeURIComponent(newName)}`, {
      method: 'PATCH',
      body: JSON.stringify({ name: TEST_FILENAME }),
    });
    const idx2 = createdFiles.indexOf(newName);
    if (idx2 !== -1) createdFiles[idx2] = TEST_FILENAME;
  });

  it('DELETE /api/files/:filename deletes the file', async () => {
    // Upload a fresh file to delete
    const delName = `delete-me-${Date.now()}.txt`;
    const formData = new FormData();
    formData.append('file', new Blob(['delete me'], { type: 'text/plain' }), delName);
    await fetch(`${BASE}/api/files`, { method: 'POST', body: formData });

    const res = await api(`/api/files/${encodeURIComponent(delName)}`, { method: 'DELETE' });
    assert.equal(res.status, 204, 'delete should return 204');

    // Verify it is gone
    const { data } = await apiJson('/api/files');
    const found = data.find((f: any) => f.name === delName);
    assert.ok(!found, 'deleted file should not appear in listing');
  });

  it('GET /api/files/:nonexistent returns 404', async () => {
    const { res } = await apiJson(`/api/files/nonexistent-file-${Date.now()}.xyz`);
    assert.equal(res.status, 404);
  });

  it('PUT /api/files creates a directory', async () => {
    const { res, data } = await apiJson('/api/files', {
      method: 'PUT',
      body: JSON.stringify({ name: TEST_DIR_NAME }),
    });
    assert.equal(res.status, 201);
    assert.ok(data.ok, 'should return ok: true');
    createdDirs.push(TEST_DIR_NAME);
  });

  it('POST /api/files without file returns 400', async () => {
    const formData = new FormData();
    const res = await fetch(`${BASE}/api/files`, { method: 'POST', body: formData });
    assert.equal(res.status, 400);
  });
});
