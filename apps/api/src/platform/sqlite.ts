import type { Database, PreparedStatement, RunResult } from './types';

/**
 * SQLite adapter for self-hosted deployments.
 *
 * Wraps `node:sqlite` — built into Node 22 and later, so a church running
 * this on its own server needs no native module, no build toolchain, and no
 * database to administer. The file is the database; back it up by copying
 * it.
 *
 * The shape it presents is D1's, because D1's is what the rest of the code
 * already speaks. The mapping is small precisely because the code only ever
 * used six methods.
 *
 * One behaviour differs and cannot be hidden: node:sqlite compiles a
 * statement when prepare() is called, so a malformed query or a missing
 * table throws there rather than at run(). D1 defers both to execution.
 * Every query in ChurchKit is a literal against a table the schema creates,
 * so this surfaces only as an earlier, clearer error — but a caller relying
 * on prepare() being lazy would notice.
 */

interface NodeSqliteStatement {
	get(...params: unknown[]): unknown;
	all(...params: unknown[]): unknown[];
	run(...params: unknown[]): { changes?: number | bigint; lastInsertRowid?: number | bigint };
}

export interface NodeSqliteDatabase {
	prepare(sql: string): NodeSqliteStatement;
	exec(sql: string): void;
}

/** SQLite accepts a narrower set of values than JavaScript offers. */
function toSqlite(value: unknown): unknown {
	if (value === undefined || value === null) return null;
	if (typeof value === 'boolean') return value ? 1 : 0;
	if (value instanceof Date) return value.toISOString();
	if (typeof value === 'object') return JSON.stringify(value);
	return value;
}

function asNumber(value: number | bigint | undefined): number | undefined {
	if (value === undefined) return undefined;
	// node:sqlite reports rowids as BigInt. Every id ChurchKit stores is an
	// autoincrement integer far below the safe range, so narrowing is fine —
	// but clamp rather than silently wrap if that ever stops being true.
	return typeof value === 'bigint' ? Number(value) : value;
}

class SqliteStatement implements PreparedStatement {
	constructor(
		private readonly statement: NodeSqliteStatement,
		private readonly params: unknown[] = []
	) {}

	bind(...values: unknown[]): PreparedStatement {
		return new SqliteStatement(this.statement, values.map(toSqlite));
	}

	async first<T = Record<string, unknown>>(): Promise<T | null> {
		return (this.statement.get(...this.params) as T | undefined) ?? null;
	}

	async all<T = Record<string, unknown>>(): Promise<{ results: T[] }> {
		return { results: this.statement.all(...this.params) as T[] };
	}

	async run(): Promise<RunResult> {
		const result = this.statement.run(...this.params);
		return {
			meta: {
				last_row_id: asNumber(result.lastInsertRowid) ?? null,
				changes: asNumber(result.changes) ?? 0,
			},
		};
	}
}

export class SqliteDatabase implements Database {
	constructor(private readonly db: NodeSqliteDatabase) {}

	prepare(query: string): PreparedStatement {
		return new SqliteStatement(this.db.prepare(query));
	}

	/**
	 * D1's batch is atomic, so this one is too: the statements run inside a
	 * transaction and either all apply or none do. A batch that partly
	 * applied would leave, for instance, half a carousel — and the calling
	 * code has no way to detect or repair that.
	 */
	async batch(statements: PreparedStatement[]): Promise<RunResult[]> {
		this.db.exec('BEGIN');
		try {
			const results: RunResult[] = [];
			for (const statement of statements) results.push(await statement.run());
			this.db.exec('COMMIT');
			return results;
		} catch (e) {
			this.db.exec('ROLLBACK');
			throw e;
		}
	}
}

/**
 * Node's own SQLite, loaded through a specifier bundlers cannot see.
 *
 * The import has to be dynamic so the Workers build never resolves a node:
 * module — but it also has to be opaque: Vite does not yet recognise
 * node:sqlite as a builtin, strips the prefix, and then fails looking for a
 * package called "sqlite" on disk. Composing the specifier at runtime
 * leaves it alone.
 */
export async function loadNodeSqlite(): Promise<{ DatabaseSync: new (path: string) => unknown }> {
	// createRequire rather than import(): Vite's module runner intercepts a
	// dynamic import even with a computed specifier, and resolves node:sqlite
	// — which it does not yet list as a builtin — to a package name that does
	// not exist. require() goes straight to Node.
	const { createRequire } = await import('node:module');
	const require = createRequire(import.meta.url);
	return require('node:sqlite') as { DatabaseSync: new (path: string) => unknown };
}

/** Opens (creating if needed) the SQLite file a self-hosted deployment uses. */
export async function openSqlite(path: string): Promise<SqliteDatabase> {
	const { DatabaseSync } = await loadNodeSqlite();
	const db = new DatabaseSync(path) as unknown as NodeSqliteDatabase;
	// Concurrent readers alongside a writer, and foreign keys on, which
	// SQLite otherwise leaves off for backwards compatibility.
	db.exec('PRAGMA journal_mode = WAL');
	db.exec('PRAGMA foreign_keys = ON');
	return new SqliteDatabase(db);
}
