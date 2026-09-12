# churchkit

Command-line tooling for standing up and maintaining a deployment.

```bash
npm install
npx churchkit dev example-church          # try it with no accounts anywhere
npx churchkit provision my-church --dry-run
```

| Command | Does |
|---|---|
| `new <slug>` | Start a new church from the example brand |
| `provision <slug>` | Create the D1 database and R2 bucket, write Wrangler configs, apply the schema |
| `secrets <slug>` | Push credentials to the API worker from a local file |
| `deploy <slug>` | Regenerate brand tokens, then build and deploy api, web and admin |
| `doctor <slug>` | Report what is configured and what each gap switches off |
| `dev <slug>` | Run the whole stack locally in Docker |
| `brand <slug>` | Regenerate design tokens from that church's `brand.json` |
| `seed <slug>` | Load that church's identity from `brand.json` into its database |

A slug names a directory under `brands/` containing a `brand.json`.
`churchkit new` creates one from the example — prefer it to copying the
directory by hand, which leaves the example's slug inside the copied file
and sends the mobile build looking for assets that are not there.

**`provision`, `secrets` and `deploy` target Cloudflare.** Running ChurchKit
on your own server does not use them — see
[`docs/deploy-self-hosted.md`](../docs/deploy-self-hosted.md), which is a
handful of commands rather than a tool. `dev`, `brand` and `doctor` apply
either way.

## Start with a dry run

`--dry-run` prints every command without running any of them. Provisioning
creates real infrastructure against a real Cloudflare account, and it cannot
undo itself, so read the plan before letting it run.

## What it deliberately leaves to a person

Two steps need decisions a script should not make for a church:

- **Custom domains.** `provision` prints which hostname belongs to which
  Worker; attaching them is done in the Cloudflare dashboard.
- **Cloudflare Access.** Which identity provider, and which staff addresses,
  decide who can edit the church's website. Create the Access application,
  then set its audience tag as `CF_ACCESS_AUD`. Until you do, the admin API
  refuses every request — by design, it is not left open in the meantime.

## Secrets

`secrets` reads an env-format file from your own machine and pipes it to
`wrangler secret bulk` over stdin, so values never appear in shell history
or a process listing.

| Flag | Does |
|---|---|
| *(none)* | Push whatever's in the file (`.secrets.<slug>` by default) |
| `--init` | Write an annotated template — every credential, grouped, with where to find each one |
| `--wizard` | Prompt for each credential one group at a time, save after every answer, then offer to push |
| `--status` | List which of the known secrets are actually set on the deployed Worker |
| `--file=<path>` | Use a different file than `.secrets.<slug>` |
| `--dry-run` | Print what would be pushed without sending anything |

`--wizard` is the easiest way to gather credentials over more than one
sitting: it writes the file to disk after every single answer (not just at
the end), so a `Ctrl+C` mid-session loses nothing already typed, and a group
that's only partly filled in says exactly which fields are still missing
rather than a bare count that reads as "good enough."

Blank values are skipped rather than set to an empty string: the API treats
an empty credential as absent, and an empty secret is harder to notice than
a missing one.

`--status` only proves a secret's *name* is set — Cloudflare never returns
values, so it cannot tell a correct credential from a typo. For that,
use the admin panel's **System Health** page after deploying: it calls
each configured provider for real (Planning Center, YouTube, OneSignal,
Resend, Turnstile, Bible Brain / API.Bible) and reports whether it actually
authenticates.

Nothing here is required. A church that sets none of them gets a working
website with pages, staff, ministries and forms — just no video, push,
email or member login.
