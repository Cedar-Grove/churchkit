/**
 * Hand-written types for font-presets.mjs. The module ships as plain ESM
 * rather than TypeScript: apps/web builds this package through its SSR
 * bundle, and a source .ts file there would need its own transform/
 * noExternal wiring for no real benefit — the data itself has no logic
 * worth typechecking. This file gives apps/web its FontPreset type back
 * without that cost.
 */

export interface FontStack {
	family: string;
	stack: string;
}

export interface FontPreset {
	name: string;
	heading: FontStack;
	body: FontStack;
	display: FontStack;
	webFontUrl: string;
}

export const FONT_PRESETS: Record<string, FontPreset>;
export function fontPresetLabel(preset: FontPreset): string;
export function listFontPresets(): Array<[id: string, label: string]>;
