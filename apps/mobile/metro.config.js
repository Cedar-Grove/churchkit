const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const config = getDefaultConfig(projectRoot);

/**
 * npm workspaces hoists most of this monorepo's shared packages to the
 * repository root — but this app pins React 19 (matching this Expo SDK),
 * while apps/web and apps/admin (Astro) pin React 18, so the root's
 * node_modules/react is the wrong one for this app.
 *
 * @react-navigation/native needed React 19 specifically, so npm nested its
 * own copy inside this app's node_modules. @react-navigation/core has no
 * such conflict and hoisted cleanly to the root instead — where it then
 * resolves `require('react')` by walking up from its own location, landing
 * on the root's React 18, not this app's React 19. Two live React
 * instances end up in the same bundle with no build-time warning; the only
 * symptom is a runtime "Invalid hook call" / "Cannot read property
 * 'useContext' of null", because a hook created against one React's
 * dispatcher was read through the other's.
 *
 * Forcing every requester's `react` (and its two JSX-runtime entry points)
 * to resolve from this app's own node_modules, regardless of where the
 * requesting module physically lives, is the fix — not disabling
 * hierarchical lookup entirely, which would also stop Metro from finding
 * @react-navigation/core at the root at all.
 */
const SINGLE_INSTANCE = ['react', 'react/jsx-runtime', 'react/jsx-dev-runtime'];

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (SINGLE_INSTANCE.includes(moduleName)) {
    return {
      filePath: require.resolve(moduleName, { paths: [projectRoot] }),
      type: 'sourceFile',
    };
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
