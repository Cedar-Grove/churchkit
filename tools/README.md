# churchkit

Command-line tooling for standing up and maintaining a deployment.

```bash
npm install
npx churchkit dev example-church          # try it with no accounts anywhere
npx churchkit provision my-church --dry-run
```

| Command | Does |
|---|---|
| `provision <slug>` | Create the D1 database and R2 bucket, write Wrangler configs, apply the schema |
| `secrets <slug>` | Push credentials to the API worker from a local file |
| `deploy <slug>` | Regenerate brand tokens, then build and deploy api, web and admin |
| `doctor <slug>` | Report what is configured and what each gap switches off |
| `dev <slug>` | Run the whole stack locally in Docker |
| `brand <slug>` | Regenerate design tokens from that church's `brand.json` |

A slug names a directory under `brands/` containing a `brand.json`. Start
from `examples/example-church`.

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
or a process listing. Run `churchkit secrets <slug>` with no file and it
prints a template of every credential, grouped, with what each one enables.

Blank values are skipped rather than set to an empty string: the API treats
an empty credential as absent, and an empty secret is harder to notice than
a missing one.

Nothing here is required. A church that sets none of them gets a working
website with pages, staff, ministries and forms — just no video, push,
email or member login.
