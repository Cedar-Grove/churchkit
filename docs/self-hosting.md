# Self-hosting ChurchKit

> **Not yet deployable.** The applications are still being ported into this
> repository. This document is the outline the port is working toward; it
> will be filled in as each app lands.

## What you will need

Each church runs its own accounts. Nothing is shared with the project or
between deployments.

| Service | Used for | Cost |
|---|---|---|
| Cloudflare | Workers, D1, R2, Access, Turnstile | Workers Paid, ~$5/mo |
| Planning Center | people, services, giving, check-ins, calendar | your existing plan |
| Resend | transactional email from forms | free tier available |
| OneSignal | push notifications | free tier available |
| YouTube Data API | sermon video listings | free, quota-limited |
| Bible Brain / API.Bible | scripture text and audio | free keys on request |
| Sentry *(optional)* | error monitoring | free tier available |
| Apple + Google developer accounts | publishing the mobile app | $99/yr + $25 once |

## Outline

1. **Brand** — copy `examples/example-church`, edit `brand.json`, run `npm run brand:build`.
2. **Infrastructure** — create the D1 database and R2 bucket, apply migrations, seed content.
3. **Secrets** — set the Worker secrets listed in `.dev.vars.example`.
4. **Deploy** — API, then web, then admin.
5. **Mobile** — configure EAS, build, submit to both stores.

## A note on publishing the mobile app

Apple's App Store Review Guideline 4.2.6 restricts apps built from templates
or app-generation services. **Each church must publish under its own Apple
Developer account**, not a shared one. Plan for this early: it affects who
owns the listing, who can push updates, and what happens if you part ways
with whoever set it up.

## Scripture licensing

Bible translations are copyrighted. ChurchKit ships no scripture text; it
reads it at runtime from Bible Brain and API.Bible using *your* key, under
*your* agreement with those providers. Check each translation's terms before
enabling it — some permit app use freely, others do not.
