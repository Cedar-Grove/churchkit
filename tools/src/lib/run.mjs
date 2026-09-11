import { spawnSync } from 'node:child_process';

/**
 * Shell out to a command, or print what would run.
 *
 * Provisioning creates real infrastructure and spends real money, so every
 * command is printed before it runs and `--dry-run` stops at printing.
 * Nobody should have to read this source to find out what it is about to do
 * to their Cloudflare account.
 */
export function run(command, args, { dryRun = false, capture = false, cwd } = {}) {
	const printable = [command, ...args]
		.map((a) => (/[\s"']/.test(a) ? JSON.stringify(a) : a))
		.join(' ');

	if (dryRun) {
		console.log(`  would run: ${printable}`);
		return { ok: true, stdout: '', dryRun: true };
	}

	console.log(`  $ ${printable}`);
	const result = spawnSync(command, args, {
		cwd,
		encoding: 'utf8',
		stdio: capture ? ['inherit', 'pipe', 'inherit'] : 'inherit',
	});

	if (result.error) return { ok: false, stdout: '', error: result.error.message };
	return {
		ok: result.status === 0,
		stdout: result.stdout ?? '',
		status: result.status,
	};
}

/** Whether a command exists on PATH. */
export function has(command) {
	const probe = spawnSync(command, ['--version'], { encoding: 'utf8' });
	return !probe.error && probe.status === 0;
}
