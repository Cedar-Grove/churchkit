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

## Testing on a real device, without the app store

`expo start` alone is not enough here: this app uses native modules
(OneSignal, Sentry, background audio) that plain Expo Go cannot run. The
first `expo run:android` or `expo run:ios` builds a custom dev client —
slower, but only needed once per native dependency change.

```bash
export JAVA_HOME=/path/to/a/JDK-17-install   # Gradle rejects newer JDKs outright
npx churchkit brand my-church                 # installs this church's app icon —
                                               # skip this and the very first bundle
                                               # fails: "Cannot find module
                                               # '../../assets/icon.png'"

CHURCH=my-church \
CHURCHKIT_API_BASE_OVERRIDE=https://my-church-api.<subdomain>.workers.dev \
  npx expo run:android      # or run:ios
```

`CHURCHKIT_API_BASE_OVERRIDE` points a build at any API URL without editing
`brand.json` — the file it would otherwise be pulling the *real* production
address from. Needed for testing against a Worker before its custom domain
is attached, or any other API a production build shouldn't be pointed at.
Drop it for a real release build; `app.config.ts` falls back to
`brand.urls.api` when it's unset.

Every device needs `npx churchkit brand <slug>` run at least once, same as
above — it is the only thing that puts the church's icon where this app's
code expects one. Nothing warns you to run it; the build simply fails on
its very first bundle otherwise, and it must be re-run any time
`brand.json`'s icon changes.

Subsequent runs of `expo run:android`/`run:ios` reuse that dev client and
are much faster; `npx expo start` then works normally against it.

### If it builds but crashes with "Invalid hook call"

`metro.config.js` forces a single copy of React into the bundle. If you see
this anyway after adding or upgrading a dependency, check for a second
`react` under `node_modules/@react-navigation/*/node_modules/react` (or
similar) — npm workspaces hoists whatever it can to the repository root,
and if some dependency's own React requirement no longer conflicts with
what's nested here, it will silently start resolving the wrong copy again.
