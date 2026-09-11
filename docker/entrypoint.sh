#!/bin/sh
# Installs workspace dependencies once, then hands off to the app's command.
#
# node_modules lives in a named volume rather than the bind mount, so a host
# install (possibly for a different platform) never collides with the
# container's.
set -e

if [ ! -d /repo/node_modules/.bin ]; then
	echo "→ installing workspace dependencies (first run only)…"
	npm install --no-audit --no-fund
fi

exec "$@"
