# Local stack

```bash
npx churchkit dev example-church
```

Runs the API, website and admin panel in containers on your machine:

| | |
|---|---|
| Website | http://localhost:4321 |
| Admin panel | http://localhost:4322 |
| API | http://localhost:8787 |

`churchkit dev` installs Docker first if it is missing — after showing you
the exact commands and asking. It never installs anything silently.

```bash
churchkit dev <slug> --dry-run   show the plan, change nothing
churchkit dev <slug> --logs      follow output
churchkit dev <slug> --down      stop everything
churchkit dev <slug> --attach    stay in the foreground
```

## This is not a deployment target

No TLS, no admin authentication worth the name, and a bypass that exists
only because neither Cloudflare Access nor a reverse proxy runs on a laptop.
These containers exist so you can see ChurchKit working before choosing a
host — see `docs/deploy-cloudflare.md` or `docs/deploy-self-hosted.md`.

The API runs in workerd via `wrangler dev --local`, with a local D1 database
under `.wrangler/state`. Delete that directory to start over. It is a
separate database from anything deployed — `churchkit dev` writes its own
`wrangler.local.jsonc` precisely so the local stack can never reach a
church's real data.

## The admin bypass

A real deployment authenticates admins with Cloudflare Access or a reverse
proxy of your own. Neither exists on a laptop, so `ADMIN_DEV_BYPASS`
(generated per machine into `docker/.env`) skips the check.

It cannot weaken a deployment, and not because of a flag anyone has to
remember: it applies only to requests whose **own hostname is loopback**,
and a deployed Worker's request URL always carries the church's real domain.
`churchkit secrets` refuses the name outright, and `churchkit doctor`
reports it as a problem if it finds it set.

## Loading content

The local database starts empty, which is correct — ChurchKit ships no
church's content. To load the fictional example:

```bash
cd apps/api
npx wrangler d1 execute example-church-db-local --local \
  --persist-to=../../.wrangler/state --file=seed.example.sql
```

## Ports

`--api-port`, `--web-port` and `--admin-port` change the published ports.
The admin panel's API base is the **host** port, not the compose service
name, because it runs in your browser rather than on the server — the one
place the two differ.
