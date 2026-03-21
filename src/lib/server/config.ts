import { env } from '$env/dynamic/private';
import path from 'node:path';

export function getUploadDir(): string {
	return path.resolve(env.UPLOAD_DIR || './uploads');
}

export const MAX_FILE_SIZE = parseInt(env.MAX_FILE_SIZE || String(500 * 1024 * 1024)); // 500MB default
