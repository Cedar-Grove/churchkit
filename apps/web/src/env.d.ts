type Runtime = import("@astrojs/cloudflare").Runtime<Env>;

declare namespace App {
	interface Locals extends Runtime {}
}

/**
 * `cloudflare:workers` is provided by the Workers runtime, not by a package,
 * so there is nothing on disk for the type checker to resolve. Declared here
 * so `astro check` passes on either host — a Node build never imports it.
 */
declare module 'cloudflare:workers' {
  export const env: Record<string, string | undefined>;
}
