/**
 * The font pairings a church can choose between, shared by apps/web (which
 * renders them) and apps/admin (which offers them in a <select>).
 *
 * This used to be two copies of the same list — the full definition here,
 * plus an `[id, label]` array hand-maintained inside AdminApp.jsx. Nothing
 * failed when they disagreed: adding a preset to one and not the other just
 * meant the admin offered a font the site couldn't render, or withheld one
 * it could. One definition now; `fontPresetLabel` derives the label instead
 * of storing a second copy of it.
 */

export const FONT_PRESETS = {
	// Matches the site's previous hardcoded Google Fonts link and tokens.css
	// defaults exactly, so this preset changes nothing for anyone who
	// hasn't touched Branding.
	classic: {
		name: 'Classic',
		heading: { family: 'Cormorant Garamond', stack: "'Cormorant Garamond', Georgia, serif" },
		body: { family: 'Roboto', stack: 'Roboto, system-ui, -apple-system, sans-serif' },
		display: { family: 'Roboto', stack: 'Roboto, system-ui, -apple-system, sans-serif' },
		webFontUrl: 'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;0,700;1,300;1,400;1,600&family=Roboto:wght@300;400;500;700;900&display=swap',
	},
	modern: {
		name: 'Modern',
		heading: { family: 'Playfair Display', stack: "'Playfair Display', Georgia, serif" },
		body: { family: 'Inter', stack: 'Inter, system-ui, -apple-system, sans-serif' },
		display: { family: 'Inter', stack: 'Inter, system-ui, -apple-system, sans-serif' },
		webFontUrl: 'https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,500;0,600;0,700;1,400;1,600&family=Inter:wght@300;400;500;600;700&display=swap',
	},
	warm: {
		name: 'Warm',
		heading: { family: 'Lora', stack: 'Lora, Georgia, serif' },
		body: { family: 'Nunito Sans', stack: "'Nunito Sans', system-ui, -apple-system, sans-serif" },
		display: { family: 'Nunito Sans', stack: "'Nunito Sans', system-ui, -apple-system, sans-serif" },
		webFontUrl: 'https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,500;0,600;0,700;1,400&family=Nunito+Sans:wght@300;400;600;700&display=swap',
	},
	minimal: {
		name: 'Minimal',
		heading: { family: 'Work Sans', stack: "'Work Sans', system-ui, -apple-system, sans-serif" },
		body: { family: 'Work Sans', stack: "'Work Sans', system-ui, -apple-system, sans-serif" },
		display: { family: 'Work Sans', stack: "'Work Sans', system-ui, -apple-system, sans-serif" },
		webFontUrl: 'https://fonts.googleapis.com/css2?family=Work+Sans:wght@300;400;500;600;700&display=swap',
	},
};

/**
 * "Classic — Cormorant Garamond + Roboto", or "Minimal — Work Sans" when
 * heading and body already agree. Derived from the family names rather than
 * stored, so it can't drift from the preset it describes.
 */
export function fontPresetLabel(preset) {
	const { name, heading, body } = preset;
	return heading.family === body.family
		? `${name} — ${heading.family}`
		: `${name} — ${heading.family} + ${body.family}`;
}

/** `[id, label]` pairs, in definition order, for a <select>. */
export function listFontPresets() {
	return Object.entries(FONT_PRESETS).map(([id, preset]) => [id, fontPresetLabel(preset)]);
}
