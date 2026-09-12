/**
 * Runtime configuration, whichever host this is running on.
 *
 * `#runtime-env` is aliased by astro.config.mjs to the Cloudflare or Node
 * implementation. Pages import from here and stay host-agnostic; importing
 * `cloudflare:workers` directly is what previously made a Node build
 * impossible.
 */
// @ts-expect-error — resolved by the alias in astro.config.mjs
export { env } from '#runtime-env';
