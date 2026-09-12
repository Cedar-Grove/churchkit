import { spawnSync } from 'node:child_process';
import { createInterface } from 'node:readline/promises';
import { platform } from 'node:os';
import { run, has } from './run.mjs';

/**
 * Finding, and if asked installing, Docker.
 *
 * Installing Docker changes the machine: it adds a system package or a
 * desktop application, usually needs administrator rights, and on Linux
 * adds the user to a group that grants root-equivalent access. So nothing
 * here installs anything without the person in front of it saying yes to a
 * printed plan. `--yes` is available for an unattended run, which is an
 * explicit choice to skip the question, not a default.
 */

/**
 * Why `docker info` failed, which is not the same question as whether the
 * daemon is running.
 *
 * A stopped daemon and a user who is not in the docker group both fail this
 * check, and telling someone to start a daemon that is already running
 * sends them in the wrong direction. So the reason is read out of docker's
 * own stderr rather than assumed.
 */
export function classifyDockerError(stderr) {
	const text = (stderr || '').toLowerCase();

	// The socket exists; this user may not open it. Almost always group
	// membership, which does not apply until a new login session.
	if (text.includes('permission denied')) return 'permission';

	// Nothing listening on the socket at all.
	if (
		text.includes('cannot connect to the docker daemon') ||
		text.includes('is the docker daemon running') ||
		text.includes('no such file or directory')
	) return 'stopped';

	return 'unknown';
}

export function dockerState() {
	if (!has('docker')) return { installed: false, running: false, reason: 'absent' };

	const info = spawnSync('docker', ['info'], { encoding: 'utf8', stdio: 'pipe' });
	if (info.status === 0) return { installed: true, running: true, reason: 'ok' };

	const stderr = info.stderr ?? '';
	return {
		installed: true,
		running: false,
		reason: classifyDockerError(stderr),
		stderr: stderr.trim(),
	};
}

/** Whether `docker compose` (v2 plugin) is available. */
export function hasCompose() {
	const probe = spawnSync('docker', ['compose', 'version'], { encoding: 'utf8', stdio: 'pipe' });
	return probe.status === 0;
}

function linuxInstaller() {
	if (has('apt-get')) return { manager: 'apt', label: 'Debian/Ubuntu (apt)' };
	if (has('dnf')) return { manager: 'dnf', label: 'Fedora/RHEL (dnf)' };
	if (has('pacman')) return { manager: 'pacman', label: 'Arch (pacman)' };
	return null;
}

/**
 * The commands that would install Docker here, as a plan to show someone
 * before running any of it.
 */
export function installPlan() {
	const os = platform();

	if (os === 'darwin') {
		if (has('brew')) {
			return {
				supported: true,
				label: 'macOS (Homebrew)',
				steps: [['brew', ['install', '--cask', 'docker']]],
				after: 'Then open Docker Desktop once, so it can finish setting up.',
			};
		}
		return {
			supported: false,
			label: 'macOS',
			reason: 'Homebrew is not installed.',
			manual: 'Install Docker Desktop from https://docs.docker.com/desktop/install/mac-install/',
		};
	}

	if (os === 'win32') {
		if (has('winget')) {
			return {
				supported: true,
				label: 'Windows (winget)',
				steps: [['winget', ['install', '--id', 'Docker.DockerDesktop', '-e']]],
				after: 'Then open Docker Desktop once, and restart your terminal.',
			};
		}
		return {
			supported: false,
			label: 'Windows',
			reason: 'winget is not available.',
			manual: 'Install Docker Desktop from https://docs.docker.com/desktop/install/windows-install/',
		};
	}

	if (os === 'linux') {
		const found = linuxInstaller();
		if (!found) {
			return {
				supported: false,
				label: 'Linux',
				reason: 'No supported package manager found (apt, dnf or pacman).',
				manual: 'Install Docker Engine: https://docs.docker.com/engine/install/',
			};
		}
		// Distribution packages rather than piping a remote script into a
		// root shell. They lag the upstream release a little; that is a fair
		// trade for not executing whatever a URL happens to serve today.
		const steps = {
			apt: [
				['sudo', ['apt-get', 'update']],
				['sudo', ['apt-get', 'install', '-y', 'docker.io', 'docker-compose-v2']],
			],
			dnf: [['sudo', ['dnf', 'install', '-y', 'docker', 'docker-compose']]],
			pacman: [['sudo', ['pacman', '-S', '--noconfirm', 'docker', 'docker-compose']]],
		}[found.manager];

		return {
			supported: true,
			label: found.label,
			steps: [
				...steps,
				['sudo', ['systemctl', 'enable', '--now', 'docker']],
				['sudo', ['usermod', '-aG', 'docker', process.env.USER ?? '$USER']],
			],
			after:
				'Log out and back in for the docker group to take effect.\n' +
				'  Note: membership of the docker group is equivalent to root on this machine.',
		};
	}

	return { supported: false, label: os, reason: 'Unrecognised platform.', manual: 'https://docs.docker.com/engine/install/' };
}

async function confirm(question) {
	const rl = createInterface({ input: process.stdin, output: process.stdout });
	try {
		const answer = await rl.question(`${question} [y/N] `);
		return /^y(es)?$/i.test(answer.trim());
	} finally {
		rl.close();
	}
}

/**
 * Ensure Docker is usable, offering to install it if not.
 * Returns true when the caller can go ahead.
 */
export async function ensureDocker({ assumeYes = false, dryRun = false } = {}) {
	const state = dockerState();

	if (state.installed && state.running && hasCompose()) return true;

	if (state.installed && !state.running) {
		if (state.reason === 'permission') {
			const user = process.env.USER ?? '$USER';
			console.log('\nThe Docker daemon is running, but this user cannot reach its socket.');
			console.log('  Add yourself to the docker group:\n');
			console.log(`    sudo usermod -aG docker ${user}`);
			console.log('    newgrp docker          # or log out and back in\n');
			console.log('  Group membership does not apply to a shell that was already open,');
			console.log('  which is why this can persist after the command appears to work.');
			console.log('  Note: the docker group is equivalent to root on this machine.');
			if (state.stderr) console.log(`\n  Docker said: ${state.stderr.split('\n')[0]}`);
			return false;
		}

		if (state.reason === 'stopped') {
			console.log('\nDocker is installed but its daemon is not running.');
			console.log(platform() === 'linux'
				? '  Start it with: sudo systemctl start docker'
				: '  Start Docker Desktop, wait for it to report "running", then try again.');
			return false;
		}

		// Something else entirely. Do not guess — show what docker reported.
		console.log('\nDocker is installed but `docker info` failed:');
		console.log(state.stderr ? `\n  ${state.stderr.split('\n').slice(0, 4).join('\n  ')}\n` : '  (no output)');
		return false;
	}

	if (state.installed && !hasCompose()) {
		console.log('\nDocker is installed but the Compose plugin is missing.');
		console.log('  Install it: https://docs.docker.com/compose/install/');
		return false;
	}

	const plan = installPlan();
	console.log('\nDocker is not installed.');

	if (!plan.supported) {
		console.log(`  ${plan.reason}`);
		console.log(`  ${plan.manual}`);
		return false;
	}

	console.log(`\nChurchKit can install it for you on ${plan.label} by running:\n`);
	for (const [cmd, args] of plan.steps) console.log(`    ${cmd} ${args.join(' ')}`);
	console.log('\nThis changes your machine and will ask for your password.');

	if (dryRun) {
		console.log('\n(dry run — nothing installed)');
		return false;
	}

	const go = assumeYes || (await confirm('\nRun these now?'));
	if (!go) {
		console.log('\nNot installing. Run the commands above yourself when ready.');
		return false;
	}

	for (const [cmd, args] of plan.steps) {
		const result = run(cmd, args, {});
		if (!result.ok) {
			console.error(`\n✗ "${cmd} ${args.join(' ')}" failed. Stopping here rather than continuing half-installed.`);
			return false;
		}
	}

	if (plan.after) console.log(`\n${plan.after}`);

	const after = dockerState();
	if (!after.running) {
		console.log('\nDocker is installed but not usable in this shell yet — see the note above, then re-run.');
		return false;
	}
	return true;
}
