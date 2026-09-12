# Deploying on your own server

The second of two ways to run ChurchKit, and the one that needs no
Cloudflare account. The other is
[deploy-cloudflare.md](deploy-cloudflare.md), which is where the project is
tuned to run and has the least to configure.

The same code runs on an ordinary server with SQLite and the local
filesystem. What you take on in exchange is everything Cloudflare otherwise
provides: TLS, a cache, backups, and — most importantly — authenticating
whoever may edit the church's website.

## What differs

| | Cloudflare | Self-hosted |
|---|---|---|
| API runtime | Workers (workerd) | Node 22+ |
| Database | D1 | SQLite (`node:sqlite`, built in) |
| Uploads | R2 | a directory you serve |
| Admin auth | Cloudflare Access | a reverse proxy you run |
| Scheduled work | cron trigger | an interval in the server |
| TLS, cache, DDoS | included | yours to provide |

Nothing in `apps/api/src/app.ts` knows which of these it is running on. The
two entry points — `worker.ts` and `server.ts` — hand requests to the same
code, so the hosts cannot drift apart.

## Running it

```bash
# API
cd apps/api
npm run build:node
CHURCHKIT_DB=./data/churchkit.db \
CHURCHKIT_MEDIA_DIR=./data/media \
ADMIN_AUTH_MODE=proxy-header \
  npm run start:node

# Website
cd apps/web
npm run build:node
API_BASE=http://127.0.0.1:8787 npm run start:node
```

Create the database first:

```bash
node -e "const {DatabaseSync}=require('node:sqlite'),fs=require('fs');
const d=new DatabaseSync('./data/churchkit.db');
d.exec(fs.readFileSync('schema.sql','utf8'));
d.exec(fs.readFileSync('seed.example.sql','utf8'));"
```

The database is one file. Back it up by copying it.

## Authenticating admins — read this part

There is no Cloudflare Access, so **you must provide the authentication**,
and the admin API can rewrite every page, read every form submission, and
push a notification to the whole congregation.

`ADMIN_AUTH_MODE=proxy-header` trusts a header set by a reverse proxy that
has already authenticated the user — oauth2-proxy, Authelia, Authentik,
Tailscale Serve. This is the standard self-hosting pattern and it is **only
as strong as the proxy's exclusivity**:

> If the API is reachable without going through the proxy, anyone can send
> the header themselves and become an administrator.

So the API binds to `127.0.0.1` by default, and you should leave it there.
`HOST=0.0.0.0` exists, and is a decision rather than an accident. Setting
`ADMIN_PROXY_SHARED_SECRET` additionally requires the proxy to send a
matching `x-churchkit-proxy-secret` header — that does not fix a reachable
API, but it stops a request that merely guesses the header name.

With `ADMIN_AUTH_MODE` unset the admin API refuses everything. That is
deliberate: an unconfigured deployment is inaccessible, never open.

## Checking credentials actually work

`churchkit secrets` is Cloudflare-only — here, every optional credential
(Planning Center, YouTube, OneSignal, Resend, Turnstile, Bible Brain /
API.Bible) is just another environment variable passed to `server.ts`.
Nothing checks that a value you set is *correct* rather than merely
present until something calls that provider. The admin panel's **System
Health** page does exactly that: it calls each configured provider for
real and reports whether it actually authenticates, same as on Cloudflare
— `runHealthChecks()` only reads from `env`, so it doesn't care which host
supplied it.

## What you lose

- **The cache-warming cron becomes an interval** in the server process, so
  the caches are only warm while it is running.
- **No edge caching.** The API sets `Cache-Control` correctly; put
  something in front of it that honours them, or accept the extra load.
- **Turnstile** still works (it is just an API call), but `Cloudflare
  Access` and R2-backed media do not.
- **Backups are yours.** D1 is backed up by Cloudflare; a SQLite file is
  backed up by you.
