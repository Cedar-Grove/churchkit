# Deploying ChurchKit

This covers deploying to Cloudflare, which is the default and the path with
the least to configure. To run it on your own server instead, see
[self-hosting-node.md](self-hosting-node.md).

## What you will need

Each church runs its own accounts. Nothing is shared with the project or
between deployments.

| Service | Used for | Required? |
|---|---|---|
| Cloudflare | Workers, D1, R2, Access, Turnstile | **yes** (Workers Paid, ~$5/mo) |
| Planning Center | people, services, giving, check-ins, calendar | no |
| Resend | transactional email from forms | no |
| OneSignal | push notifications | no |
| YouTube Data API | sermon video and live stream | no |
| Bible Brain / API.Bible | scripture text and audio | no |
| Sentry | error monitoring | no |
| Apple + Google developer accounts | publishing the mobile app | only for the app |

Only the first is required, and only because something has to run the code.
Every other row is a feature you can leave off: `GET /api/capabilities`
reports what a deployment can serve, and the website and app hide the rest.
`churchkit doctor` lists each unset credential and what it switches off.

## Steps

```bash
npm install

cp -r examples/example-church brands/my-church
$EDITOR brands/my-church/brand.json        # name, colours, fonts, URLs
npx churchkit brand my-church

npx churchkit provision my-church --dry-run   # read the plan before running it
npx churchkit provision my-church --seed
npx churchkit secrets   my-church             # prints a template if the file is missing
npx churchkit deploy    my-church
npx churchkit doctor    my-church
```

`provision` creates the D1 database and R2 bucket, writes each app's
`wrangler.jsonc`, and applies the schema. It is safe to re-run, and cannot
undo itself — hence the dry run first.

## The two steps a script should not do for you

**Custom domains.** `provision` prints which hostname belongs to which
Worker; attach them in the Cloudflare dashboard.

**Cloudflare Access.** Create an Access application covering the admin
panel's hostname, choose which identity provider and which staff addresses
may use it, then set its audience tag:

```bash
cd apps/api && npx wrangler secret put CF_ACCESS_AUD
```

Until you do, the admin API refuses every request and says so. That is
deliberate: an unconfigured deployment is inaccessible, never open.

## Trying it first

```bash
npx churchkit dev example-church
```

Runs the whole stack locally in Docker with no accounts anywhere. See
[`docker/README.md`](../docker/README.md).

## Publishing the mobile app

Apple's App Store Review Guideline 4.2.6 restricts apps built from
templates: **each church must publish under its own Apple Developer
account**, with whoever maintains the app added as a manager. Decide that
before the first submission — it determines who owns the listing and who
can ship updates.

A church migrating an app it already has must carry its existing bundle
identifier, Android package name and OneSignal app ID across unchanged, or
every member already carrying the app is stranded. See
[`apps/mobile/README.md`](../apps/mobile/README.md).

## Scripture licensing

Bible translations are copyrighted. ChurchKit ships no scripture text; it
reads it at runtime from Bible Brain and API.Bible using *your* key, under
*your* agreement with those providers. Check each translation's terms before
enabling it — some permit app use freely, others do not.
