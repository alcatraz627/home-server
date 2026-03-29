/**
 * iMessage reader — macOS only.
 *
 * Reads from ~/Library/Messages/chat.db using the system sqlite3 CLI
 * with -readonly to guarantee zero writes and zero data corruption.
 * All functions return empty arrays / null on Linux or on any error.
 */

import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  MACOS_EPOCH_OFFSET_SECONDS,
  MACOS_NANOSECOND_THRESHOLD,
  MACOS_SQLITE3_MAX_BUFFER,
  MACOS_CONVERSATIONS_LIMIT,
  MACOS_MESSAGES_LIMIT,
  MACOS_CONTACTS_LIMIT,
} from '$lib/constants/limits';
import { createLogger } from './logger';

const log = createLogger('messages');

export const IS_MACOS = os.platform() === 'darwin';
const HOME = os.homedir();
export const DB_PATH = path.join(HOME, 'Library/Messages/chat.db');
export const ATTACHMENTS_DIR = path.join(HOME, 'Library/Messages/Attachments');
const SQLITE3 = '/usr/bin/sqlite3';

// Mac absolute time epoch = 2001-01-01 00:00:00 UTC
const MAC_EPOCH_OFFSET_S = MACOS_EPOCH_OFFSET_SECONDS;

export function isMacOs(): boolean {
  return IS_MACOS;
}

export function isAvailable(): boolean {
  return IS_MACOS && existsSync(DB_PATH) && existsSync(SQLITE3);
}

/** Check if the DB is actually readable (Full Disk Access may block it). */
export function checkDbAccess(): { ok: boolean; reason?: string } {
  if (!IS_MACOS) return { ok: false, reason: 'linux' };
  if (!existsSync(SQLITE3)) return { ok: false, reason: 'sqlite3_missing' };
  if (!existsSync(DB_PATH)) return { ok: false, reason: 'db_missing' };
  try {
    execSync(`"${SQLITE3}" -readonly "${DB_PATH}" "SELECT 1"`, {
      timeout: 3000,
      stdio: 'pipe',
    });
    return { ok: true };
  } catch (e: any) {
    const msg: string = (e?.stderr?.toString() || e?.message || '').toLowerCase();
    if (msg.includes('authorization') || msg.includes('denied') || msg.includes('not authorized')) {
      return { ok: false, reason: 'fda_required' };
    }
    return { ok: false, reason: 'db_error' };
  }
}

/** Convert Mac absolute time (seconds or nanoseconds since 2001-01-01) to Unix ms */
export function macDateToMs(macDate: number): number {
  if (!macDate) return 0;
  // Newer macOS stores nanoseconds (value > 1e14)
  const secs = macDate > MACOS_NANOSECOND_THRESHOLD ? macDate / 1e9 : macDate;
  return Math.round((secs + MAC_EPOCH_OFFSET_S) * 1000);
}

/** Run a read-only SQLite query and return parsed rows. Never throws. */
function query<T = Record<string, unknown>>(sql: string): T[] {
  if (!isAvailable()) return [];
  try {
    const out = execSync(`"${SQLITE3}" -json -readonly "${DB_PATH}" ${JSON.stringify(sql)}`, {
      timeout: 5000,
      maxBuffer: MACOS_SQLITE3_MAX_BUFFER,
      stdio: 'pipe',
    })
      .toString()
      .trim();
    if (!out) return [];
    return JSON.parse(out) as T[];
  } catch (e: any) {
    log.warn('sqlite3 query failed', { error: e?.message?.slice(0, 200) });
    return [];
  }
}

// ─── Types ─────────────────────────────────────────────────────────────────

export interface Conversation {
  chatId: number;
  identifier: string;
  displayName: string | null;
  service: string;
  lastMessage: string | null;
  lastDateMs: number;
  lastIsFromMe: boolean;
  participantCount: number;
}

export interface Message {
  rowid: number;
  guid: string;
  text: string | null;
  dateMs: number;
  isFromMe: boolean;
  isDelivered: boolean;
  isRead: boolean;
  isSent: boolean;
  senderHandle: string | null;
  attachments: MessageAttachment[];
}

export interface MessageAttachment {
  rowid: number;
  guid: string;
  filename: string | null;
  mimeType: string | null;
  transferName: string | null;
  totalBytes: number;
}

export interface KnownContact {
  handle: string;
  displayName: string | null;
  lastDateMs: number;
}

// ─── Queries ────────────────────────────────────────────────────────────────

export function getConversations(limit = MACOS_CONVERSATIONS_LIMIT): Conversation[] {
  const rows = query<{
    chat_id: number;
    chat_identifier: string;
    display_name: string;
    service_name: string;
    last_message: string;
    last_date: number;
    last_is_from_me: number;
    participant_count: number;
  }>(`
    SELECT
      c.rowid AS chat_id,
      c.chat_identifier,
      c.display_name,
      c.service_name,
      (
        SELECT m.text FROM chat_message_join cmj
        JOIN message m ON m.rowid = cmj.message_id
        WHERE cmj.chat_id = c.rowid
        ORDER BY cmj.message_id DESC LIMIT 1
      ) AS last_message,
      (
        SELECT m.date FROM chat_message_join cmj
        JOIN message m ON m.rowid = cmj.message_id
        WHERE cmj.chat_id = c.rowid
        ORDER BY cmj.message_id DESC LIMIT 1
      ) AS last_date,
      (
        SELECT m.is_from_me FROM chat_message_join cmj
        JOIN message m ON m.rowid = cmj.message_id
        WHERE cmj.chat_id = c.rowid
        ORDER BY cmj.message_id DESC LIMIT 1
      ) AS last_is_from_me,
      (
        SELECT COUNT(*) FROM chat_handle_join WHERE chat_id = c.rowid
      ) AS participant_count
    FROM chat c
    ORDER BY last_date DESC
    LIMIT ${limit}
  `);

  return rows.map((r) => ({
    chatId: r.chat_id,
    identifier: r.chat_identifier,
    displayName: r.display_name || null,
    service: r.service_name || 'iMessage',
    lastMessage: r.last_message || null,
    lastDateMs: macDateToMs(r.last_date),
    lastIsFromMe: r.last_is_from_me === 1,
    participantCount: r.participant_count || 1,
  }));
}

export function getMessages(chatIdentifier: string, limit = MACOS_MESSAGES_LIMIT, beforeRowid?: number): Message[] {
  // Sanitize identifier — only allow phone/email safe chars
  const safeId = chatIdentifier.replace(/[^+\d\w@.\-_]/g, '');
  const beforeClause = beforeRowid ? `AND m.rowid < ${Number(beforeRowid)}` : '';

  const rows = query<{
    rowid: number;
    guid: string;
    text: string;
    date: number;
    is_from_me: number;
    is_delivered: number;
    is_read: number;
    is_sent: number;
    sender_handle: string;
  }>(`
    SELECT
      m.rowid,
      m.guid,
      m.text,
      m.date,
      m.is_from_me,
      m.is_delivered,
      m.is_read,
      m.is_sent,
      h.id AS sender_handle
    FROM message m
    JOIN chat_message_join cmj ON cmj.message_id = m.rowid
    JOIN chat c ON c.rowid = cmj.chat_id
    LEFT JOIN handle h ON h.rowid = m.handle_id
    WHERE c.chat_identifier = '${safeId}'
    ${beforeClause}
    ORDER BY m.date DESC
    LIMIT ${limit}
  `);

  // Fetch attachments for each message
  const messageIds = rows.map((r) => r.rowid);
  const attachmentMap = messageIds.length ? getAttachmentsForMessages(messageIds) : {};

  return rows.map((r) => ({
    rowid: r.rowid,
    guid: r.guid,
    text: r.text || null,
    dateMs: macDateToMs(r.date),
    isFromMe: r.is_from_me === 1,
    isDelivered: r.is_delivered === 1,
    isRead: r.is_read === 1,
    isSent: r.is_sent === 1,
    senderHandle: r.sender_handle || null,
    attachments: attachmentMap[r.rowid] || [],
  }));
}

function getAttachmentsForMessages(messageRowids: number[]): Record<number, MessageAttachment[]> {
  if (!messageRowids.length) return {};
  const ids = messageRowids.join(',');

  const rows = query<{
    message_id: number;
    rowid: number;
    guid: string;
    filename: string;
    mime_type: string;
    transfer_name: string;
    total_bytes: number;
  }>(`
    SELECT
      maj.message_id,
      a.rowid,
      a.guid,
      a.filename,
      a.mime_type,
      a.transfer_name,
      a.total_bytes
    FROM message_attachment_join maj
    JOIN attachment a ON a.rowid = maj.attachment_id
    WHERE maj.message_id IN (${ids})
  `);

  const map: Record<number, MessageAttachment[]> = {};
  for (const r of rows) {
    if (!map[r.message_id]) map[r.message_id] = [];
    map[r.message_id].push({
      rowid: r.rowid,
      guid: r.guid,
      filename: r.filename || null,
      mimeType: r.mime_type || null,
      transferName: r.transfer_name || null,
      totalBytes: r.total_bytes || 0,
    });
  }
  return map;
}

export function getAttachment(rowid: number): { path: string; mimeType: string | null } | null {
  const rows = query<{ filename: string; mime_type: string }>(`
    SELECT filename, mime_type FROM attachment WHERE rowid = ${Number(rowid)} LIMIT 1
  `);
  if (!rows.length || !rows[0].filename) return null;

  // Expand ~ in path
  const filePath = rows[0].filename.replace(/^~/, HOME);
  if (!existsSync(filePath)) return null;

  return { path: filePath, mimeType: rows[0].mime_type || null };
}

/** Return all unique contacts seen in chat history, ordered by most recent. */
export function getKnownContacts(limit = MACOS_CONTACTS_LIMIT): KnownContact[] {
  const rows = query<{
    handle_id: string;
    display_name: string;
    last_date: number;
  }>(`
    SELECT
      h.id AS handle_id,
      c.display_name,
      MAX(m.date) AS last_date
    FROM handle h
    JOIN chat_handle_join chj ON chj.handle_id = h.rowid
    JOIN chat c ON c.rowid = chj.chat_id
    LEFT JOIN chat_message_join cmj ON cmj.chat_id = c.rowid
    LEFT JOIN message m ON m.rowid = cmj.message_id
    GROUP BY h.id
    ORDER BY last_date DESC
    LIMIT ${limit}
  `);

  return rows.map((r) => ({
    handle: r.handle_id,
    displayName: r.display_name || null,
    lastDateMs: macDateToMs(r.last_date),
  }));
}

// ─── Sending ────────────────────────────────────────────────────────────────

/** Send a text message via AppleScript. Returns true on success. */
export async function sendMessage(handle: string, text: string): Promise<{ ok: boolean; error?: string }> {
  if (!IS_MACOS) return { ok: false, error: 'iMessage is only available on macOS' };

  // Sanitize handle
  const safeHandle = handle.replace(/[^+\d\w@.\-_]/g, '');
  if (!safeHandle) return { ok: false, error: 'Invalid handle' };

  // Escape text for AppleScript string literal (escape backslashes and double quotes)
  const safeText = text.replace(/\\/g, '\\\\').replace(/"/g, '\\"');

  const script = `tell application "Messages"
  send "${safeText}" to buddy "${safeHandle}" of service "iMessage"
end tell`;

  try {
    execSync(`osascript -e ${JSON.stringify(script)}`, { timeout: 10000, stdio: 'pipe' });
    return { ok: true };
  } catch (e: any) {
    const errMsg = e?.stderr?.toString() || e?.message || 'Failed to send';
    log.warn('Send message failed', { handle: safeHandle, error: errMsg.slice(0, 200) });
    return { ok: false, error: errMsg.slice(0, 200) };
  }
}

/** Send an attachment file via AppleScript. */
export async function sendAttachment(handle: string, filePath: string): Promise<{ ok: boolean; error?: string }> {
  if (!IS_MACOS) return { ok: false, error: 'iMessage is only available on macOS' };

  const safeHandle = handle.replace(/[^+\d\w@.\-_]/g, '');
  if (!safeHandle) return { ok: false, error: 'Invalid handle' };
  if (!existsSync(filePath)) return { ok: false, error: 'Attachment file not found' };

  const script = `tell application "Messages"
  send POSIX file "${filePath.replace(/"/g, '\\"')}" to buddy "${safeHandle}" of service "iMessage"
end tell`;

  try {
    execSync(`osascript -e ${JSON.stringify(script)}`, { timeout: 15000, stdio: 'pipe' });
    return { ok: true };
  } catch (e: any) {
    const errMsg = e?.stderr?.toString() || e?.message || 'Failed to send attachment';
    return { ok: false, error: errMsg.slice(0, 200) };
  }
}
