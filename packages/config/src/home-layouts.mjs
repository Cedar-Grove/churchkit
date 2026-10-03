/**
 * Homepage visual themes a church can choose between, shared by apps/web
 * (which renders them) and apps/admin (which offers them in a <select>).
 *
 * Same pattern as font-presets.mjs: one definition, so the admin picker and
 * the site can never disagree about what a theme id means.
 *
 * A theme changes *structure* — hero height and alignment, whether a
 * section is a bordered card or a flat divided row, button shape, how much
 * whitespace a section gets, which sections are solid-color bands — never
 * color. Every theme reads the same --brand/--accent/--ink/--surface/...
 * custom properties admin's Branding section controls, so switching themes
 * never changes a church's configured colors, only how they're applied.
 * See apps/web/src/components/home/*.astro, each of which has one CSS
 * variant per theme id in its own <style> block.
 *
 * `sections` additionally varies which of the five content blocks (after
 * the featured-event/latest-sermon/pillars/events-preview/info-strip set)
 * comes first — a structural choice, same as the rest of what a theme
 * controls. The hero and footer are never reordered.
 */

/** Every id a theme's `sections` array may use, and what it is. */
export const HOME_SECTIONS = {
	'featured-event': 'Featured event strip',
	'latest-sermon': 'Latest sermon',
	'pillars': 'Vision / pillars',
	'events-preview': 'Upcoming events',
	'info-strip': 'Gathering times, address, connect',
};

export const HOME_LAYOUTS = {
	classic: {
		name: 'Classic',
		description: 'Split hero, bordered rounded cards, soft alternating backgrounds — the original design.',
		sections: ['featured-event', 'latest-sermon', 'pillars', 'events-preview', 'info-strip'],
	},
	editorial: {
		name: 'Editorial',
		description: 'Full-bleed magazine feel: no card borders, flat divided rows, generous whitespace, serif-forward.',
		sections: ['featured-event', 'latest-sermon', 'pillars', 'events-preview', 'info-strip'],
	},
	bold: {
		name: 'Bold',
		description: 'High-contrast solid color bands, sharp corners, uppercase tracked type, centered tall hero.',
		sections: ['featured-event', 'events-preview', 'pillars', 'latest-sermon', 'info-strip'],
	},
	minimal: {
		name: 'Minimal',
		description: 'Quiet and airy: short hero, no card backgrounds, hairline dividers, understated text-link buttons.',
		sections: ['pillars', 'latest-sermon', 'featured-event', 'events-preview', 'info-strip'],
	},
	'visitor-first': {
		name: 'Visitor First',
		description: 'Compact banner hero with an elevated "plan your visit" card right beneath it — built for a first-time visitor deciding whether to come.',
		sections: ['info-strip', 'featured-event', 'pillars', 'latest-sermon', 'events-preview'],
	},
};

/** `[id, "Name — description"]` pairs, in definition order, for a <select>. */
export function listHomeLayouts() {
	return Object.entries(HOME_LAYOUTS).map(([id, layout]) => [id, `${layout.name} — ${layout.description}`]);
}

/** A layout by id, falling back to `classic` for an unset or unrecognised value — never an empty homepage over a typo'd setting. */
export function resolveHomeLayout(id) {
	return HOME_LAYOUTS[id] ?? HOME_LAYOUTS.classic;
}
