/**
 * ChurchKit API — Cloudflare Worker.
 *
 *   src/
 *   ├── index.ts              ← main router (this file)
 *   ├── types.ts              ← Env interface; everything but DB is optional
 *   ├── lib/
 *   │   ├── capabilities.ts   ← what this deployment can serve
 *   │   ├── response.ts       ← json(), err(), notConfigured(), CORS
 *   │   ├── pco.ts            ← Planning Center helpers
 *   │   ├── youtube.ts        ← YouTube Data API helper
 *   │   ├── email.ts          ← Resend helper
 *   │   ├── push.ts           ← OneSignal helper
 *   │   ├── cache.ts          ← D1-backed upstream cache + daily budgets
 *   │   ├── rateLimit.ts      ← per-IP and global form limits
 *   │   ├── formGuard.ts      ← honeypots, body and field caps
 *   │   ├── turnstile.ts      ← optional bot challenge
 *   │   └── data.ts           ← shared data fetchers
 *   └── routes/
 *       └── public.ts         ← public endpoints
 *
 * Port in progress: routes/{auth,forms,push,admin,bible}.ts are not yet
 * transcribed from the reference implementation. Their paths are absent
 * from the router rather than stubbed, so a request for one gets an
 * honest 404 instead of an endpoint that silently does nothing.
 */

import type { Env } from './types';
import { CORS_HEADERS, err } from './lib/response';
import { capabilities } from './lib/capabilities';
import {
	getSettings,
	getMergedSermons,
	getLiveStream,
	getFeaturedEvent,
	getRegistrationSignups,
	getFutureEventInstances,
} from './lib/data';
import {
	handleHome,
	handleSermons,
	handleGetNotes,
	handleEvents,
	handleStaff,
	handlePage,
	handleSettings,
	handleCarousel,
	handleMinistries,
	handleCapabilities,
} from './routes/public';
import { purgeExpiredRateLimits } from './lib/rateLimit';

async function route(path: string, method: string, request: Request, env: Env): Promise<Response> {
	// ── CAPABILITIES ────────────────────────────────────────────
	// Clients read this to know which features this church configured.
	if (path === '/api/capabilities' && method === 'GET') return handleCapabilities(env);

	// ── PUBLIC ROUTES ───────────────────────────────────────────
	if (path === '/api/home' && method === 'GET') return handleHome(env);
	if (path === '/api/sermons' && method === 'GET') {
		const limit = Number(new URL(request.url).searchParams.get('limit'));
		return handleSermons(env, limit > 0 ? limit : undefined);
	}
	if (path === '/api/events' && method === 'GET') return handleEvents(env);
	if (path === '/api/staff' && method === 'GET') return handleStaff(env);
	if (path === '/api/settings' && method === 'GET') return handleSettings(env);
	if (path === '/api/carousel' && method === 'GET') return handleCarousel(env);
	if (path === '/api/ministries' && method === 'GET') return handleMinistries(env);

	const notesMatch = path.match(/^\/api\/sermons\/([^/]+)\/notes$/);
	if (notesMatch && method === 'GET') return handleGetNotes(notesMatch[1], env);

	const pageMatch = path.match(/^\/api\/pages\/([^/]+)$/);
	if (pageMatch && method === 'GET') return handlePage(pageMatch[1], env);

	return err('Not found', 404);
}

export default {
	async fetch(request: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
		const url = new URL(request.url);
		const path = url.pathname;
		const method = request.method;

		if (method === 'OPTIONS') return new Response(null, { headers: CORS_HEADERS });

		try {
			// Most responses rely on Cloudflare's zone-level cache, driven by
			// each response's own Cache-Control header — a normal zone cache
			// purge picks up fresh content there. The upstream-backed data
			// (lib/cache.ts) is the exception: it is cached in D1 and kept
			// warm by the scheduled() handler below rather than by purges.
			return await route(path, method, request, env);
		} catch (e: any) {
			console.error('Unhandled error:', e?.message, e?.stack);
			return err(`Error: ${e?.message ?? 'Unknown error'}`, 500);
		}
	},

	/**
	 * Proactively refreshes the D1-backed caches so a real page load never
	 * has to be the one that pays for a slow upstream fetch. Each cache's
	 * own TTL (and, for YouTube, the shared daily call budget in
	 * lib/cache.ts) still decides whether a given run fetches anything.
	 *
	 * Every warm target is skipped cleanly on a deployment that has not
	 * configured it, so this costs nothing on a church using neither
	 * YouTube nor Planning Center.
	 */
	async scheduled(_controller: ScheduledController, env: Env, _ctx: ExecutionContext): Promise<void> {
		const caps = capabilities(env);
		const work: Promise<unknown>[] = [
			// Nothing reads a rate-limit window once it has rolled over, so
			// clear them out here rather than letting the table grow forever.
			purgeExpiredRateLimits(env),
		];

		if (caps.sermons) work.push(getMergedSermons(env), getLiveStream(env));
		if (caps.events) {
			const settings = await getSettings(env);
			work.push(
				getRegistrationSignups(env),
				getFutureEventInstances(env),
				getFeaturedEvent(settings.featured_event_id || null, env),
			);
		}

		await Promise.allSettled(work);
	},
} satisfies ExportedHandler<Env>;
