import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import cloudflare from "@astrojs/cloudflare";

export default defineConfig({
  output: "static", // fully static — Cloudflare Access handles auth at the edge
  integrations: [react()],
  // adapter: cloudflare(), // uncomment if you need SSR/edge functions later
});
