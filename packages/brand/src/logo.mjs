/**
 * A placeholder wordmark, so a church has a logo before it has a logo.
 *
 * The site's header and footer load logo images. With none present they
 * render a broken image, which is how a freshly seeded deployment ends up
 * looking unfinished for a reason that has nothing to do with the church's
 * content. A church that supplies its own files overwrites these; one that
 * has not yet gets its own name, set in its own typeface and colours.
 */

/** XML-escape text destined for an SVG. */
function esc(value) {
	return String(value ?? '')
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');
}

/**
 * Rough width of a rendered string, used to size the viewBox.
 *
 * Exact metrics would need the font loaded; this only has to keep the text
 * inside its box, so it errs generous.
 */
function approximateWidth(text, fontSize) {
	return text.length * fontSize * 0.55;
}

export function wordmarkSvg(brand, { variant = 'dark' } = {}) {
	const name = brand.identity?.shortName || brand.identity?.name || 'Your Church';
	const tagline = brand.identity?.tagline ?? '';

	// "dark" means a mark for light backgrounds, and vice versa — named for
	// the ink rather than the surface, which is the convention the existing
	// filenames already use.
	const colour = variant === 'white' ? '#ffffff' : (brand.colors?.brand ?? '#222222');
	const subColour = variant === 'white' ? 'rgba(255,255,255,0.72)' : (brand.colors?.brandMid ?? '#666666');

	const family = brand.fonts?.heading?.stack ?? "Georgia, 'Times New Roman', serif";
	const nameSize = 46;
	const taglineSize = 15;

	const width = Math.max(
		approximateWidth(name, nameSize),
		approximateWidth(tagline, taglineSize),
		220
	);
	const height = tagline ? 84 : 60;

	return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${Math.round(width)} ${height}" role="img" aria-label="${esc(name)}">
  <title>${esc(name)}</title>
  <text x="0" y="46" font-family="${esc(family)}" font-size="${nameSize}" font-weight="600" fill="${colour}">${esc(name)}</text>
${tagline ? `  <text x="2" y="72" font-family="${esc(family)}" font-size="${taglineSize}" fill="${subColour}">${esc(tagline)}</text>\n` : ''}</svg>
`;
}
