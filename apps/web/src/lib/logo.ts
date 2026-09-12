/**
 * Which logo file to load.
 *
 * `churchkit brand` writes the church's own image if it has one, and a
 * generated wordmark otherwise — so the extension differs by church. This
 * resolves it at build time rather than hardcoding one, which is what made
 * the header render a broken image for every deployment that had not
 * supplied a PNG.
 */
const LOGOS = import.meta.glob('/public/images/logo-*.{svg,png,jpg,jpeg,webp}', {
  eager: true,
  query: '?url',
  import: 'default',
});

function find(base: string): string | null {
  const match = Object.keys(LOGOS).find((path) =>
    path.includes(`/images/${base}.`)
  );
  // The glob key is the source path; the served path drops /public.
  return match ? match.replace('/public', '') : null;
}

/** Dark ink, for light backgrounds. Null when the church has no logo at all. */
export const logoDark = find('logo-dark');

/** White ink, for dark backgrounds. */
export const logoWhite = find('logo-white');
