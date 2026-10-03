import type { Env } from '../types';
import { json, err } from '../lib/response';
import { checkLoginRateLimit } from '../lib/rateLimit';
import { attemptLogin, destroySession, sessionCookie, clearSessionCookie } from '../platform/localAuth';

/**
 * Login/logout for the `local` admin-auth mode (platform/localAuth.ts).
 *
 * Deliberately separate from routes/admin.ts's handleAdmin: these two
 * routes are the ones app.ts must let through *before* the admin-auth gate
 * runs, since authenticating the request is their entire job. Everything
 * else under /api/admin/* stays behind that gate unchanged.
 */

export async function handleAdminLogin(request: Request, env: Env): Promise<Response> {
	if (env.ADMIN_AUTH?.name !== 'local') {
		return err('This deployment does not use local login. See ADMIN_AUTH_MODE.', 404);
	}

	const limit = await checkLoginRateLimit(request, env);
	if (!limit.allowed) {
		return new Response(JSON.stringify({ error: 'Too many attempts. Try again shortly.' }), {
			status: 429,
			headers: { 'Content-Type': 'application/json', 'Retry-After': String(limit.retryAfter) },
		});
	}

	let body: { username?: string; password?: string };
	try {
		body = await request.json();
	} catch {
		return err('Invalid request body', 400);
	}
	const { username, password } = body;
	if (!username || !password) return err('username and password are required', 400);

	const result = await attemptLogin(env, username, password);
	if (!result.ok) {
		// Same message regardless of which half was wrong — see attemptLogin.
		return err('Invalid username or password', 401);
	}

	const resp = json({
		success: true,
		username: result.username,
		mustChangePassword: result.mustChangePassword,
	});
	resp.headers.append('Set-Cookie', sessionCookie(result.token, result.maxAgeSeconds));
	return resp;
}

export async function handleAdminLogout(request: Request, env: Env): Promise<Response> {
	if (env.ADMIN_AUTH?.name === 'local') await destroySession(env, request);
	const resp = json({ success: true });
	resp.headers.append('Set-Cookie', clearSessionCookie());
	return resp;
}
