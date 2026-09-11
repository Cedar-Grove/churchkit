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
import { CORS_HEADERS, err, notConfigured, adminCorsHeaders } from './lib/response';
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
import {
	handleConnectCard,
	handleImNew,
	handleContact,
	handlePrayerRequest,
} from './routes/forms';
import { handlePushRegister, handlePushUnregister } from './routes/push';
import {
	handlePcoExchange,
	handleMeProfile,
	handleMeGiving,
	handleMeSchedules,
	handleMeHousehold,
	handleUpdateHousehold,
	handleUpdateHouseholdMember,
	handleAddHouseholdChild,
	handleRemoveHouseholdMember,
	handleUpdateProfile,
	handleMeCheckIns,
	handleCheckInPrecheck,
	handleSubmitCheckIn,
} from './routes/auth';
import { verifyAccessJWT, handleAdmin } from './routes/admin';
import { handleBibleAudio, handleBibleText } from './routes/bible';
import { purgeExpiredRateLimits } from './lib/rateLimit';

async function route(path: string, method: string, request: Request, env: Env, origin: string): Promise<Response> {
	const caps = capabilities(env);

	// ── CAPABILITIES ────────────────────────────────────────────
	// Clients read this to know which features this church configured.
	if (path === '/api/capabilities' && method === 'GET') return handleCapabilities(env);

	// ── MEMBER ACCOUNT ROUTES ───────────────────────────────────
	// All of these proxy Planning Center on behalf of a signed-in member, so
	// a church without member login turns the whole surface off at once
	// rather than failing request by request.
	if (path === '/api/auth/pco/exchange' || path.startsWith('/api/me/')) {
		if (!caps.accounts) return notConfigured('accounts');
	}

	if (path === '/api/auth/pco/exchange' && method === 'POST') return handlePcoExchange(request, env);
	if (path === '/api/me/profile' && method === 'GET') return handleMeProfile(request);
	if (path === '/api/me/profile' && method === 'PATCH') return handleUpdateProfile(request);
	if (path === '/api/me/giving' && method === 'GET') return handleMeGiving(request);
	if (path === '/api/me/schedules' && method === 'GET') return handleMeSchedules(request);
	if (path === '/api/me/check-ins' && method === 'GET') return handleMeCheckIns(request);
	if (path === '/api/me/check-in' && method === 'POST') {
		if (!caps.checkIn) return notConfigured('checkIn');
		return handleSubmitCheckIn(request, env);
	}
	if (path === '/api/me/household' && method === 'GET') return handleMeHousehold(request);
	if (path === '/api/me/household' && method === 'PATCH') return handleUpdateHousehold(request);
	if (path === '/api/me/household/children' && method === 'POST') return handleAddHouseholdChild(request);
	const memberMatch = path.match(/^\/api\/me\/household\/members\/([^/]+)$/);
	if (memberMatch && method === 'PATCH') return handleUpdateHouseholdMember(request, memberMatch[1]);
	if (memberMatch && method === 'DELETE') return handleRemoveHouseholdMember(request, memberMatch[1]);

	if (path === '/api/check-ins/precheck' && method === 'GET') {
		if (!caps.checkIn) return notConfigured('checkIn');
		return handleCheckInPrecheck(env);
	}

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

	// ── SCRIPTURE ───────────────────────────────────────────────
	// Text works with either provider; audio needs Bible Brain specifically.
	if (path === '/api/bible/text' && method === 'GET') {
		if (!caps.bible) return notConfigured('bible');
		return handleBibleText(request, env);
	}
	if (path === '/api/bible/audio' && method === 'GET') {
		if (!caps.bibleAudio) return notConfigured('bibleAudio');
		return handleBibleAudio(request, env);
	}

	// ── PUSH REGISTRATION ───────────────────────────────────────
	if (path === '/api/push/register') {
		if (!caps.push) return notConfigured('push');
		if (method === 'POST') return handlePushRegister(request, env);
		if (method === 'DELETE') return handlePushUnregister(request, env);
	}

	// ── FORM ROUTES ─────────────────────────────────────────────
	// Deliberately ungated. A submission is stored in D1 whatever else is
	// configured, so a church with no Planning Center and no email provider
	// still collects prayer requests rather than losing them.
	if (path === '/api/forms/connect-card' && method === 'POST') return handleConnectCard(request, env);
	if (path === '/api/forms/im-new' && method === 'POST') return handleImNew(request, env);
	if (path === '/api/forms/contact' && method === 'POST') return handleContact(request, env);
	if (path === '/api/forms/prayer-request' && method === 'POST') return handlePrayerRequest(request, env);

	// ── ADMIN ROUTES ────────────────────────────────────────────
	if (path.startsWith('/api/admin/')) {
		// With no Access audience configured there is no way to verify an
		// admin, so the panel is unavailable rather than unprotected.
		if (!caps.admin) return notConfigured('admin');

		const cors = adminCorsHeaders(origin, env);
		const auth = await verifyAccessJWT(request, env);
		if (!auth.ok) {
			return new Response(JSON.stringify({ error: `Unauthorized: ${auth.reason}` }), {
				status: 401,
				headers: { ...cors, 'Content-Type': 'application/json' },
			});
		}
		const resp = await handleAdmin(path, method, request, env);
		const out = new Response(resp.body, { status: resp.status, headers: resp.headers });
		for (const [k, v] of Object.entries(cors)) out.headers.set(k, v);
		return out;
	}

	return err('Not found', 404);
}

export default {
	async fetch(request: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
		const url = new URL(request.url);
		const path = url.pathname;
		const method = request.method;
		const origin = request.headers.get('Origin') ?? '';

		if (method === 'OPTIONS') {
			const headers = path.startsWith('/api/admin/') ? adminCorsHeaders(origin, env) : CORS_HEADERS;
			return new Response(null, { headers });
		}

		try {
			// Most responses rely on Cloudflare's zone-level cache, driven by
			// each response's own Cache-Control header — a normal zone cache
			// purge picks up fresh content there. The upstream-backed data
			// (lib/cache.ts) is the exception: it is cached in D1 and kept
			// warm by the scheduled() handler below rather than by purges.
			return await route(path, method, request, env, origin);
		} catch (e: any) {
			console.error('Unhandled error:', e?.message, e?.stack);
			if (path.startsWith('/api/admin/')) {
				return new Response(JSON.stringify({ error: `Error: ${e?.message ?? 'Unknown error'}` }), {
					status: 500,
					headers: { ...adminCorsHeaders(origin, env), 'Content-Type': 'application/json' },
				});
			}
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
