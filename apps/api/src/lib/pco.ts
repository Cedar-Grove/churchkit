import type { Env } from '../types';

export const PCO_BASE = 'https://api.planningcenteronline.com';

/**
 * Thrown when a Planning Center call is attempted on a deployment that has
 * no PCO credentials. Routes should check `capabilities(env).planningCenter`
 * and answer `notConfigured('planningCenter')` before getting here; this is
 * the backstop that keeps a missed check from becoming a confusing 401 from
 * an upstream we never should have called.
 */
export class PcoNotConfiguredError extends Error {
	constructor() {
		super('Planning Center is not configured for this deployment.');
		this.name = 'PcoNotConfiguredError';
	}
}

function authHeader(env: Env): string {
	if (!env.PCO_API_ID || !env.PCO_API_SECRET) throw new PcoNotConfiguredError();
	return `Basic ${btoa(`${env.PCO_API_ID}:${env.PCO_API_SECRET}`)}`;
}

// Raw authenticated fetch, for callers that need the Response itself (e.g.
// lib/cache.ts's cachedJson, which handles its own error/parsing so it can
// fall back to stale cached data on failure) rather than pre-parsed JSON.
export function pcoFetchRaw(path: string, env: Env, options: RequestInit = {}): Promise<Response> {
	return fetch(`${PCO_BASE}${path}`, {
		...options,
		headers: {
			'Authorization': authHeader(env),
			'Content-Type': 'application/json',
			...((options.headers as Record<string, string>) || {}),
		},
	});
}

export async function pcoFetch(path: string, env: Env, options: RequestInit = {}): Promise<any> {
	const res = await pcoFetchRaw(path, env, options);

	if (!res.ok) {
		const text = await res.text();
		console.error(`PCO ${res.status} on ${path} | body: ${text}`);
		throw new Error(`PCO ${res.status} on ${path}: ${text}`);
	}

	return res.json();
}

export async function pcoCreate(
	path: string,
	type: string,
	attributes: Record<string, any>,
	env: Env,
	relationships?: Record<string, any>
): Promise<any> {
	const body: any = { data: { type, attributes } };
	if (relationships) body.data.relationships = relationships;
	return pcoFetch(path, env, { method: 'POST', body: JSON.stringify(body) });
}

export async function pcoUpdate(
	path: string,
	type: string,
	attributes: Record<string, any>,
	env: Env
): Promise<any> {
	return pcoFetch(path, env, {
		method: 'PATCH',
		body: JSON.stringify({ data: { type, attributes } }),
	});
}
