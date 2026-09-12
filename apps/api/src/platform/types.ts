/**
 * The platform seam.
 *
 * ChurchKit was written for Cloudflare, and Cloudflare remains the path
 * everything is tuned for. But a church that already runs a server, or
 * whose denomination hosts for it, or that simply does not want another
 * account, should not be shut out — and the coupling turned out to be
 * narrow enough that it need not be: six database methods, one storage
 * call, and one way of authenticating admins.
 *
 * These interfaces are deliberately shaped to what Cloudflare's own types
 * already provide, so D1Database and R2Bucket satisfy them structurally
 * with no wrapper at all. The cost of portability is paid by the other
 * implementations, not by the default one.
 */

/**
 * What a write reports back. Shaped after D1's own result so D1 satisfies
 * it unchanged; every SQLite driver exposes the same two facts under some
 * other name, and its adapter maps them here.
 */
export interface RunResult {
	meta: {
		last_row_id?: number | null;
		changes?: number;
	};
}

export interface PreparedStatement {
	bind(...values: unknown[]): PreparedStatement;
	first<T = Record<string, unknown>>(): Promise<T | null>;
	all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
	run(): Promise<RunResult>;
}

export interface Database {
	prepare(query: string): PreparedStatement;
	/** Applied together where the driver supports it, in order otherwise. */
	batch(statements: PreparedStatement[]): Promise<RunResult[]>;
}

export interface StoredObjectOptions {
	httpMetadata?: { contentType?: string };
}

export interface Storage {
	put(
		key: string,
		value: ReadableStream | ArrayBuffer | string,
		options?: StoredObjectOptions
	): Promise<unknown>;
}

/**
 * How an admin request is authenticated.
 *
 * This is the one piece with no portable answer. Cloudflare Access verifies
 * a signed JWT at the edge; a self-hosted deployment has to say what plays
 * that role, and the honest options differ in their security properties.
 * See platform/adminAuth.ts, which documents each and refuses to guess.
 */
export interface AdminAuthResult {
	ok: boolean;
	reason?: string;
	email?: string;
}

export interface AdminAuth {
	/** Human-readable name, for logs and `churchkit doctor`. */
	readonly name: string;
	verify(request: Request): Promise<AdminAuthResult>;
}
