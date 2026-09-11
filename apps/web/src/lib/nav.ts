/**
 * The site menu, derived rather than declared.
 *
 * A hardcoded menu is the quiet way a platform stops being reusable: it
 * encodes one church's ministries, one church's section names, and links to
 * features another church never configured. So the default menu is built
 * from what this deployment actually has — the ministry pages it published,
 * and the capabilities its API reports — and a church that wants something
 * different sets `nav_links` in the admin panel.
 */

export interface NavLink {
  href: string;
  label: string;
  children?: { href: string; label: string }[];
}

export interface BuildNavInput {
  settings: Record<string, any>;
  ministries: { slug: string; title: string }[];
  capabilities: Record<string, boolean>;
}

/**
 * Slugs backed by a real route in this app, which a database page may not
 * shadow. Astro already prefers a static route over the catch-all, so this
 * is the second line of defence — and, more usefully, the list the admin
 * panel checks before letting someone name a page.
 *
 * Note what is *not* here: `about`, `privacy`, `terms` and the like are
 * ordinary content pages served by [...slug], so a church writes and names
 * them itself.
 */
export const RESERVED_SLUGS = new Set([
  '', 'ministries', 'media', 'events', 'contact', 'give', 'leadership',
  'im-new', 'connect-card', 'prayer-request', 'api', 'admin', '404',
]);

export function buildNav({ settings, ministries, capabilities }: BuildNavInput): NavLink[] {
  // An explicit menu always wins. Malformed JSON falls through to the
  // derived menu rather than leaving a church with no navigation at all.
  if (settings.nav_links) {
    try {
      const parsed = typeof settings.nav_links === 'string'
        ? JSON.parse(settings.nav_links)
        : settings.nav_links;
      if (Array.isArray(parsed) && parsed.length) return parsed as NavLink[];
    } catch {}
  }

  const links: NavLink[] = [{ href: '/', label: 'Home' }];

  // "About" is a content page the church writes; the staff listing beneath
  // it is a real route, because it renders people from the API.
  links.push({
    href: '/about',
    label: 'About',
    children: [
      { href: '/about', label: 'About Us' },
      { href: '/leadership', label: 'Our Staff' },
    ],
  });

  if (ministries.length) {
    links.push({
      href: '/ministries',
      label: 'Ministries',
      children: ministries.map((m) => ({
        href: `/ministries/${m.slug}`,
        label: m.title,
      })),
    });
  }

  // Media is a page about sermon video. With no channel configured there is
  // nothing on it, so it is omitted rather than linked and empty.
  if (capabilities.sermons) links.push({ href: '/media', label: 'Media' });
  if (capabilities.events) links.push({ href: '/events', label: 'Events' });

  links.push({ href: '/contact', label: 'Contact' });

  return links;
}
