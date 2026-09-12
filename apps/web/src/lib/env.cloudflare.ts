/**
 * Cloudflare Workers: configuration arrives as Worker bindings, exposed by
 * the runtime's own module. Selected by the alias in astro.config.mjs.
 */
export { env } from 'cloudflare:workers';
