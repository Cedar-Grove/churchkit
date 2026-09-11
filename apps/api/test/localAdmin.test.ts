import { describe, it, expect, vi, beforeEach } from 'vitest';
import { isLocalDevRequest } from '../src/lib/localAdmin';
import type { Env } from '../src/types';

const withBypass = { DB: {}, ADMIN_DEV_BYPASS: 'yes' } as unknown as Env;
const without = { DB: {} } as unknown as Env;
const req = (url: string) => new Request(url);

beforeEach(() => {
	vi.spyOn(console, 'warn').mockImplementation(() => {});
	vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('isLocalDevRequest', () => {
	it('is off unless the variable is set', () => {
		expect(isLocalDevRequest(req('http://localhost:8787/api/admin/pages'), without)).toBe(false);
	});

	it('allows a loopback request when set', () => {
		expect(isLocalDevRequest(req('http://localhost:8787/api/admin/pages'), withBypass)).toBe(true);
		expect(isLocalDevRequest(req('http://127.0.0.1:8787/api/admin/pages'), withBypass)).toBe(true);
	});

	it('cannot activate on a deployed worker, even with the variable set', () => {
		// The structural guarantee: a real deployment's request URL carries
		// the church's domain, so the bypass is unreachable there.
		expect(isLocalDevRequest(req('https://api.example.org/api/admin/pages'), withBypass)).toBe(false);
		expect(isLocalDevRequest(req('https://api.church.org/api/admin/staff'), withBypass)).toBe(false);
	});

	it('is not fooled by a hostname that merely contains localhost', () => {
		expect(isLocalDevRequest(req('https://localhost.evil.com/api/admin/pages'), withBypass)).toBe(false);
		expect(isLocalDevRequest(req('https://notlocalhost/api/admin/pages'), withBypass)).toBe(false);
	});

	it('warns loudly when set somewhere it will be ignored', () => {
		const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
		isLocalDevRequest(req('https://api.example.org/api/admin/pages'), withBypass);
		expect(spy).toHaveBeenCalledWith(expect.stringContaining('ADMIN_DEV_BYPASS'));
	});
});
