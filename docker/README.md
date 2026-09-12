# Local stack

```bash
npx churchkit new my-church
$EDITOR brands/my-church/brand.json
npx churchkit dev my-church --example
```

Runs the API, website and admin panel in containers on your machine, as
**your** church — name, colours, contact details and service times from your
brand file, not the example's:

| | |
|---|---|
| Website | http://localhost:4321 |
| Admin panel | http://localhost:4322 |
| API | http://localhost:8787 |

`churchkit dev` installs Docker first if it is missing — after showing you
the exact commands and asking. It never installs anything silently.

If Docker is installed and running but `dev` still cannot reach it, the
usual cause is group membership rather than the daemon:

```bash
sudo usermod -aG docker $USER
newgrp docker          # or log out and back in
```

A shell that was already open keeps its old groups, which is why this can
look like it did not work. The `docker` group is equivalent to root on that
machine.

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

## A full rehearsal before deploying

This is the point of the local stack: set the church up completely, click
through it, and only then deploy.

1. **Identity** comes from `brand.json`, applied automatically each time
   `churchkit dev` starts. Edit the file, re-run, and the site updates.
2. **Everything else** you do in the admin panel at
   http://localhost:4322, exactly as you would in production: pages, staff,
   ministries and the carousel, and under Branding the primary colour,
   accent, font pairing and logos, and the homepage's own wording. It
   persists in `.wrangler/state` across restarts, and re-running `dev` does
   not overwrite it.
3. `--example` loads the fictional starter pages, carousel and staff, so a
   brand-new deployment looks like a website rather than an empty shell.
   Skip it if you would rather start from nothing.
4. `--no-seed` skips the identity step entirely.

Rehearsing in the admin panel is the point: nearly everything a church will
want to change is changeable there, so if something can only be fixed by
editing this repository, that is worth reporting rather than working
around.

When it looks right, `churchkit provision` and `churchkit deploy` set up the
real thing — and `churchkit seed <slug>` applies the same identity there,
without touching content.

Content does not transfer from local to production. The local database is a
rehearsal space, not a staging copy: what you type into the local admin
panel stays local.

## Ports

`--api-port`, `--web-port` and `--admin-port` change the published ports.
The admin panel's API base is the **host** port, not the compose service
name, because it runs in your browser rather than on the server — the one
place the two differ.
