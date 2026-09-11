#!/usr/bin/env node
/**
 * Brand file validation. Deliberately dependency-free so a church can run
 * it with nothing but Node installed.
 *
 * Beyond shape-checking, this enforces the project's one hard rule: no
 * church-specific placeholder ever ships as a real value, and colour
 * contrast stays legible.
 */

import { readFileSync } from 'node:fs';

const REQUIRED_COLORS = [
	'brand', 'brandMid', 'brandLight', 'brandPale', 'brandFaint',
	'accent', 'accentPale', 'ink', 'inkSoft', 'inkFaint',
	'surface', 'white', 'border', 'borderSoft', 'error',
];

const HEX = /^#[0-9a-fA-F]{6}$/;

/** Relative luminance per WCAG 2.1. */
function luminance(hex) {
	const v = [1, 3, 5].map((i) => {
		const c = parseInt(hex.slice(i, i + 2), 16) / 255;
		return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
	});
	return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
}

export function contrastRatio(a, b) {
	const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
	return (l1 + 0.05) / (l2 + 0.05);
}

export function validate(brand) {
	const problems = [];
	const need = (path, value) => {
		if (value === undefined || value === null || value === '') {
			problems.push(`missing required field: ${path}`);
			return false;
		}
		return true;
	};

	if (!/^[a-z0-9][a-z0-9-]*$/.test(brand.slug ?? '')) {
		problems.push('slug must be lowercase letters, digits and hyphens');
	}

	need('identity.name', brand.identity?.name);
	need('identity.shortName', brand.identity?.shortName);
	need('identity.tagline', brand.identity?.tagline);
	need('contact.email', brand.contact?.email);
	need('urls.api', brand.urls?.api);
	need('urls.web', brand.urls?.web);

	const colors = brand.colors ?? {};
	for (const key of REQUIRED_COLORS) {
		if (!need(`colors.${key}`, colors[key])) continue;
		if (!HEX.test(colors[key])) {
			problems.push(`colors.${key} must be a 6-digit hex value, got "${colors[key]}"`);
		}
	}

	// Legibility: the two pairings every ChurchKit layout relies on.
	if (HEX.test(colors.brand ?? '') && HEX.test(colors.white ?? '')) {
		const r = contrastRatio(colors.brand, colors.white);
		if (r < 4.5) {
			problems.push(
				`colors.brand on white is ${r.toFixed(2)}:1 — below the 4.5:1 needed for body text. ` +
				'Darken colors.brand; it is used for text on light backgrounds.'
			);
		}
	}
	if (HEX.test(colors.ink ?? '') && HEX.test(colors.surface ?? '')) {
		const r = contrastRatio(colors.ink, colors.surface);
		if (r < 4.5) {
			problems.push(`colors.ink on colors.surface is ${r.toFixed(2)}:1 — below 4.5:1.`);
		}
	}

	for (const f of ['heading', 'body', 'display']) {
		need(`fonts.${f}.stack`, brand.fonts?.[f]?.stack);
	}

	return problems;
}

if (import.meta.url === `file://${process.argv[1]}`) {
	const path = process.argv[2];
	if (!path) {
		console.error('usage: validate.mjs <brand.json>');
		process.exit(2);
	}
	const problems = validate(JSON.parse(readFileSync(path, 'utf8')));
	if (problems.length) {
		console.error(`✗ ${path}`);
		for (const p of problems) console.error(`   - ${p}`);
		process.exit(1);
	}
	console.log(`✓ ${path} is a valid brand file`);
}
