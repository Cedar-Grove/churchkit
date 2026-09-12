/**
 * The site menu, derived rather than declared — shared by apps/web (which
 * renders it) and apps/admin (which lets a church override it).
 *
 * A hardcoded menu is the quiet way a platform stops being reusable: it
 * encodes one church's ministries, one church's section names, and links to
 * features another church never configured. So the default menu is built
 * from what this deployment actually has — the ministry pages it published,
 * and the capabilities its API reports — and a church that wants something
 * different sets `nav_links` in the admin panel.
 */

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

// A custom menu still shouldn't link to /media or /events with nothing
// behind them — that's not a structure or label choice, it's a broken
// link a church didn't ask for and won't understand losing later, when it
// unconfigures a capability it had built the menu around.
const CAPABILITY_FOR_HREF = {
	'/media': 'sermons',
	'/events': 'events',
};

function passesCapabilityGate(link, capabilities) {
	const needed = CAPABILITY_FOR_HREF[link.href];
	return !needed || !!capabilities[needed];
}

export function buildNav({ settings, ministries, capabilities }) {
	// An explicit menu always wins on structure and labels — but not on
	// whether /media or /events actually has anything behind it.
	if (settings.nav_links) {
		try {
			const parsed = typeof settings.nav_links === 'string'
				? JSON.parse(settings.nav_links)
				: settings.nav_links;
			if (Array.isArray(parsed) && parsed.length) {
				return parsed.filter((link) => passesCapabilityGate(link, capabilities));
			}
		} catch {}
	}

	const links = [{ href: '/', label: 'Home' }];

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
