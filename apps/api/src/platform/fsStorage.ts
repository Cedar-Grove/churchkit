import type { Storage, StoredObjectOptions } from './types';

/**
 * Filesystem storage for self-hosted deployments.
 *
 * Uploaded images are written under a directory the deployment serves
 * statically, so MEDIA_PUBLIC_URL points at whatever serves it — the same
 * web server, a reverse proxy, a CDN in front of both. ChurchKit only
 * writes the file; serving it is the host's job, as it is on Cloudflare.
 */
export class FilesystemStorage implements Storage {
	constructor(private readonly root: string) {}

	async put(
		key: string,
		value: ReadableStream | ArrayBuffer | string,
		_options?: StoredObjectOptions
	): Promise<unknown> {
		const { mkdir, writeFile } = await import('node:fs/promises');
		const { dirname, resolve, relative, sep } = await import('node:path');

		// A key reaching here is composed by the upload handler, not supplied
		// by the client — but a path traversal through storage is severe
		// enough to be worth refusing structurally rather than trusting the
		// caller to keep being careful.
		const target = resolve(this.root, key);
		const inside = relative(this.root, target);
		if (inside.startsWith('..') || inside.startsWith(sep) || inside === '') {
			throw new Error(`Refusing to write outside the media directory: ${key}`);
		}

		await mkdir(dirname(target), { recursive: true });

		if (typeof value === 'string') {
			await writeFile(target, value);
		} else if (value instanceof ArrayBuffer) {
			await writeFile(target, Buffer.from(value));
		} else {
			const { Readable } = await import('node:stream');
			const { pipeline } = await import('node:stream/promises');
			const { createWriteStream } = await import('node:fs');
			await pipeline(Readable.fromWeb(value as any), createWriteStream(target));
		}

		return { key };
	}
}
