// buildNav and RESERVED_SLUGS moved to @churchkit/config/nav so apps/admin
// (a Navigation settings screen) can build the same default menu without a
// second copy of this logic. Re-exported here so existing imports across
// apps/web don't need to change.
export { buildNav, RESERVED_SLUGS } from '@churchkit/config/nav';
export type { NavLink, BuildNavInput } from '@churchkit/config/nav';
