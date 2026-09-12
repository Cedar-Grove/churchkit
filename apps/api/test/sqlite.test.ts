import { describe, it, expect, beforeEach } from 'vitest';
import { SqliteDatabase, loadNodeSqlite, type NodeSqliteDatabase } from '../src/platform/sqlite';
import { getSettings, parseTitleDate } from '../src/lib/data';
import type { Env } from '../src/types';

/**
 * The adapter's job is to make code written against D1 work unchanged, so
 * these exercise the real query shapes the app uses rather than the
 * adapter's methods in isolation.
 */
async function freshDb(): Promise<SqliteDatabase> {
	const { DatabaseSync } = await loadNodeSqlite();
	const raw = new DatabaseSync(':memory:') as unknown as NodeSqliteDatabase;
	raw.exec(`
		CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT);
		CREATE TABLE staff (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, sort_order INTEGER DEFAULT 0, active INTEGER DEFAULT 1);
		CREATE TABLE pages (slug TEXT PRIMARY KEY, title TEXT, is_ministry INTEGER DEFAULT 0, sort_order INTEGER DEFAULT 0, status TEXT);
	`);
	return new SqliteDatabase(raw);
}

describe('SqliteDatabase', () => {
	let db: SqliteDatabase;
	beforeEach(async () => { db = await freshDb(); });

	it('runs the insert/select cycle the app uses', async () => {
		await db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').bind('church_name', 'Example Church').run();
		const row = await db.prepare('SELECT value FROM settings WHERE key = ?').bind('church_name').first<{ value: string }>();
		expect(row?.value).toBe('Example Church');
	});

	it('returns null from first() for a missing row, like D1', async () => {
		const row = await db.prepare('SELECT value FROM settings WHERE key = ?').bind('nope').first();
		expect(row).toBeNull();
	});

	it('wraps rows in { results } the way every caller expects', async () => {
		await db.prepare('INSERT INTO staff (name, sort_order) VALUES (?, ?)').bind('A', 1).run();
		await db.prepare('INSERT INTO staff (name, sort_order) VALUES (?, ?)').bind('B', 2).run();
		const { results } = await db.prepare('SELECT name FROM staff ORDER BY sort_order').all<{ name: string }>();
		expect(results.map((r) => r.name)).toEqual(['A', 'B']);
	});

	it('reports last_row_id as a number, which the staff route returns to the client', async () => {
		const result = await db.prepare('INSERT INTO staff (name) VALUES (?)').bind('First').run();
		expect(result.meta.last_row_id).toBe(1);
		expect(typeof result.meta.last_row_id).toBe('number');
	});

	it('applies a batch atomically, rolling back if one statement fails', async () => {
		// The second insert prepares fine and fails when it runs, on the
		// primary key. A statement that fails at *prepare* time would not
		// reach batch() at all — see the note on eager preparation in
		// platform/sqlite.ts.
		await db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').bind('taken', 'x').run();

		await expect(db.batch([
			db.prepare('INSERT INTO staff (name) VALUES (?)').bind('kept?'),
			db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').bind('taken', 'again'),
		])).rejects.toThrow();

		// D1's batch is all-or-nothing; a half-applied batch would leave the
		// caller no way to detect or repair the damage.
		const { results } = await db.prepare('SELECT name FROM staff').all();
		expect(results).toHaveLength(0);
	});

	it('converts booleans and null the way SQLite needs', async () => {
		await db.prepare('INSERT INTO pages (slug, title, is_ministry, status) VALUES (?, ?, ?, ?)')
			.bind('kids', null, true, 'published').run();
		const row = await db.prepare('SELECT title, is_ministry FROM pages WHERE slug = ?')
			.bind('kids').first<{ title: unknown; is_ministry: number }>();
		expect(row?.title).toBeNull();
		expect(row?.is_ministry).toBe(1);
	});

	it('serves getSettings(), parsing the JSON setting as the API does', async () => {
		await db.batch([
			db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').bind('church_name', 'Example Church'),
			db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').bind('service_times', '{"saturday":["6:00 PM"]}'),
			db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').bind('service_notes', '{"saturday":"Casual dress."}'),
		]);

		const settings = await getSettings({ DB: db } as unknown as Env);
		expect(settings.church_name).toBe('Example Church');
		expect(settings.service_times).toEqual({ saturday: ['6:00 PM'] });
		expect(settings.service_notes).toEqual({ saturday: 'Casual dress.' });
	});

	it('supports the ministries query the website depends on', async () => {
		await db.batch([
			db.prepare('INSERT INTO pages (slug, title, is_ministry, sort_order, status) VALUES (?, ?, ?, ?, ?)').bind('youth', 'Youth', 1, 2, 'published'),
			db.prepare('INSERT INTO pages (slug, title, is_ministry, sort_order, status) VALUES (?, ?, ?, ?, ?)').bind('kids', 'Kids', 1, 1, 'published'),
			db.prepare('INSERT INTO pages (slug, title, is_ministry, sort_order, status) VALUES (?, ?, ?, ?, ?)').bind('about', 'About', 0, 0, 'published'),
		]);
		const { results } = await db.prepare(
			`SELECT slug FROM pages WHERE is_ministry = 1 AND status = 'published' ORDER BY sort_order ASC, title ASC`
		).all<{ slug: string }>();
		expect(results.map((r) => r.slug)).toEqual(['kids', 'youth']);
	});
});

describe('shared logic is host-independent', () => {
	it('parses sermon title dates identically regardless of platform', () => {
		expect(parseTitleDate('Worship 9.7.2026')).toBe('2026-09-07');
	});
});
