#!/bin/sh
# Installs workspace dependencies once, then hands off to the app's command.
#
# node_modules lives in a named volume rather than the bind mount, so a host
# install (possibly for a different platform) never collides with the
# container's.
set -e

if [ ! -d /repo/node_modules/.bin ]; then
	echo "→ installing workspace dependencies (first run only — this takes a few minutes)…"
	if ! npm install --no-audit --no-fund; then
		echo "✗ dependency install failed. Nothing below this would have worked." >&2
		exit 1
	fi
	echo "→ dependencies installed."
fi

echo "→ starting: $*"
exec "$@"
