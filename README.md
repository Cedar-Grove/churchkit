# ChurchKit

**An open-source website, mobile app, and admin platform for churches, built on Planning Center.**

ChurchKit gives a church its own branded website, iOS/Android app, and staff
admin panel, backed by the Planning Center data it already maintains. Change
a colour, a name, and a logo in one file, and the whole stack follows.

> **Status: pre-release.** All four applications are extracted and generic,
> the provisioning tooling works, and everything builds and passes its tests.
> What has *not* happened yet is a real deployment: no ChurchKit instance is
> serving a live congregation, and the first one will find things. Treat it
> as ready to try, not as proven.

---

## What's in the box

| | |
|---|---|
| **`apps/api`** | The API — Planning Center proxy, sermons, events, forms, push, scripture |
| **`apps/web`** | Astro marketing site — home, ministries, events, media, forms, giving |
| **`apps/admin`** | Astro + React staff panel — pages, staff, carousel, sermon notes, push |
| **`apps/mobile`** | React Native / Expo app — sermons, Bible with audio, check-in, giving, notifications |
| **`packages/brand`** | One `brand.json` → CSS custom properties + mobile theme |
| **`packages/config`** | Values two or more apps must agree on, so none holds a second copy |
| **`tools`** | The `churchkit` command — provision, secrets, deploy, doctor, dev |

Everything a church actually cares about — people, giving, groups, services,
check-ins — stays in Planning Center, where it belongs. ChurchKit stores
only what Planning Center has no place for: pages, staff, carousel slides,
sermon notes.

**Two ways to run it, neither required.**

- [Cloudflare](docs/deploy-cloudflare.md) — Workers, D1 and R2. The default,
  and the least to set up.
- [Your own server](docs/deploy-self-hosted.md) — Node and SQLite, no
  Cloudflare account. Honest about what you take on in exchange: TLS,
  caching, backups, and authenticating your own admins.

`apps/api/src/app.ts` knows about neither. Both hosts hand it the same
requests.

## Make it yours

Church-specific configuration lives in three places, never in code:

| What | Where |
|---|---|
| Starting point: colours, fonts, logo, name, tagline, service times | `brand.json` |
| Everything staff can change without a deploy | your deployment's database |
| API keys and routing addresses | Worker secrets, or environment variables |

Set the starting point once:

```bash
npx churchkit new my-church          # copies the example, sets the slug
$EDITOR brands/my-church/brand.json
npx churchkit brand my-church        # regenerate tokens and logos
```

The generator validates as it goes — including WCAG contrast on the colour
pairings the layouts depend on, so a brand that would render illegible text
fails the build instead of shipping.

After that, most of it is editable in the admin panel: pages, staff,
ministries, the carousel, the homepage's own wording, and the primary
colour, accent, font pairing and logos. A church that never opens those
settings keeps exactly what `brand.json` compiled.

## Getting started

```bash
git clone https://github.com/cedar-grove/churchkit
cd churchkit
npm install
npx churchkit dev example-church     # the whole stack, in Docker, on your machine
```

That needs no accounts with anyone. To rehearse your own church — its name,
colours and service times, with content you add in the local admin panel:

```bash
npx churchkit new my-church
$EDITOR brands/my-church/brand.json
npx churchkit dev my-church --example
```

When it looks right, deploy it:

```bash
npx churchkit provision my-church --dry-run   # read the plan first
npx churchkit provision my-church --seed
npx churchkit secrets    my-church
npx churchkit deploy     my-church
npx churchkit doctor     my-church            # what is configured, and what each gap turns off
```

Nothing beyond a database is required. A church that configures no
credentials at all still gets a working website with pages, staff,
ministries and forms — it just has no video, push, email or member login.
See [`docs/deploy-cloudflare.md`](docs/deploy-cloudflare.md) or
[`docs/deploy-self-hosted.md`](docs/deploy-self-hosted.md) for what each
account gives you, and [`docker/README.md`](docker/README.md) for the local
stack.

## Licence and expectations

Apache-2.0. Use it, change it, deploy it, sell services around it — the
licence asks only that you preserve attribution and the notices.

Two things worth reading before you rely on it:

- **[TRADEMARK.md](TRADEMARK.md)** — the code is yours to use; the *name* is
  not. Build anything you like, just don't present it as though it is ChurchKit.
- **[SECURITY.md](SECURITY.md)** — deployments handle children's check-in
  records, giving history, and prayer requests. Report vulnerabilities
  privately, never in a public issue.

**This is volunteer-maintained and provided as-is.** There is no support
obligation, no roadmap commitment, and no warranty. Issues and pull requests
may sit for a while. If you need guaranteed support, fork it — that is what
the licence is for.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Commits need a DCO sign-off
(`git commit -s`); there is no CLA.

The one rule that keeps this project reusable: **no church-specific values in
code, ever.** Not a name, address, colour, or font.

## Not affiliated

ChurchKit is an independent project. Planning Center, Cloudflare, OneSignal,
Resend, Google, Expo, and Sentry are trademarks of their respective owners and
none of them endorse or sponsor this project. See [NOTICE](NOTICE).
