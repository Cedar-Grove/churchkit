export interface HomeLayout {
	name: string;
	description: string;
	sections: string[];
}

export const HOME_SECTIONS: Record<string, string>;
export const HOME_LAYOUTS: Record<string, HomeLayout>;
export function listHomeLayouts(): [string, string][];
export function resolveHomeLayout(id: string | undefined): HomeLayout;
