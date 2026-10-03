/**
 * Password hashing for the admin panel's local-login mode.
 *
 * Shared between the Worker/Node API runtime (apps/api, verifying a login)
 * and the CLI (tools/, generating the first deployment's default password)
 * so the two can never disagree about the hash format — both environments
 * have `node:crypto` (the API's `nodejs_compat` flag, and the CLI's native
 * Node), so one implementation covers both rather than two that could drift.
 *
 * scrypt rather than PBKDF2: it is memory-hard, which is the property that
 * actually matters once hashing moves off a GPU-resistant budget — PBKDF2
 * is cheap to brute-force in parallel on dedicated hardware in a way scrypt
 * is deliberately not.
 */

import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEY_LENGTH = 64;

/** `scrypt$<N>$<r>$<p>$<salt-hex>$<hash-hex>` — self-describing, so the cost parameters can change later without breaking existing rows. */
export function hashPassword(password) {
	const salt = randomBytes(16);
	const hash = scryptSync(password, salt, KEY_LENGTH, { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P });
	return `scrypt$${SCRYPT_N}$${SCRYPT_R}$${SCRYPT_P}$${salt.toString('hex')}$${hash.toString('hex')}`;
}

/**
 * Verifies against whatever cost parameters the stored hash itself names,
 * not today's constants — so a future change to SCRYPT_N doesn't break
 * every password hashed under the old one.
 */
export function verifyPassword(password, stored) {
	const parts = String(stored ?? '').split('$');
	if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
	const [, nStr, rStr, pStr, saltHex, hashHex] = parts;
	const N = Number(nStr), r = Number(rStr), p = Number(pStr);
	if (!Number.isFinite(N) || !Number.isFinite(r) || !Number.isFinite(p)) return false;

	let salt, expected;
	try {
		salt = Buffer.from(saltHex, 'hex');
		expected = Buffer.from(hashHex, 'hex');
	} catch {
		return false;
	}
	if (expected.length === 0) return false;

	const actual = scryptSync(password, salt, expected.length, { N, r, p });
	return timingSafeEqual(actual, expected);
}

/**
 * A default credential a volunteer can actually type correctly off a
 * terminal — no ambiguous characters (0/O, 1/l/I), no punctuation a shell
 * or URL would need escaping.
 */
export function generatePassword(length = 20) {
	const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
	const bytes = randomBytes(length);
	return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('');
}
