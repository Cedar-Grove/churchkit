import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { appDir, resourceNames } from '../lib/paths.mjs';
import { SECRETS, groupedSecrets } from '../lib/secrets.mjs';
import { run } from '../lib/run.mjs';

/**
 * Push a church's credentials to its API Worker.
 *
 * Reads a local env-format file, never the repository. Values go straight
 * to Cloudflare via `wrangler secret bulk` and are not echoed, written
 * anywhere, or kept — the file stays on the operator's machine and is
 * gitignored.
 *
 * A blank value is skipped rather than set to an empty string, because the
 * API treats an empty credential as absent anyway and an empty secret is
 * harder to notice than a missing one.
 */
export async function secrets({ slug, flags }) {
	const dryRun = flags.has('dry-run');
	const file = resolve(process.cwd(), flags.get('file') ?? `.secrets.${slug}`);

	if (!existsSync(file)) {
		console.log(`\nNo secrets file at ${file}\n`);
		console.log('Create one in env format. Every line is optional — a credential you');
		console.log('leave out simply turns its feature off:\n');
		for (const [group, entries] of groupedSecrets()) {
			console.log(`# ${group}`);
			for (const s of entries) console.log(`${s.name}=`);
			console.log('');
		}
		console.log(`Then: churchkit secrets ${slug} --file=<path>`);
		return 1;
	}

	const parsed = parseEnvFile(readFileSync(file, 'utf8'));
	const known = new Set(SECRETS.map((s) => s.name));

	// Refused by name, not merely absent from the known list, so the reason
	// is explained rather than looking like a typo.
	if ('ADMIN_DEV_BYPASS' in parsed) {
		console.error('\n✗ ADMIN_DEV_BYPASS is for local development and must never be deployed.');
		console.error('  It belongs in docker/.env, which `churchkit dev` writes. Remove it from');
		console.error(`  ${file} and try again.`);
		return 1;
	}

	const unknown = Object.keys(parsed).filter((k) => !known.has(k));
	if (unknown.length) {
		console.log(`\n! Ignoring ${unknown.length} unrecognised key(s): ${unknown.join(', ')}`);
		console.log('  (a typo here would otherwise look like a working credential)');
		for (const key of unknown) delete parsed[key];
	}

	const set = Object.entries(parsed).filter(([, v]) => v !== '');
	if (!set.length) {
		console.log(`\nNothing to push — every value in ${file} is blank.`);
		return 1;
	}

	console.log(`\nPushing ${set.length} secret(s) to ${resourceNames(slug).apiWorker}`);
	for (const [name] of set) console.log(`  ${name}`);

	if (dryRun) {
		console.log('\n(dry run — nothing sent)');
		return 0;
	}

	// `secret bulk` reads JSON on stdin, which keeps values off the command
	// line where they would land in shell history and process listings.
	const payload = JSON.stringify(Object.fromEntries(set));
	const result = run('sh', ['-c', `printf %s ${shellQuote(payload)} | npx wrangler secret bulk`], {
		cwd: appDir('api'),
	});
	return result.ok ? 0 : 1;
}

/** Minimal env-file parser: KEY=value, # comments, blank lines. */
export function parseEnvFile(text) {
	const out = {};
	for (const line of text.split('\n')) {
		const trimmed = line.trim();
		if (!trimmed || trimmed.startsWith('#')) continue;
		const eq = trimmed.indexOf('=');
		if (eq === -1) continue;
		const key = trimmed.slice(0, eq).trim();
		let value = trimmed.slice(eq + 1).trim();
		if (
			(value.startsWith('"') && value.endsWith('"') && value.length > 1) ||
			(value.startsWith("'") && value.endsWith("'") && value.length > 1)
		) {
			value = value.slice(1, -1);
		}
		if (key) out[key] = value;
	}
	return out;
}

function shellQuote(value) {
	return `'${String(value).replace(/'/g, `'\\''`)}'`;
}
