# Brand assets

A real deployment places its own files here, at the paths named in
`brand.json`'s `assets` block:

| File | Used by | Notes |
|---|---|---|
| `logo-dark.png` | web nav | on light backgrounds |
| `logo-white.png` | web footer | on dark backgrounds |
| `logo-icon.png` | favicons, compact headers | square |
| `icon.png` | mobile app icon | 1024×1024, no transparency |
| `splash.png` | mobile splash | centred on `mobile.splashBackgroundColor` |
| `favicon.png` | web | 32×32 |

No image files are committed to this example. ChurchKit ships no church's
logo, and the fonts referenced by the example brand (Cormorant Garamond,
Roboto) are open-licensed and loaded from Google Fonts rather than bundled.

If your church uses commercially licensed fonts, self-host them in your own
private brand directory — do not commit them to a public repository unless
the licence permits redistribution. Most do not.
