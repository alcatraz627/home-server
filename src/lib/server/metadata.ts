import fs from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { getUploadDir } from './config';

/**
 * File metadata sidecar store.
 *
 * Stores per-file metadata in a `.meta.json` file alongside the uploads directory.
 * Each key is a filename, each value is a metadata object.
 *
 * This approach avoids polluting the uploads directory with hidden files per entry
 * and keeps all metadata in one easily-backed-up file.
 */

export interface FileMetadata {
  /** Tailscale hostname or IP of the device that uploaded this file */
  uploadedFrom?: string;
  /** ISO timestamp of when the file was uploaded */
  uploadedAt?: string;
  /** User-defined tags */
  tags?: string[];
  /** Any additional custom metadata */
  [key: string]: unknown;
}

type MetadataStore = Record<string, FileMetadata>;

function metaFilePath(): string {
  return path.join(getUploadDir(), '.meta.json');
}

function loadStore(): MetadataStore {
  const fp = metaFilePath();
  if (!existsSync(fp)) return {};
  try {
    return JSON.parse(readFileSync(fp, 'utf-8'));
  } catch {
    return {};
  }
}

async function saveStore(store: MetadataStore): Promise<void> {
  await fs.writeFile(metaFilePath(), JSON.stringify(store, null, 2), 'utf-8');
}

/** Get metadata for a specific file */
export function getFileMetadata(filename: string): FileMetadata | null {
  const store = loadStore();
  return store[filename] || null;
}

/** Get metadata for all files */
export function getAllMetadata(): MetadataStore {
  return loadStore();
}

/** Set or merge metadata for a file */
export async function setFileMetadata(filename: string, meta: Partial<FileMetadata>): Promise<void> {
  const store = loadStore();
  store[filename] = { ...store[filename], ...meta };
  await saveStore(store);
}

/** Remove metadata for a file (call on delete) */
export async function removeFileMetadata(filename: string): Promise<void> {
  const store = loadStore();
  delete store[filename];
  await saveStore(store);
}

/** Rename metadata entry (call on rename) */
export async function renameFileMetadata(oldName: string, newName: string): Promise<void> {
  const store = loadStore();
  if (store[oldName]) {
    store[newName] = store[oldName];
    delete store[oldName];
    await saveStore(store);
  }
}
