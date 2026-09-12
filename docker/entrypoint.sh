#!/bin/sh
# Installs workspace dependencies once, then hands off to the app's command.
#
# node_modules lives in a named volume rather than the bind mount, so a host
# install (possibly for a different platform) never collides with the
# container's.
set -e

if [ ! -d /repo/node_modules/.bin ]; then
	echo "→ installing workspace dependencies (first run only — this takes a few minutes)…"
	# Installed from /repo, not this service's own working_dir: npm treats a
	# plain `npm install` run inside a workspace member as scoped to that one
	# workspace. node_modules is a volume shared by all three containers, so
	# whichever service starts first would otherwise install only its own
	# dependencies and leave the others' unmet — the api container's install
	# would satisfy its own check for the web and admin containers too,
	# without ever installing astro.
	if ! (cd /repo && npm install --no-audit --no-fund); then
		echo "✗ dependency install failed. Nothing below this would have worked." >&2
		exit 1
	fi
	echo "→ dependencies installed."
fi

# Created here, world-writable, before wrangler (running as root) creates it
# first: a root-owned directory on the bind-mounted repo then refuses writes
# from the host process that seeds a church's identity into it after `dev`
# brings the stack up.
mkdir -p /repo/.wrangler
chmod 777 /repo/.wrangler

echo "→ starting: $*"
exec "$@"
