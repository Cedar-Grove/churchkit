/**
 * Homepage section orders a church can choose between, shared by apps/web
 * (which renders them) and apps/admin (which offers them in a <select>).
 *
 * Same pattern as font-presets.mjs: one definition, so the admin picker and
 * the site can never disagree about what a layout id means. The hero banner
 * and the footer frame every layout and are never reordered — what moves is
 * which content comes first after the hero, which is what actually changes
 * a visitor's first impression of the church (events-forward vs.
 * sermon-forward vs. "here's how to visit us" forward, etc.).
 *
 * A section id with no data to show renders nothing wherever it falls in
 * the order — moving `events-preview` to the top does not invent events,
 * it just means an empty slot there until some exist.
 */

/** Every id a layout's `sections` array may use, and what it is. */
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
		description: 'Featured event, then the latest sermon, vision, upcoming events, and gathering info last.',
		sections: ['featured-event', 'latest-sermon', 'pillars', 'events-preview', 'info-strip'],
	},
	'events-first': {
		name: 'Events First',
		description: 'Leads with what is happening next — events and the featured one come right after the hero.',
		sections: ['featured-event', 'events-preview', 'pillars', 'latest-sermon', 'info-strip'],
	},
	'sermon-first': {
		name: 'Sermon First',
		description: 'Puts the latest message front and center, for a church whose homepage is mostly about the preaching.',
		sections: ['latest-sermon', 'featured-event', 'pillars', 'events-preview', 'info-strip'],
	},
	'visitor-first': {
		name: 'Visitor First',
		description: 'Gathering times, address and how to connect appear immediately after the hero — built for a first-time visitor deciding whether to come.',
		sections: ['info-strip', 'featured-event', 'pillars', 'latest-sermon', 'events-preview'],
	},
	'community-first': {
		name: 'Community First',
		description: 'Opens with the vision and pillars before anything else — identity first, logistics last.',
		sections: ['pillars', 'featured-event', 'events-preview', 'latest-sermon', 'info-strip'],
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
