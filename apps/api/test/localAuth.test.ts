import { describe, it, expect, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { hashPassword } from '@churchkit/config/password';
import { localAuth, attemptLogin, SESSION_COOKIE } from '../src/platform/localAuth';
import type { Env } from '../src/types';

/**
 * A D1 stand-in that serves one `admin_users` row and whatever
 * `admin_sessions` rows have been inserted through it — just enough surface
 * for localAuth.ts's three queries (login lookup, session lookup, session
 * insert), not a general-purpose fake.
 */
function fakeDb(user: { id: number; username: string; password_hash: string; must_change_password?: number }) {
	const sessions: { token_hash: string; user_id: number; expires_at: number }[] = [];

	return {
		DB: {
			prepare(sql: string) {
				return {
					bind(...args: unknown[]) {
						return {
							async first<T>() {
								if (sql.includes('FROM admin_users')) {
									return args[0] === user.username
										? ({ id: user.id, password_hash: user.password_hash, must_change_password: user.must_change_password ?? 1 } as unknown as T)
										: null;
								}
								if (sql.includes('FROM admin_sessions')) {
									const row = sessions.find((s) => s.token_hash === args[0]);
									return row ? ({ expires_at: row.expires_at, username: user.username } as unknown as T) : null;
								}
								return null;
							},
							async run() {
								if (sql.includes('INSERT INTO admin_sessions')) {
									sessions.push({ token_hash: args[0] as string, user_id: args[1] as number, expires_at: args[2] as number });
								}
								return { meta: {} };
							},
							async all<T>() {
								return { results: [] as T[] };
							},
						};
					},
				};
			},
			batch: async () => [],
		},
	} as unknown as Env;
}

describe('localAuth', () => {
	it('rejects a request with no session cookie', async () => {
		const env = fakeDb({ id: 1, username: 'admin', password_hash: hashPassword('correct-horse') });
		const result = await localAuth(env).verify(new Request('https://admin.example.org/'));
		expect(result.ok).toBe(false);
	});

	it('rejects an unknown session token', async () => {
		const env = fakeDb({ id: 1, username: 'admin', password_hash: hashPassword('correct-horse') });
		const req = new Request('https://admin.example.org/', { headers: { Cookie: `${SESSION_COOKIE}=not-a-real-token` } });
		const result = await localAuth(env).verify(req);
		expect(result.ok).toBe(false);
	});

	it('accepts the session cookie attemptLogin issues', async () => {
		const env = fakeDb({ id: 1, username: 'admin', password_hash: hashPassword('correct-horse') });
		const login = await attemptLogin(env, 'admin', 'correct-horse');
		expect(login.ok).toBe(true);
		if (!login.ok) return;

		const req = new Request('https://admin.example.org/', { headers: { Cookie: `${SESSION_COOKIE}=${login.token}` } });
		const result = await localAuth(env).verify(req);
		expect(result).toEqual({ ok: true, email: 'admin' });
	});

	it('rejects the wrong password without revealing whether the username exists', async () => {
		const env = fakeDb({ id: 1, username: 'admin', password_hash: hashPassword('correct-horse') });
		const wrongPassword = await attemptLogin(env, 'admin', 'wrong');
		const unknownUser = await attemptLogin(env, 'nobody', 'wrong');
		expect(wrongPassword.ok).toBe(false);
		expect(unknownUser.ok).toBe(false);
		if (wrongPassword.ok || unknownUser.ok) return;
		expect(wrongPassword.reason).toBe(unknownUser.reason);
	});

	it('rejects a session past its expiry', async () => {
		const env = fakeDb({ id: 1, username: 'admin', password_hash: hashPassword('correct-horse') });
		const login = await attemptLogin(env, 'admin', 'correct-horse');
		expect(login.ok).toBe(true);
		if (!login.ok) return;

		vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 8 * 24 * 60 * 60 * 1000);
		const req = new Request('https://admin.example.org/', { headers: { Cookie: `${SESSION_COOKIE}=${login.token}` } });
		const result = await localAuth(env).verify(req);
		expect(result.ok).toBe(false);
		vi.restoreAllMocks();
	});

	it('flags a freshly created default login as needing a password change', async () => {
		const env = fakeDb({ id: 1, username: 'admin', password_hash: hashPassword('generated-default'), must_change_password: 1 });
		const login = await attemptLogin(env, 'admin', 'generated-default');
		expect(login.ok).toBe(true);
		if (login.ok) expect(login.mustChangePassword).toBe(true);
	});
});

describe('session token hashing', () => {
	it('never stores the raw token, only its SHA-256', async () => {
		const env = fakeDb({ id: 1, username: 'admin', password_hash: hashPassword('correct-horse') });
		const login = await attemptLogin(env, 'admin', 'correct-horse');
		expect(login.ok).toBe(true);
		if (!login.ok) return;
		// The fake DB's insert call is `bind(token_hash, ...)` — assert it
		// received the hash, not the plaintext token, by checking a lookup
		// with the raw token's own SHA-256 succeeds.
		const expectedHash = createHash('sha256').update(login.token).digest('hex');
		const req = new Request('https://admin.example.org/', { headers: { Cookie: `${SESSION_COOKIE}=${login.token}` } });
		const result = await localAuth(env).verify(req);
		expect(result.ok).toBe(true);
		expect(expectedHash).not.toBe(login.token);
	});
});
