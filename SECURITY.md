# Security Policy

ChurchKit deployments handle genuinely sensitive data: children's check-in
records, giving history, prayer requests, household relationships, and
push-notification device tokens. Please treat security reports here as
higher stakes than a typical web project.

## Reporting a vulnerability

**Do not open a public issue.**

Use GitHub's [private vulnerability reporting](https://github.com/cedar-grove/churchkit/security/advisories/new)
on this repository. If that is unavailable to you, open a public issue
containing only "I have a security report, please provide a contact" and
nothing else.

Please include, as far as you can:

- The affected component (`apps/api`, `apps/web`, `apps/admin`, `apps/mobile`)
- Version or commit SHA
- Reproduction steps or proof of concept
- What data or capability the issue exposes

## What to expect

ChurchKit is maintained by volunteers. The honest commitment is:

| | Target |
|---|---|
| Acknowledgement | within 7 days |
| Initial assessment | within 30 days |
| Fix for a critical issue affecting live deployments | prioritised above all other work |

These are good-faith targets, not guarantees, and the software is provided
without warranty (see LICENSE). Nothing here creates an obligation of
support. What it does reflect is that real congregations' data may be at
risk, and reports will be treated accordingly.

## Disclosure

We will credit reporters who want it, and aim to publish an advisory once a
fix is available. Because every deployment is self-hosted and upgraded
independently, please allow time for operators to update before public
disclosure. If a vulnerability is already being exploited, we will publish
immediately with mitigation guidance.

## Out of scope

- Vulnerabilities in Planning Center, Cloudflare, OneSignal, Resend,
  YouTube, Sentry, or other third-party services — report those to the
  vendor.
- Findings that require an attacker to already hold valid admin credentials
  or access to the account hosting the deployment.
- Missing hardening headers with no demonstrated impact.

## For operators

If you run a ChurchKit deployment, watch this repository's releases and
security advisories. Nobody can patch your instance for you.
