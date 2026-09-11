import { describe, it, expect } from 'vitest';
import { capabilities } from '../src/lib/capabilities';
import { isAllowedAdminOrigin } from '../src/lib/response';
import type { Env } from '../src/types';

/** The minimum viable deployment: a database and nothing else. */
const bare = { DB: {} as D1Database } as Env;

describe('capabilities', () => {
	it('reports everything unavailable on a bare deployment', () => {
		const caps = capabilities(bare);
		for (const [name, enabled] of Object.entries(caps)) {
			expect(enabled, `${name} should be off`).toBe(false);
		}
	});

	it('does not throw on a bare deployment', () => {
		expect(() => capabilities(bare)).not.toThrow();
	});

	it('treats an empty or whitespace secret as absent', () => {
		expect(capabilities({ ...bare, YOUTUBE_API_KEY: '', YOUTUBE_CHANNEL_ID: 'UC123' }).sermons).toBe(false);
		expect(capabilities({ ...bare, YOUTUBE_API_KEY: '   ', YOUTUBE_CHANNEL_ID: 'UC123' }).sermons).toBe(false);
	});

	it('enables sermons on YouTube credentials alone, without Planning Center', () => {
		const caps = capabilities({ ...bare, YOUTUBE_API_KEY: 'k', YOUTUBE_CHANNEL_ID: 'UC123' });
		expect(caps.sermons).toBe(true);
		expect(caps.liveStream).toBe(true);
		expect(caps.planningCenter).toBe(false);
	});

	it('requires both halves of a paired credential', () => {
		expect(capabilities({ ...bare, ONESIGNAL_APP_ID: 'a' }).push).toBe(false);
		expect(capabilities({ ...bare, ONESIGNAL_API_KEY: 'b' }).push).toBe(false);
		expect(capabilities({ ...bare, ONESIGNAL_APP_ID: 'a', ONESIGNAL_API_KEY: 'b' }).push).toBe(true);
	});

	it('separates server-side Planning Center from member login', () => {
		const server = capabilities({ ...bare, PCO_API_ID: 'i', PCO_API_SECRET: 's' });
		expect(server.planningCenter).toBe(true);
		expect(server.events).toBe(true);
		// Login needs the OAuth app as well.
		expect(server.accounts).toBe(false);
		expect(server.checkIn).toBe(false);

		const full = capabilities({ ...bare, PCO_API_ID: 'i', PCO_API_SECRET: 's', PCO_CLIENT_ID: 'c' });
		expect(full.accounts).toBe(true);
		expect(full.checkIn).toBe(true);
	});

	it('accepts either scripture provider for text, but only Bible Brain for audio', () => {
		const apiBible = capabilities({ ...bare, BIBLE_API_KEY: 'k' });
		expect(apiBible.bible).toBe(true);
		expect(apiBible.bibleAudio).toBe(false);

		const brain = capabilities({ ...bare, BIBLE_BRAIN_API_KEY: 'k' });
		expect(brain.bible).toBe(true);
		expect(brain.bibleAudio).toBe(true);
	});

	it('needs both the bucket and its public URL for uploads', () => {
		expect(capabilities({ ...bare, MEDIA: {} as R2Bucket }).mediaUploads).toBe(false);
		expect(
			capabilities({ ...bare, MEDIA: {} as R2Bucket, MEDIA_PUBLIC_URL: 'https://media.example.org' }).mediaUploads
		).toBe(true);
	});
});

describe('isAllowedAdminOrigin', () => {
	it('allows nothing when unconfigured', () => {
		expect(isAllowedAdminOrigin('https://admin.example.org', {})).toBe(false);
	});

	it('matches an exact origin', () => {
		const env = { ADMIN_ALLOWED_ORIGINS: 'https://admin.example.org' };
		expect(isAllowedAdminOrigin('https://admin.example.org', env)).toBe(true);
		expect(isAllowedAdminOrigin('https://other.example.org', env)).toBe(false);
	});

	it('matches a domain and its subdomains via a leading dot', () => {
		const env = { ADMIN_ALLOWED_ORIGINS: '.example.org' };
		expect(isAllowedAdminOrigin('https://example.org', env)).toBe(true);
		expect(isAllowedAdminOrigin('https://admin.example.org', env)).toBe(true);
		expect(isAllowedAdminOrigin('https://a.b.example.org', env)).toBe(true);
	});

	it('does not let a suffix rule match a lookalike domain', () => {
		const env = { ADMIN_ALLOWED_ORIGINS: '.example.org' };
		expect(isAllowedAdminOrigin('https://notexample.org', env)).toBe(false);
		expect(isAllowedAdminOrigin('https://example.org.evil.com', env)).toBe(false);
	});

	it('never allows an http origin to hold credentials', () => {
		expect(isAllowedAdminOrigin('http://admin.example.org', { ADMIN_ALLOWED_ORIGINS: '.example.org' })).toBe(false);
		expect(
			isAllowedAdminOrigin('http://admin.example.org', { ADMIN_ALLOWED_ORIGINS: 'http://admin.example.org' })
		).toBe(false);
	});

	it('rejects a malformed origin', () => {
		expect(isAllowedAdminOrigin('not-a-url', { ADMIN_ALLOWED_ORIGINS: '.example.org' })).toBe(false);
		expect(isAllowedAdminOrigin('', { ADMIN_ALLOWED_ORIGINS: '.example.org' })).toBe(false);
	});
});
