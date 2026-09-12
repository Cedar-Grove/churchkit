/**
 * Hand-written types for nav.mjs. Ships as plain ESM, same reasoning as
 * font-presets.d.ts: the plain JSX admin imports this directly, and a
 * source .ts file here would need its own build wiring for no benefit —
 * this is data-shaping logic, not something that needs typechecking twice.
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

export const RESERVED_SLUGS: Set<string>;
export function buildNav(input: BuildNavInput): NavLink[];
