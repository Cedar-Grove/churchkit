# brands

One directory per church, each holding a `brand.json` and that church's
logo, app icon and splash image.

**Nothing in here is committed.** A church's brand is its own — its name,
its colours, its store identifiers — and belongs in its own private
repository, not in ChurchKit. Only this file is tracked, so that a fresh
clone has somewhere to put one.

```bash
npx churchkit new my-church
$EDITOR brands/my-church/brand.json
npx churchkit dev my-church --example
```

`examples/example-church` is the template `new` copies from, and the only
brand in this repository. It is fictional.
