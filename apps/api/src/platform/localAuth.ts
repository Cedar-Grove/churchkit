import { createHash, randomBytes } from 'node:crypto';
import { verifyPassword, hashPassword } from '@churchkit/config/password';
import type { Env } from '../types';
import type { AdminAuth, AdminAuthResult } from './types';

/**
 * Username/password login, stored in this deployment's own database.
 *
 * The default admin auth mode (see adminAuth.ts's resolveAdminAuth): it
 * needs no external account, no DNS, and no identity provider, so a
 * deployment can log into its own admin panel the moment the database is
 * seeded. Cloudflare Access ("SSO") remains available by explicitly setting
 * ADMIN_AUTH_MODE=cloudflare-access and CF_ACCESS_AUD — a deliberate choice
 * a deployment opts into, not something it has to configure just to get in
 * the door.
 *
 * The session is a random token in an HttpOnly cookie; only its SHA-256 is
 * stored, so reading admin_sessions can't itself be used to log in. This is
 * intentionally simpler than Cloudflare Access's JWT verification (no
 * issuer, no JWKS, no signature) because there is no third party to verify
 * against — the database *is* the authority here.
 */

export const SESSION_COOKIE = 'churchkit_admin_session';
const SESSION_DAYS = 7;

function hashToken(token: string): string {
	return createHash('sha256').update(token).digest('hex');
}

function readCookie(request: Request, name: string): string | null {
	const header = request.headers.get('Cookie');
	if (!header) return null;
	for (const part of header.split(';')) {
		const eq = part.indexOf('=');
		if (eq === -1) continue;
		if (part.slice(0, eq).trim() === name) return decodeURIComponent(part.slice(eq + 1).trim());
	}
	return null;
}

/** `Set-Cookie` for a fresh session. `Secure` is safe unconditionally — every host this runs on (Workers, or a self-hosted deployment behind the TLS-terminating proxy the docs require) serves the admin panel over https. */
export function sessionCookie(token: string, maxAgeSeconds: number): string {
	return `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAgeSeconds}`;
}

/** Overwrites the cookie with one that expires immediately. */
export function clearSessionCookie(): string {
	return `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

export function localAuth(env: Env): AdminAuth {
	return {
		name: 'local',
		async verify(request: Request): Promise<AdminAuthResult> {
			const token = readCookie(request, SESSION_COOKIE);
			if (!token) return { ok: false, reason: 'no_session' };

			const row = await env.DB.prepare(
				`SELECT s.expires_at as expires_at, u.username as username
				 FROM admin_sessions s JOIN admin_users u ON u.id = s.user_id
				 WHERE s.token_hash = ?`
			).bind(hashToken(token)).first<{ expires_at: number; username: string }>();

			if (!row) return { ok: false, reason: 'invalid_session' };
			if (row.expires_at < Math.floor(Date.now() / 1000)) return { ok: false, reason: 'session_expired' };
			return { ok: true, email: row.username };
		},
	};
}

export type LoginResult =
	| { ok: true; token: string; username: string; mustChangePassword: boolean; maxAgeSeconds: number }
	| { ok: false; reason: string };

export async function attemptLogin(env: Env, username: string, password: string): Promise<LoginResult> {
	const user = await env.DB.prepare(
		'SELECT id, password_hash, must_change_password FROM admin_users WHERE username = ?'
	).bind(username).first<{ id: number; password_hash: string; must_change_password: number }>();

	// Same "invalid_credentials" whether the username doesn't exist or the
	// password is wrong — distinguishing them tells an attacker which
	// usernames are real.
	if (!user || !verifyPassword(password, user.password_hash)) {
		return { ok: false, reason: 'invalid_credentials' };
	}

	const token = randomBytes(32).toString('hex');
	const maxAgeSeconds = SESSION_DAYS * 86400;
	const expiresAt = Math.floor(Date.now() / 1000) + maxAgeSeconds;
	await env.DB.prepare(
		'INSERT INTO admin_sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)'
	).bind(hashToken(token), user.id, expiresAt).run();

	return { ok: true, token, username, mustChangePassword: user.must_change_password === 1, maxAgeSeconds };
}

export async function destroySession(env: Env, request: Request): Promise<void> {
	const token = readCookie(request, SESSION_COOKIE);
	if (!token) return;
	await env.DB.prepare('DELETE FROM admin_sessions WHERE token_hash = ?').bind(hashToken(token)).run();
}

export async function changePassword(
	env: Env,
	username: string,
	currentPassword: string,
	newPassword: string
): Promise<{ ok: boolean; reason?: string }> {
	const user = await env.DB.prepare(
		'SELECT id, password_hash FROM admin_users WHERE username = ?'
	).bind(username).first<{ id: number; password_hash: string }>();
	if (!user || !verifyPassword(currentPassword, user.password_hash)) {
		return { ok: false, reason: 'invalid_credentials' };
	}
	if (newPassword.length < 12) {
		return { ok: false, reason: 'new password must be at least 12 characters' };
	}
	await env.DB.prepare(
		'UPDATE admin_users SET password_hash = ?, must_change_password = 0 WHERE id = ?'
	).bind(hashPassword(newPassword), user.id).run();
	return { ok: true };
}
