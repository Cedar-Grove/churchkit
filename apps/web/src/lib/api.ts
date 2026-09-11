/**
 * There is no default API base. A deployment names its own in wrangler.jsonc
 * (`API_BASE`); guessing one would point a church's website at somebody
 * else's data, which is worse in every case than failing loudly here.
 */
async function apiFetch(apiBase: string | undefined, path: string) {
  if (!apiBase) throw new Error('API_BASE is not configured for this deployment.');
  const res = await fetch(`${apiBase}${path}`);
  if (!res.ok) throw new Error(`API error ${res.status} on ${path}`);
  return res.json();
}

export async function getSettings(apiBase?: string) {
  const { data } = await apiFetch(apiBase, '/api/settings');
  return data;
}

export async function getHome(apiBase?: string) {
  const { settings, latestSermon, latestSermonWithVideo, featuredEvent, liveStream } = await apiFetch(apiBase, '/api/home');
  return { settings, latestSermon, latestSermonWithVideo, featuredEvent, liveStream };
}

export async function getSermons(apiBase?: string) {
  const { data } = await apiFetch(apiBase, '/api/sermons');
  return data;
}

export async function getEvents(apiBase?: string) {
  try {
    const { data } = await apiFetch(apiBase, '/api/events');
    return data;
  } catch {
    return [];
  }
}

export async function getStaff(apiBase?: string) {
  try {
    const { data } = await apiFetch(apiBase, '/api/staff');
    return data;
  } catch {
    return [];
  }
}

export async function getPage(slug: string, apiBase?: string) {
  const { data } = await apiFetch(apiBase, `/api/pages/${slug}`);
  return data;
}

export async function getCarousel(apiBase?: string) {
  try {
    const { data } = await apiFetch(apiBase, '/api/carousel');
    return data;
  } catch {
    return [];
  }
}

/**
 * What this deployment can serve. Pages use it to hide sections a church
 * has not configured — a media page with no YouTube channel behind it, a
 * giving link that goes nowhere — rather than rendering them empty.
 */
export async function getCapabilities(apiBase?: string) {
  try {
    const { data } = await apiFetch(apiBase, '/api/capabilities');
    return data;
  } catch {
    return {};
  }
}

export async function getMinistries(apiBase?: string) {
  try {
    const { data } = await apiFetch(apiBase, '/api/ministries');
    return data;
  } catch {
    return [];
  }
}
