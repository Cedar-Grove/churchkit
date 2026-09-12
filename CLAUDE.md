# ChurchKit — working notes

An open-source website, mobile app and admin panel for churches, built on
Planning Center. One codebase, one deployment per church.

## The rule everything else serves

**No church-specific value may appear in code. Ever.** Not a name, address,
phone number, email, colour, font, service time, ministry list, or API
identifier. This is what makes the project reusable, and it is violated
easily and quietly.

Church-specific values live in exactly three places:

| What | Where |
|---|---|
| Colours, fonts, logo, name, tagline, service times, URLs | `brands/<slug>/brand.json` |
| Pages, staff, ministries, carousel, sermon notes | that deployment's database |
| API keys and routing addresses | Worker secrets, or environment variables |

### A fallback containing content is worse than no fallback

An empty page tells a church "publish this". A fallback tells their
visitors something false in the church's own voice, on the church's own
domain, and nobody notices for months.

This is not hypothetical. Removed from this codebase: a beliefs page that
rendered the Baptist Faith & Message when its API call returned nothing; a
leadership page that fell back to a named real pastor; invented service
times on three pages; one congregation's schedule hardcoded into another's
contact page. When a value is missing, render nothing and say why.

## Architecture

```
apps/api      the API. app.ts routes; worker.ts and server.ts are hosts
apps/web      Astro site. Pages are database rows, not files
apps/admin    Astro + React staff panel, behind Cloudflare Access
apps/mobile   Expo app. One build per church from brand.json
packages/brand brand.json → CSS tokens, mobile theme, settings SQL
tools         the `churchkit` CLI
```

**Nothing is required except a database.** `apps/api/src/lib/capabilities.ts`
derives from bound secrets what a deployment can serve; absent credentials
mean a feature is *unavailable*, never *broken*. Endpoints answer 501 naming
the secret to set; list endpoints answer empty; nothing throws. A church
with no Planning Center, no YouTube, no email and no push still gets a
working website.

**Cloudflare is the default, not a requirement.** `platform/types.ts` is the
seam: six database methods, one storage call, one admin-auth interface,
shaped so D1 and R2 satisfy them structurally. `server.ts` runs the same
routes on Node with SQLite. `app.ts` knows about neither host.

**Pages are content.** `apps/web/src/pages/[...slug].astro` renders any
published page at its slug. Routes with real behaviour (forms, media,
events, giving, staff) stay as files, and `RESERVED_SLUGS` in
`src/lib/nav.ts` stops a page shadowing one.

## Conventions

- TypeScript, strict. Tabs in `apps/api` and `tools`, two spaces in Astro.
- Comments explain *why*, and especially why an obvious alternative is
  wrong. The existing density is deliberate — match it.
- Run `npm test` and `npm run typecheck` from the root; both cover every
  workspace. `astro check` is what typechecks `.astro` frontmatter, and the
  build does not — a whole class of error hides without it.

## Things that have bitten, and the shape of the lesson

Every one of these was a **second copy of a fact** that drifted from the
first. When you find yourself writing a value that already exists
somewhere, derive it instead.

- The Worker's entry point moved to `src/worker.ts`; `churchkit dev` kept
  writing `src/index.ts` into its generated config. It now reads the entry
  point out of `wrangler.jsonc.example`.
- `--config=wrangler.local.jsonc` was omitted twice, in two places. Wrangler
  then reports a missing *database*, which sends you the wrong way entirely.
  Built by one function now, with a test saying why.
- `cp -r examples/example-church brands/x` left `"slug": "example-church"`
  inside — a value the mobile build uses to find assets. Use
  `churchkit new`.
- `npm install` inside a workspace member installs only that member. The
  container entrypoint installs from `/repo`.
- A generated file written *once* outlives the code that generated it. The
  local wrangler config is rewritten every run for exactly this reason.

## Verifying

```bash
npx churchkit new my-church          # scaffold from the example
npx churchkit dev my-church --example # whole stack in Docker, no accounts
npx churchkit doctor my-church        # what is configured, what each gap costs
```

**`churchkit dev` cannot be verified from a cloud agent** — there is no
Docker daemon. Every bug in that path so far was found by a human running
it. If you are working locally and have Docker, running it is the single
most valuable check available to you, and worth doing before claiming any
change to `tools/` or `docker/` works.

The substitute for agents without Docker: tests asserting the *contracts*
the containers depend on — that the template's entry point exists, that the
generated local config names a local database and no routes, that a local
d1 command carries `--config`. See `tools/test/render.test.mjs`.

## State

All four apps are ported and generic. Provisioning, seeding and the local
Docker stack work. 45 tests in `apps/api`, 26 in `tools`.

**Nothing has been deployed to real infrastructure.** No ChurchKit instance
serves a live congregation.

Known open work:
- Migrating an existing church's live data — `pages`, `staff`,
  `carousel_slides`, `sermon_notes`, and especially `device_tokens`, whose
  OneSignal player IDs cannot be recreated. Lose them and push silently
  stops reaching everyone who already has the app.
- Expo SDK 54 → 57, which clears nearly every remaining `npm audit`
  finding. Needs real devices to validate; do not do it blind.
- The repository is still private.
