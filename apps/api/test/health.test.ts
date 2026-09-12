import { describe, it, expect } from 'vitest';
import { runHealthChecks } from '../src/lib/health';
import type { Env } from '../src/types';

/** The minimum viable deployment: a database and nothing else. */
const bare = { DB: {} as D1Database } as Env;

describe('runHealthChecks', () => {
	it('reports every check as unconfigured on a bare deployment, with no network calls', async () => {
		const results = await runHealthChecks(bare);
		const skippable = results.filter((r) => r.name !== 'Admin access (Cloudflare Access)');
		for (const check of skippable) {
			expect(check.configured, `${check.name} should be unconfigured`).toBe(false);
			expect(check.ok, `${check.name} should have nothing to verify`).toBeNull();
			expect(check.detail.length, `${check.name} should explain what to set`).toBeGreaterThan(0);
		}
	});

	it('reports admin access as verified unconditionally — reaching the handler already proved it', async () => {
		const results = await runHealthChecks(bare);
		const admin = results.find((r) => r.name === 'Admin access (Cloudflare Access)');
		expect(admin?.configured).toBe(true);
		expect(admin?.ok).toBe(true);
	});

	it('reports media uploads as bound-but-unverified rather than failing, once configured', async () => {
		const withMedia = { ...bare, MEDIA: {} as any, MEDIA_PUBLIC_URL: 'https://media.example.org' } as Env;
		const results = await runHealthChecks(withMedia);
		const media = results.find((r) => r.name === 'Media uploads (R2)');
		expect(media?.configured).toBe(true);
		expect(media?.ok).toBeNull();
	});
});
