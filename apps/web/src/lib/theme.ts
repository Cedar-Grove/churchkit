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
 * The font pairings themselves live in @churchkit/config, shared with
 * apps/admin's settings <select>.
 */

import { FONT_PRESETS, type FontPreset } from '@churchkit/config/font-presets';

/**
 * `undefined` when there is no admin override to apply — the caller (see
 * Layout.astro) falls back to the compiled brand.json defaults in that
 * case, exactly as this project's own rule says it should ("absent
 * settings mean keep the compiled value"). This used to default to
 * FONT_PRESETS.classic instead, which silently forced Cormorant Garamond +
 * Roboto onto every deployment that had never opened admin's Branding
 * section — invisible unless you compared the rendered font against the
 * church's own brand.json, since Cormorant Garamond reads as "an elegant
 * serif" at a glance same as whatever the brand file actually names.
 */
export function resolveFontPreset(id: string | undefined): FontPreset | undefined {
	return id ? FONT_PRESETS[id] : undefined;
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
