# Contributing to ChurchKit

Thanks for considering it. ChurchKit exists so that a church of any size can
run a decent website and mobile app without a vendor contract.

## Expectations, honestly stated

This is volunteer-maintained. Issues and pull requests may sit for a while.
There is no roadmap commitment and no support obligation — see the README.
If you need something on a deadline, fork it; that is what the licence is for.

## Sign your commits (DCO)

ChurchKit uses the [Developer Certificate of Origin](https://developercertificate.org/).
There is no CLA and no copyright assignment — you keep your copyright, and
your contribution is licensed under Apache-2.0 like everything else.

Add a sign-off line to every commit:

```
git commit -s -m "Your message"
```

which appends:

```
Signed-off-by: Your Name <your.email@example.com>
```

By signing off you certify that you wrote the patch, or have the right to
submit it under the project's licence.

## Getting set up

```bash
git clone https://github.com/cedar-grove/churchkit
cd churchkit
npm install                          # npm workspaces; installs every app
npx churchkit dev example-church     # whole stack in Docker, no accounts needed
```

That is the quickest way to see it running. To work on one app on its own:

```bash
cp .dev.vars.example apps/api/.dev.vars   # every value optional
npm run dev -w apps/api                   # needs apps/api/wrangler.jsonc
npm run dev -w apps/web
```

`docs/deploy-cloudflare.md` and `docs/deploy-self-hosted.md` cover the two
ways to run it. Neither is more supported than the other in the code —
`apps/api/src/app.ts` knows nothing about either host.

## The one rule that matters: no church-specific code

ChurchKit must never contain a reference to a specific church — not a name,
address, phone number, email, logo, colour, or font. Everything
church-specific belongs in one of three places:

| Kind of thing | Where it goes |
|---|---|
| Colours, fonts, logo, church name, tagline | `brand.json` (see `packages/brand`) |
| Pages, staff, ministries, service times | the deployment's own database |
| API keys, IDs, routing addresses | Worker secrets, or environment variables |

A pull request that hardcodes anything from the list above will be asked to
move it, however small. This is the single discipline that keeps the project
reusable.

`examples/example-church/` is the only place fictional church data lives, and
it must stay fictional — no real names, no real email addresses, no real
street addresses.

## Style

- TypeScript throughout; keep it strict.
- Match the surrounding code's conventions rather than importing your own.
- Comments explain *why*, not *what*. The existing code is fairly heavily
  commented where behaviour is non-obvious (quota budgets, cache TTLs, OAuth
  PKCE) — keep that up.
- Run `npm run typecheck` and `npm test` from the repository root before
  opening a PR. Both run across every workspace.
- Nothing may require an integration. A feature backed by a credential must
  degrade to unavailable when it is unset — see `apps/api/src/lib/capabilities.ts`.

## Security

Do not open a public issue for a vulnerability. See SECURITY.md.

## Code of conduct

By participating you agree to abide by CODE_OF_CONDUCT.md.
