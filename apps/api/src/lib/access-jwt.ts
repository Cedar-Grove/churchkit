import type { Env } from '../types';

interface JWTHeader {
	alg: string;
	kid: string;
}

interface JWTPayload {
	iss: string;
	aud: string | string[];
	exp: number;
	iat: number;
	sub: string;
	[key: string]: unknown;
}

export type VerifyResult =
	| { ok: true; payload: JWTPayload }
	| { ok: false; reason: string };

function base64urlDecode(str: string): Uint8Array {
	const base64 = str.replace(/-/g, '+').replace(/_/g, '/');
	const padded = base64.padEnd(base64.length + (4 - base64.length % 4) % 4, '=');
	const binary = atob(padded);
	return Uint8Array.from(binary, c => c.charCodeAt(0));
}

export async function verifyAccessJWT(request: Request, env: Env): Promise<VerifyResult> {
	const token = request.headers.get('CF-Access-Jwt-Assertion');
	if (!token) return { ok: false, reason: 'missing_token' };

	const parts = token.split('.');
	if (parts.length !== 3) return { ok: false, reason: 'malformed_token' };

	const [headerB64, payloadB64, sigB64] = parts;

	let header: JWTHeader;
	let payload: JWTPayload;
	try {
		header = JSON.parse(new TextDecoder().decode(base64urlDecode(headerB64)));
		payload = JSON.parse(new TextDecoder().decode(base64urlDecode(payloadB64)));
	} catch {
		return { ok: false, reason: 'decode_failed' };
	}

	if (Date.now() / 1000 > payload.exp) return { ok: false, reason: 'token_expired' };

	// Fail closed. With no audience configured there is nothing to verify a
	// token against, so every admin request is refused rather than relying
	// on an undefined comparison happening not to match.
	const expectedAud = env.CF_ACCESS_AUD?.trim();
	if (!expectedAud) return { ok: false, reason: 'access_not_configured' };

	const tokenAud = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
	if (!tokenAud.includes(expectedAud)) {
		return { ok: false, reason: `aud_mismatch: expected=${expectedAud} got=${tokenAud.join(',')}` };
	}

	// Fetch public keys — use cf.cacheTtl so Cloudflare caches the outbound fetch for 1hr,
	// eliminating a cert round-trip on every admin request.
	const certsUrl = `${payload.iss}/cdn-cgi/access/certs`;
	let jwks: { keys: Array<Record<string, unknown>> };
	try {
		const resp = await fetch(certsUrl, {
			cf: { cacheTtl: 3600, cacheEverything: true },
		} as RequestInit & { cf?: Record<string, unknown> });
		if (!resp.ok) return { ok: false, reason: `certs_fetch_failed: ${resp.status}` };
		jwks = await resp.json() as typeof jwks;
	} catch {
		return { ok: false, reason: 'certs_fetch_failed' };
	}

	const jwk = jwks.keys.find(k => k.kid === header.kid);
	if (!jwk) return { ok: false, reason: `kid_not_found: ${header.kid}` };
	// The JWKS is fetched as untyped JSON, so narrow it before importKey
	// rather than asserting past the mismatch.
	if (typeof jwk.kty !== 'string') return { ok: false, reason: 'jwk_missing_kty' };

	try {
		const key = await crypto.subtle.importKey(
			'jwk',
			jwk as unknown as JsonWebKey,
			{ name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
			false,
			['verify'],
		);
		const signingInput = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
		const signature = base64urlDecode(sigB64);
		const valid = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, signature, signingInput);
		if (!valid) return { ok: false, reason: 'sig_invalid' };
	} catch (e: any) {
		return { ok: false, reason: `crypto_error: ${e?.message}` };
	}

	return { ok: true, payload };
}
