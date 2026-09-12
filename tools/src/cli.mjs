#!/usr/bin/env node
import { provision } from './commands/provision.mjs';
import { doctor } from './commands/doctor.mjs';
import { secrets } from './commands/secrets.mjs';
import { deploy } from './commands/deploy.mjs';
import { dev } from './commands/dev.mjs';
import { brand } from './commands/brand.mjs';

const COMMANDS = {
	provision: { run: provision, help: 'Create this church\'s Cloudflare resources and config' },
	secrets: { run: secrets, help: 'Push credentials to the API worker from a local file' },
	deploy: { run: deploy, help: 'Build and deploy api, web and admin' },
	doctor: { run: doctor, help: 'Report what is configured and what each gap costs' },
	dev: { run: dev, help: 'Run api, web and admin locally in Docker containers' },
	brand: { run: brand, help: 'Regenerate design tokens from this church\'s brand.json' },
};

function usage() {
	console.log(`
churchkit <command> <church-slug> [options]

Commands`);
	for (const [name, { help }] of Object.entries(COMMANDS)) {
		console.log(`  ${name.padEnd(11)} ${help}`);
	}
	console.log(`
Options
  --dry-run           Print what would happen, change nothing
  --seed              provision: load example starter content
  --no-media          provision: skip the R2 bucket (no image uploads)
  --database-id=<id>  provision: reuse an existing D1 database
  --force             provision: overwrite existing wrangler.jsonc files
  --file=<path>       secrets: where to read credentials from
  --out=<dir>         brand: where to write the generated tokens
  --only=api,web      deploy: deploy only these apps
  --attach            dev: stay in the foreground streaming logs
  --down / --logs     dev: stop the stack / follow its output
  --yes               dev: install Docker without asking first
  --api-port=8787     dev: change a published port (also --web-port, --admin-port)

A church slug names a directory under brands/ holding a brand.json.
Start with: churchkit provision example-church --dry-run
`);
}

const [, , command, slug, ...rest] = process.argv;

if (!command || command === '--help' || command === '-h') {
	usage();
	process.exit(0);
}

const entry = COMMANDS[command];
if (!entry) {
	console.error(`Unknown command: ${command}`);
	usage();
	process.exit(2);
}

if (!slug || slug.startsWith('-')) {
	console.error(`${command} needs a church slug, e.g. churchkit ${command} example-church`);
	process.exit(2);
}

const flags = new Map();
for (const arg of rest) {
	if (!arg.startsWith('--')) continue;
	const [key, value] = arg.slice(2).split('=');
	flags.set(key, value ?? true);
}
flags.has = Map.prototype.has.bind(flags);

try {
	process.exit((await entry.run({ slug, flags, args: rest })) ?? 0);
} catch (e) {
	console.error(`\n✗ ${e.message}\n`);
	process.exit(1);
}
