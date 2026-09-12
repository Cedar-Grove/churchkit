/**
 * Curated, request-time overrides on top of the compiled defaults in
 * ./styles/tokens.css.
 *
 * A church can pick a primary color, an accent color, and a font pairing in
 * the admin panel with no rebuild — this resolves those choices into CSS.
 * Everything not covered here (neutrals, the rest of the palette) keeps
 * whatever `packages/brand/generate.mjs` compiled from brand.json, so a
 * deployment that never touches Branding renders byte-identical output.
 *
 * The font list is duplicated (id + label only) in apps/admin's settings
 * UI for its <select> — see the comment there. Keep both in sync.
 */

interface FontStack {
	family: string;
	stack: string;
}

interface FontPreset {
	label: string;
	heading: FontStack;
	body: FontStack;
	display: FontStack;
	webFontUrl: string;
}

export const FONT_PRESETS: Record<string, FontPreset> = {
	// Matches the site's previous hardcoded Google Fonts link and tokens.css
	// defaults exactly, so this preset changes nothing for anyone who
	// hasn't touched Branding.
	classic: {
		label: 'Classic — Cormorant Garamond + Roboto',
		heading: { family: 'Cormorant Garamond', stack: "'Cormorant Garamond', Georgia, serif" },
		body: { family: 'Roboto', stack: 'Roboto, system-ui, -apple-system, sans-serif' },
		display: { family: 'Roboto', stack: 'Roboto, system-ui, -apple-system, sans-serif' },
		webFontUrl: 'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;0,700;1,300;1,400;1,600&family=Roboto:wght@300;400;500;700;900&display=swap',
	},
	modern: {
		label: 'Modern — Playfair Display + Inter',
		heading: { family: 'Playfair Display', stack: "'Playfair Display', Georgia, serif" },
		body: { family: 'Inter', stack: 'Inter, system-ui, -apple-system, sans-serif' },
		display: { family: 'Inter', stack: 'Inter, system-ui, -apple-system, sans-serif' },
		webFontUrl: 'https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,500;0,600;0,700;1,400;1,600&family=Inter:wght@300;400;500;600;700&display=swap',
	},
	warm: {
		label: 'Warm — Lora + Nunito Sans',
		heading: { family: 'Lora', stack: 'Lora, Georgia, serif' },
		body: { family: 'Nunito Sans', stack: "'Nunito Sans', system-ui, -apple-system, sans-serif" },
		display: { family: 'Nunito Sans', stack: "'Nunito Sans', system-ui, -apple-system, sans-serif" },
		webFontUrl: 'https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,500;0,600;0,700;1,400&family=Nunito+Sans:wght@300;400;600;700&display=swap',
	},
	minimal: {
		label: 'Minimal — Work Sans',
		heading: { family: 'Work Sans', stack: "'Work Sans', system-ui, -apple-system, sans-serif" },
		body: { family: 'Work Sans', stack: "'Work Sans', system-ui, -apple-system, sans-serif" },
		display: { family: 'Work Sans', stack: "'Work Sans', system-ui, -apple-system, sans-serif" },
		webFontUrl: 'https://fonts.googleapis.com/css2?family=Work+Sans:wght@300;400;500;600;700&display=swap',
	},
};

export function resolveFontPreset(id: string | undefined): FontPreset {
	return (id && FONT_PRESETS[id]) || FONT_PRESETS.classic;
}

function hexToRgb(hex: string): [number, number, number] | null {
	const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
	if (!m) return null;
	const n = parseInt(m[1], 16);
	return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function toHex(n: number): string {
	return Math.round(n).toString(16).padStart(2, '0');
}

/** Mixes `hex` toward white by `weight` (0 = hex unchanged, 1 = white). */
function towardWhite(hex: string, weight: number): string | null {
	const rgb = hexToRgb(hex);
	if (!rgb) return null;
	const [r, g, b] = rgb.map((c) => c + (255 - c) * weight);
	return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * Derives the handful of palette tokens that scale from a single brand
 * color, given just the two colors an admin actually picks. Neutrals
 * (ink, surface, border, error, ...) are deliberately left alone: they're
 * what keeps body text legible regardless of which hue a church picks, and
 * letting them drift with `primary` is exactly how a picked color could
 * make its own site hard to read.
 */
export function deriveColors(primary?: string, accent?: string): Record<string, string> {
	const out: Record<string, string> = {};
	if (primary && hexToRgb(primary)) {
		out.brand = primary;
		out['brand-mid'] = towardWhite(primary, 0.35)!;
		out['brand-light'] = towardWhite(primary, 0.6)!;
		out['brand-pale'] = towardWhite(primary, 0.85)!;
		out['brand-faint'] = towardWhite(primary, 0.93)!;
	}
	if (accent && hexToRgb(accent)) {
		out.accent = accent;
		out['accent-pale'] = towardWhite(accent, 0.88)!;
	}
	return out;
}
