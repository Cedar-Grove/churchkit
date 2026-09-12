import { readFileSync, writeFileSync, existsSync } from 'node:fs';

/**
 * Fill a wrangler.jsonc.example template.
 *
 * Placeholders are `<NAME>`; every one must be supplied. A config written
 * with an unreplaced placeholder deploys a Worker pointed at nothing, and
 * the failure surfaces much later and much more confusingly than here.
 */
export function renderTemplate(templatePath, values) {
	const template = readFileSync(templatePath, 'utf8');
	const rendered = template.replace(/<([A-Z0-9_]+)>/g, (match, key) => {
		if (!(key in values)) throw new Error(`Template needs a value for ${match}`);
		return values[key];
	});

	const remaining = rendered.match(/<[A-Z0-9_]+>/g);
	if (remaining) throw new Error(`Unreplaced placeholders: ${[...new Set(remaining)].join(', ')}`);
	return rendered;
}

/** Writes a file, refusing to clobber unless told to. */
export function writeConfig(path, contents, { force = false, dryRun = false } = {}) {
	if (existsSync(path) && !force) {
		return { written: false, reason: 'exists' };
	}
	if (dryRun) {
		console.log(`  would write ${path}`);
		return { written: false, reason: 'dry-run' };
	}
	writeFileSync(path, contents);
	console.log(`  wrote ${path}`);
	return { written: true };
}

/** Extracts the database_id from `wrangler d1 create` output. */
export function parseDatabaseId(stdout) {
	// Wrangler has printed this as raw JSON, as a jsonc block, and as a
	// TOML snippet across versions — match the id itself rather than any
	// one of those shapes.
	// The key may be quoted (JSON) or bare (TOML), hence the optional quote
	// before the separator — matching only the bare form silently found
	// nothing in wrangler's current JSON output.
	const match = stdout.match(/["']?database_id["']?\s*[=:]\s*["']?([0-9a-f-]{36})["']?/i);
	return match ? match[1] : null;
}

/** A Cloudflare domain from a URL, for the routes block. */
export function hostOf(url) {
	try {
		return new URL(url).hostname;
	} catch {
		return null;
	}
}

/** example.org from api.example.org — the zone a route attaches to. */
export function zoneOf(hostname) {
	const parts = String(hostname).split('.');
	return parts.length > 2 ? parts.slice(-2).join('.') : hostname;
}

/**
 * Parse a .jsonc file — JSON with comments and trailing commas.
 *
 * String-aware, because the configs it reads contain URLs: a naive strip of
 * everything after `//` would truncate "https://example.org" to "https:".
 */
export function parseJsonc(text) {
	let out = '';
	let inString = false;
	let inLine = false;
	let inBlock = false;

	for (let i = 0; i < text.length; i++) {
		const ch = text[i];
		const next = text[i + 1];

		if (inLine) {
			if (ch === '\n') { inLine = false; out += ch; }
			continue;
		}
		if (inBlock) {
			if (ch === '*' && next === '/') { inBlock = false; i++; }
			continue;
		}
		if (inString) {
			out += ch;
			if (ch === '\\') { out += next; i++; continue; }
			if (ch === '"') inString = false;
			continue;
		}
		if (ch === '"') { inString = true; out += ch; continue; }
		if (ch === '/' && next === '/') { inLine = true; i++; continue; }
		if (ch === '/' && next === '*') { inBlock = true; i++; continue; }
		out += ch;
	}

	// Trailing commas, which jsonc allows and JSON.parse does not.
	return JSON.parse(out.replace(/,(\s*[}\]])/g, '$1'));
}
