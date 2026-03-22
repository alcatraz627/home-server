import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { apiJson, BASE } from '../helpers/api';
import os from 'node:os';

describe('/api/browse', () => {
  it('returns 200 with directory listing', async () => {
    const { res, data } = await apiJson('/api/browse');
    assert.equal(res.status, 200);
    assert.ok(data.current, 'should have current directory path');
    assert.ok(Array.isArray(data.entries), 'entries should be an array');
  });

  it('defaults to home directory', async () => {
    const { data } = await apiJson('/api/browse');
    assert.equal(data.current, os.homedir(), 'should default to home directory');
  });

  it('entries have required fields', async () => {
    const { data } = await apiJson('/api/browse');
    assert.ok(data.entries.length > 0, 'home directory should have entries');
    const entry = data.entries[0];
    assert.ok(typeof entry.name === 'string', 'name should be a string');
    assert.ok(typeof entry.path === 'string', 'path should be a string');
    assert.ok(typeof entry.isDir === 'boolean', 'isDir should be a boolean');
    assert.ok(typeof entry.size === 'number', 'size should be a number');
  });

  it('can browse a specific directory', async () => {
    const { data } = await apiJson('/api/browse?path=/tmp');
    assert.equal(data.current, '/tmp', 'should show /tmp');
    assert.ok(Array.isArray(data.entries), 'entries should be an array');
  });

  it('supports ~ as home directory', async () => {
    const { data } = await apiJson('/api/browse?path=~');
    assert.equal(data.current, os.homedir(), 'should expand ~ to home');
  });

  it('includes parent directory entry (..) when not at root boundary', async () => {
    const home = (await import('os')).homedir();
    // Find any subdirectory inside home
    const { data: homeData } = await apiJson(`/api/browse?path=${encodeURIComponent(home)}`);
    const subdir = homeData.entries.find((e: any) => e.isDir && e.name !== '..');
    if (subdir) {
      const { data } = await apiJson(`/api/browse?path=${encodeURIComponent(subdir.path)}`);
      const parent = data.entries.find((e: any) => e.name === '..');
      assert.ok(parent, 'should include .. entry for subdirectory');
      assert.equal(parent.isDir, true, '.. should be a directory');
    }
  });

  it('directories come before files in sort order', async () => {
    const { data } = await apiJson('/api/browse');
    const entries = data.entries.filter((e: any) => e.name !== '..');
    let seenFile = false;
    for (const entry of entries) {
      if (!entry.isDir) seenFile = true;
      if (entry.isDir && seenFile) {
        assert.fail('directories should be sorted before files');
      }
    }
  });

  it('hides dotfiles except ..', async () => {
    const { data } = await apiJson('/api/browse');
    const dotfiles = data.entries.filter((e: any) => e.name.startsWith('.') && e.name !== '..');
    assert.equal(dotfiles.length, 0, 'should not show dotfiles');
  });

  it('handles non-existent directory gracefully', async () => {
    // /nonexistent is outside allowed roots, so returns 403
    const { res, data } = await apiJson('/api/browse?path=/nonexistent-path-xyz-12345');
    assert.ok(res.status === 403 || res.status === 200, 'should return 403 (outside allowed roots) or 200');
    assert.ok(data.error, 'should have an error message');
    assert.ok(Array.isArray(data.entries), 'entries should still be an array');
    assert.equal(data.entries.length, 0, 'entries should be empty');
  });
});
