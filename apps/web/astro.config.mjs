// @ts-check
import { defineConfig } from 'astro/config';

/**
 * Cloudflare by default, Node when asked.
 *
 * CHURCHKIT_HOST=node switches the adapter for a self-hosted deployment.
 * The pages themselves are unchanged either way — only how the built server
 * is run differs.
 */
const host = process.env.CHURCHKIT_HOST ?? 'cloudflare';

const adapter =
  host === 'node'
    ? (await import('@astrojs/node')).default({ mode: 'standalone' })
    : (await import('@astrojs/cloudflare')).default();

export default defineConfig({
  output: 'server',
  adapter,
  vite: {
    resolve: {
      alias: {
        // Pages import runtime config from src/lib/env.ts, which re-exports
        // whichever of these the host provides. Without this indirection
        // every page would import `cloudflare:workers` by name and no other
        // host could build them.
        '#runtime-env': new URL(
          host === 'node' ? './src/lib/env.node.ts' : './src/lib/env.cloudflare.ts',
          import.meta.url
        ).pathname,
      },
    },
  },
});
