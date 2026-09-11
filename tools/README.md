# ChurchKit tools

Command-line tooling for standing up and maintaining a deployment.

Planned:

| Command | Does |
|---|---|
| `provision` | create the D1 database and R2 bucket, apply migrations, seed content, set secrets, attach domains |
| `deploy` | build and deploy api / web / admin for a given brand |
| `migrate` | apply pending D1 migrations, reporting per-deployment state |
| `doctor` | check a deployment's configuration and report what is missing |

Nothing here is implemented yet. The interactive credential walkthrough that
`provision` will replace currently lives as prose in
[`docs/self-hosting.md`](../docs/self-hosting.md).
