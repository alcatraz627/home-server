import fs from 'node:fs/promises';
import { createReadStream, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { getUploadDir } from './config';
import { Readable } from 'node:stream';

const MIME_MAP: Record<string, string> = {
	// Images
	'.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
	'.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml',
	'.ico': 'image/x-icon', '.bmp': 'image/bmp',
	// Video
	'.mp4': 'video/mp4', '.webm': 'video/webm', '.mov': 'video/quicktime',
	'.avi': 'video/x-msvideo', '.mkv': 'video/x-matroska',
	// Audio
	'.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.ogg': 'audio/ogg',
	'.flac': 'audio/flac', '.m4a': 'audio/mp4', '.aac': 'audio/aac',
	// Documents
	'.pdf': 'application/pdf',
	'.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
	'.xls': 'application/vnd.ms-excel',
	'.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
	'.doc': 'application/msword',
	'.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
	'.ppt': 'application/vnd.ms-powerpoint',
	// Text
	'.txt': 'text/plain', '.md': 'text/markdown', '.csv': 'text/csv',
	'.json': 'application/json', '.xml': 'text/xml', '.html': 'text/html',
	'.css': 'text/css', '.js': 'text/javascript', '.ts': 'text/typescript',
	'.py': 'text/x-python', '.sh': 'text/x-shellscript',
	'.yml': 'text/yaml', '.yaml': 'text/yaml', '.toml': 'text/plain',
	'.log': 'text/plain', '.env': 'text/plain', '.ini': 'text/plain',
	'.cfg': 'text/plain', '.conf': 'text/plain',
	'.rs': 'text/plain', '.go': 'text/plain', '.java': 'text/plain',
	'.c': 'text/plain', '.cpp': 'text/plain', '.h': 'text/plain',
	'.jsx': 'text/javascript', '.tsx': 'text/typescript',
	'.svelte': 'text/plain', '.vue': 'text/plain',
};

export function getMime(filename: string): string {
	const ext = path.extname(filename).toLowerCase();
	return MIME_MAP[ext] || 'application/octet-stream';
}

function formatPermissions(mode: number): string {
	const perms = ['---', '--x', '-w-', '-wx', 'r--', 'r-x', 'rw-', 'rwx'];
	const owner = perms[(mode >> 6) & 7];
	const group = perms[(mode >> 3) & 7];
	const other = perms[mode & 7];
	return `${owner}${group}${other}`;
}

export interface FileInfo {
	name: string;
	size: number;
	modified: string;
	created: string;
	isDirectory: boolean;
	permissions: string;
	mime: string;
}

/** Ensure the upload directory exists */
export async function ensureUploadDir(): Promise<void> {
	const dir = getUploadDir();
	await fs.mkdir(dir, { recursive: true });
}

/** List files in the upload directory (or a subdirectory) */
export async function listFiles(subpath?: string): Promise<FileInfo[]> {
	const base = getUploadDir();
	const dir = subpath ? safePath(base, subpath) : base;

	await fs.mkdir(dir, { recursive: true });
	const entries = await fs.readdir(dir, { withFileTypes: true });

	const files = await Promise.all(
		entries.map(async (entry) => {
			const fullPath = path.join(dir, entry.name);
			const stat = await fs.stat(fullPath);
			return {
				name: entry.name,
				size: stat.size,
				modified: stat.mtime.toISOString(),
				created: stat.birthtime.toISOString(),
				isDirectory: entry.isDirectory(),
				permissions: formatPermissions(stat.mode),
				mime: entry.isDirectory() ? 'inode/directory' : getMime(entry.name)
			};
		})
	);

	return files.sort((a, b) => {
		// Directories first, then by name
		if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
		return a.name.localeCompare(b.name);
	});
}

/** Save an uploaded file to disk */
export async function saveFile(file: File, subpath?: string): Promise<FileInfo> {
	const base = getUploadDir();
	const dir = subpath ? safePath(base, subpath) : base;
	await fs.mkdir(dir, { recursive: true });

	const filePath = safePath(dir, file.name);
	const buffer = Buffer.from(await file.arrayBuffer());
	await fs.writeFile(filePath, buffer);

	const stat = await fs.stat(filePath);
	return {
		name: file.name,
		size: stat.size,
		modified: stat.mtime.toISOString(),
		created: stat.birthtime.toISOString(),
		isDirectory: false,
		permissions: formatPermissions(stat.mode),
		mime: getMime(file.name)
	};
}

/** Get a readable stream for downloading a file */
export function getFileStream(filename: string, subpath?: string): {
	stream: ReadableStream;
	size: number;
	name: string;
} | null {
	const base = getUploadDir();
	const dir = subpath ? safePath(base, subpath) : base;
	const filePath = safePath(dir, filename);

	if (!existsSync(filePath)) return null;

	const stat = statSync(filePath);
	if (stat.isDirectory()) return null;

	const nodeStream = createReadStream(filePath);
	const webStream = Readable.toWeb(nodeStream) as ReadableStream;

	return { stream: webStream, size: stat.size, name: filename };
}

/** Delete a file */
export async function deleteFile(filename: string, subpath?: string): Promise<boolean> {
	const base = getUploadDir();
	const dir = subpath ? safePath(base, subpath) : base;
	const filePath = safePath(dir, filename);

	try {
		await fs.unlink(filePath);
		return true;
	} catch {
		return false;
	}
}

/** Rename a file */
export async function renameFile(
	oldName: string,
	newName: string,
	subpath?: string
): Promise<boolean> {
	const base = getUploadDir();
	const dir = subpath ? safePath(base, subpath) : base;
	const oldPath = safePath(dir, oldName);
	const newPath = safePath(dir, newName);

	try {
		await fs.rename(oldPath, newPath);
		return true;
	} catch {
		return false;
	}
}

/**
 * Resolve a path safely, preventing directory traversal attacks.
 * Throws if the resolved path escapes the base directory.
 */
function safePath(base: string, filename: string): string {
	const resolved = path.resolve(base, filename);
	if (!resolved.startsWith(path.resolve(base))) {
		throw new Error('Path traversal detected');
	}
	return resolved;
}
