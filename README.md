# ChurchKit

**An open-source website, mobile app, and admin platform for churches, built on Planning Center.**

ChurchKit gives a church its own branded website, iOS/Android app, and staff
admin panel, backed by the Planning Center data it already maintains. Change
a colour, a name, and a logo in one file, and the whole stack follows.

> **Status: early.** ChurchKit is being extracted from a platform that has
> been running in production for one church. The scaffolding and brand system
> are in place; the applications are being ported in. It is not yet ready to
> deploy. Watch releases if you want to know when it is.

---

## What's in the box

| | |
|---|---|
| **`apps/api`** | Cloudflare Worker API — Planning Center proxy, sermons, events, forms, push, scripture |
| **`apps/web`** | Astro marketing site — home, ministries, events, media, forms, giving |
| **`apps/admin`** | Astro + React staff panel — pages, staff, carousel, sermon notes, push |
| **`apps/mobile`** | React Native / Expo app — sermons, Bible with audio, check-in, giving, notifications |
| **`packages/brand`** | One `brand.json` → CSS custom properties + mobile theme |

Data lives in Cloudflare D1 and R2. Everything a church actually cares
about — people, giving, groups, services, check-ins — stays in Planning
Center, where it belongs.

**Cloudflare is the default, not a requirement.** The same code runs on an
ordinary Node server with SQLite and the local filesystem — see
[docs/self-hosting-node.md](docs/self-hosting-node.md), which is honest
about what you take on in exchange (TLS, caching, backups, and
authenticating your own admins).

## Make it yours

Church-specific configuration lives in exactly three places, never in code:

| What | Where |
|---|---|
| Colours, fonts, logo, name, tagline, service times | `brand.json` |
| Pages, staff, ministries, carousel content | your deployment's database |
| API keys and routing addresses | Cloudflare Worker secrets |

```bash
cp -r examples/example-church brands/my-church
$EDITOR brands/my-church/brand.json
npm run brand:build
```

The generator validates as it goes — including WCAG contrast on the colour
pairings the layouts depend on, so a brand that would render illegible text
fails the build instead of shipping.

## Getting started

```bash
git clone https://github.com/cedar-grove/churchkit
cd churchkit
npm install
```

A live deployment needs accounts with Planning Center, Cloudflare, Resend,
OneSignal, YouTube, and a scripture provider — each church registers its own.
See [`docs/self-hosting.md`](docs/self-hosting.md).

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
