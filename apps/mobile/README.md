# ChurchKit mobile

One codebase, one build per church.

```bash
CHURCH=my-church npx expo start
CHURCH=my-church eas build --profile production --platform all
```

`CHURCH` names a directory under `brands/`, whose `brand.json` supplies the
app's name, colours, icons, URLs and store identifiers. There is no default:
a build carrying the wrong church's identity is worse than no build.

## Migrating a church that already has an app

Three values in `brand.json` are the app's existing identity, and changing
any of them strands every member who already has it installed:

| `mobile.bundleIdentifier` | iOS. The app's identity in the App Store. |
| `mobile.androidPackage` | Android. Same, for Play. |
| `mobile.onesignalAppId` | Push. A new ID silently stops reaching every installed phone. |

Carry all three across unchanged, along with `easProjectId` and
`updatesUrl` if the church uses EAS Update.

## Publishing

Apple's Guideline 4.2.6 restricts apps built from templates: **each church
must publish under its own Apple Developer account**, with whoever maintains
the app added as a manager. Plan for that before the first submission — it
decides who owns the listing and who can ship updates.

## What the app hides when unconfigured

Nothing here is required. A church with no Church Center loses the Account
tab; with no giving URL, the giving entry; with no privacy policy, that
link. The app never falls back to another church's URL.
