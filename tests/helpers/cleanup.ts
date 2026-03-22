/**
 * Test cleanup helpers.
 * Call these in afterEach/after blocks to remove test artifacts.
 */

import { api, apiDelete, apiJson } from './api';

/** Delete a test bookmark by ID */
export async function deleteBookmark(id: string) {
  await api('/api/bookmarks', {
    method: 'POST',
    body: JSON.stringify({ _action: 'delete', id }),
  });
}

/** Delete a test task by ID */
export async function deleteTask(id: string) {
  await api('/api/tasks', {
    method: 'DELETE',
    body: JSON.stringify({ id }),
  });
}

/** Delete a test backup config by ID */
export async function deleteBackup(id: string) {
  await api('/api/backups', {
    method: 'DELETE',
    body: JSON.stringify({ id }),
  });
}

/** Delete a test keeper request by ID */
export async function deleteKeeperRequest(id: string) {
  await api('/api/keeper', {
    method: 'DELETE',
    body: JSON.stringify({ id }),
  });
}

/** Delete a test WoL device by ID */
export async function deleteWolDevice(id: string) {
  await api('/api/wol', {
    method: 'POST',
    body: JSON.stringify({ _action: 'delete', id }),
  });
}

/** Delete a test kanban card by ID */
export async function deleteKanbanCard(id: string) {
  await api('/api/kanban', {
    method: 'POST',
    body: JSON.stringify({ _action: 'delete', id }),
  });
}

/** Clear all clipboard entries */
export async function clearClipboard() {
  await api('/api/clipboard', {
    method: 'POST',
    body: JSON.stringify({ _action: 'clear' }),
  });
}

/** Delete a test file */
export async function deleteFile(filename: string, path = '') {
  const params = path ? `?path=${encodeURIComponent(path)}` : '';
  await api(`/api/files/${encodeURIComponent(filename)}${params}`, { method: 'DELETE' });
}

/** Log cleanup action (useful for debugging) */
export function logCleanup(resource: string, id: string) {
  if (process.env.TEST_VERBOSE) {
    console.log(`  [cleanup] Deleting ${resource}: ${id}`);
  }
}
