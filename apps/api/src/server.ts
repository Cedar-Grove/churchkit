/**
 * Node entry point — the self-hosted path.
 *
 * Serves the same routes as the Worker, backed by SQLite and the local
 * filesystem instead of D1 and R2. Configuration comes from the process
 * environment rather than Worker bindings; everything else is shared with
 * worker.ts, so the two hosts cannot drift.
 *
 *   CHURCHKIT_DB=./data/churchkit.db \
 *   CHURCHKIT_MEDIA_DIR=./data/media \
 *   ADMIN_AUTH_MODE=proxy-header \
 *   node dist/server.js
 *
 * A self-hosted deployment is responsible for what Cloudflare otherwise
 * provides: TLS, a cache in front of the API, and — most importantly —
 * authenticating admins. See platform/adminAuth.ts.
 */
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import type { Env } from './types';
import { handleRequest, runScheduled } from './app';
import { openSqlite } from './platform/sqlite';
import { FilesystemStorage } from './platform/fsStorage';
import { resolveAdminAuth } from './platform/adminAuth';

const PORT = Number(process.env.PORT ?? 8787);
/**
 * Loopback by default, deliberately.
 *
 * The self-hosting story assumes something in front of this — a reverse
 * proxy terminating TLS and authenticating admins. Binding to every
 * interface by default would put an unauthenticated admin API on the open
 * internet for anyone who skipped that step. Setting HOST=0.0.0.0 is
 * available, and is a decision rather than an accident.
 */
const HOST = process.env.HOST ?? '127.0.0.1';
const SCHEDULED_INTERVAL_MS = Number(process.env.CHURCHKIT_CRON_MS ?? 2 * 60 * 1000);

async function buildEnv(): Promise<Env> {
	const dbPath = process.env.CHURCHKIT_DB;
	if (!dbPath) {
		throw new Error('CHURCHKIT_DB is not set — it is the path to this deployment\'s SQLite file.');
	}

	const env = { ...process.env } as unknown as Env & Record<string, string | undefined>;
	env.DB = await openSqlite(dbPath);

	const mediaDir = process.env.CHURCHKIT_MEDIA_DIR;
	if (mediaDir) env.MEDIA = new FilesystemStorage(mediaDir);

	env.ADMIN_AUTH = resolveAdminAuth(process.env.ADMIN_AUTH_MODE, env);
	return env;
}

/** node:http request → a standard Request the shared router understands. */
async function toRequest(req: IncomingMessage, origin: string): Promise<Request> {
	const url = new URL(req.url ?? '/', origin);
	const headers = new Headers();
	for (const [key, value] of Object.entries(req.headers)) {
		if (value === undefined) continue;
		for (const entry of Array.isArray(value) ? value : [value]) headers.append(key, entry);
	}

	const method = req.method ?? 'GET';
	const hasBody = method !== 'GET' && method !== 'HEAD';

	return new Request(url, {
		method,
		headers,
		body: hasBody ? (req as unknown as ReadableStream) : undefined,
		// Node streams need this to be sent as a stream rather than buffered.
		...(hasBody ? { duplex: 'half' } : {}),
	} as RequestInit);
}

async function send(response: Response, res: ServerResponse): Promise<void> {
	res.writeHead(response.status, Object.fromEntries(response.headers));
	if (!response.body) {
		res.end();
		return;
	}
	const { Readable } = await import('node:stream');
	const { pipeline } = await import('node:stream/promises');
	await pipeline(Readable.fromWeb(response.body as any), res);
}

async function main(): Promise<void> {
	const env = await buildEnv();

	if (env.ADMIN_AUTH?.name === 'none') {
		console.warn(
			'⚠ No admin authentication configured (ADMIN_AUTH_MODE). The admin API will ' +
			'refuse every request until one is set. See docs/self-hosting.md.'
		);
	}

	const server = createServer((req, res) => {
		const origin = `http://${req.headers.host ?? `${HOST}:${PORT}`}`;
		toRequest(req, origin)
			.then((request) => handleRequest(request, env))
			.then((response) => send(response, res))
			.catch((e) => {
				console.error('Request failed:', e);
				res.writeHead(500, { 'Content-Type': 'application/json' });
				res.end(JSON.stringify({ error: 'Internal error' }));
			});
	});

	// What the Workers cron trigger does there. unref() so the interval
	// never holds the process open on its own during a shutdown.
	const timer = setInterval(() => {
		runScheduled(env).catch((e) => console.error('Scheduled work failed:', e));
	}, SCHEDULED_INTERVAL_MS);
	timer.unref();

	server.listen(PORT, HOST, () => {
		console.log(`ChurchKit API listening on http://${HOST}:${PORT}`);
		console.log(`  database   ${process.env.CHURCHKIT_DB}`);
		console.log(`  media      ${process.env.CHURCHKIT_MEDIA_DIR ?? 'not configured (uploads disabled)'}`);
		console.log(`  admin auth ${env.ADMIN_AUTH?.name ?? 'none'}`);
	});

	for (const signal of ['SIGINT', 'SIGTERM'] as const) {
		process.on(signal, () => {
			console.log(`\n${signal} — shutting down`);
			server.close(() => process.exit(0));
		});
	}
}

main().catch((e) => {
	console.error(`\n✗ ${e.message}\n`);
	process.exit(1);
});
