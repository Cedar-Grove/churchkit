import Constants from 'expo-constants';
import type { HomeData, Sermon, ChurchEvent, StaffMember, CarouselSlide, Ministry, Settings, Page } from '../types';

// No fallback: a guessed API base would point this church's app at another
// church's data. A build with no apiBaseUrl is misconfigured, not defaulted.
const BASE_URL: string = (Constants.expoConfig?.extra?.apiBaseUrl as string) ?? '';

// The sermon-notes document is rendered directly in a WebView rather than
// fetched as JSON, so it needs a URL rather than a response.
export function sermonNotesUrl(planId: string): string {
  return `${BASE_URL}/api/sermons/${planId}/notes`;
}

// Reading-plan narration is always the ESV recording, regardless of which
// translation's text is displayed — see the API's handleBibleAudio.
export function bibleAudioUrl(usfm: string, chapter: number): string {
  return `${BASE_URL}/api/bible/audio?usfm=${encodeURIComponent(usfm)}&chapter=${chapter}`;
}

// For translations not available from a client-side Bible API (e.g. ESV,
// which is only licensed to us via Bible Brain — a key that must stay
// server-side), fetch passage text through our own worker instead.
// startVerse/endVerse restrict the result to part of the chapter — used for
// reading-plan days that split a chapter across two days. Honored exactly
// for most translations; NIV and CSB (API.Bible-only text) return the full
// chapter regardless, since that source isn't queried at verse granularity.
export async function fetchBibleTextFromApi(
  translation: string,
  usfm: string,
  chapter: number,
  startVerse?: number,
  endVerse?: number
): Promise<string> {
  let path = `/api/bible/text?translation=${encodeURIComponent(translation)}&usfm=${encodeURIComponent(usfm)}&chapter=${chapter}`;
  if (startVerse !== undefined) path += `&startVerse=${startVerse}`;
  if (endVerse !== undefined) path += `&endVerse=${endVerse}`;
  const { text } = await get<{ text: string }>(path);
  return text;
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`API ${path} returned ${res.status}`);
  return res.json() as Promise<T>;
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw await apiError(path, res);
  return res.json() as Promise<T>;
}

// The API reports why a submission was rejected in a JSON `error` field
// ("First name, last name, and email are required", "Too many
// submissions..."). Pull it out so forms can show the actual reason rather
// than a generic "please try again", which is unactionable when the fix is
// filling in a field.
async function apiError(path: string, res: Response): Promise<Error> {
  const text = await res.text().catch(() => '');
  let message = '';
  try {
    message = JSON.parse(text)?.error ?? '';
  } catch {
    message = text;
  }
  return new Error(message.trim() || `API ${path} returned ${res.status}`);
}

async function del<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw await apiError(path, res);
  return res.json() as Promise<T>;
}

export const api = {
  home: () => get<HomeData>('/api/home'),
  // No limit: the Media screen is the full browse list and filters the
  // response down to items that have a video. Asking for the first 10
  // merged sermons trimmed the list before that filter ran, so the screen
  // rendered only the handful of those 10 that happened to have one.
  sermons: () => get<{ data: Sermon[] }>('/api/sermons'),
  events: () => get<{ data: ChurchEvent[] }>('/api/events'),
  staff: () => get<{ data: StaffMember[] }>('/api/staff'),
  settings: () => get<{ data: Settings }>('/api/settings'),
  carousel: () => get<{ data: CarouselSlide[] }>('/api/carousel'),
  ministries: () => get<{ data: Ministry[] }>('/api/ministries'),

  sermonNotes: (planId: string) =>
    fetch(`${BASE_URL}/api/sermons/${planId}/notes`).then(r => {
      if (!r.ok) throw new Error('Notes not found');
      return r.text();
    }),

  page: (slug: string) => get<{ data: Page }>(`/api/pages/${slug}`),

  submitConnectCard: (data: {
    first_name: string;
    last_name: string;
    email: string;
    phone?: string;
    /** YYYY-MM-DD. The API also accepts MM/DD/YYYY, but send it normalized. */
    birthdate?: string;
    spouse_name?: string;
    address?: { street: string; city: string; state: string; zip: string };
    children?: { name: string; grade: string }[];
    spiritual_journey?: string[];
    how_found?: string;
    notes?: string;
    prayer_request?: string;
    prayer_privacy?: 'congregation' | 'pastoral';
    interested_in?: string;
  }) => post('/api/forms/connect-card', data),

  submitImNew: (data: {
    first_name: string;
    last_name: string;
    email: string;
    phone?: string;
    how_did_you_hear?: string;
  }) => post('/api/forms/im-new', data),

  submitContact: (data: {
    name: string;
    email: string;
    subject?: string;
    message: string;
  }) => post('/api/forms/contact', data),

  submitPrayerRequest: (data: {
    first_name: string;
    last_name: string;
    email?: string;
    phone?: string;
    request: string;
    reply_requested: boolean;
    prayer_list: boolean;
  }) => post('/api/forms/prayer-request', data),

  registerPush: (data: {
    player_id: string;
    platform?: string;
    pco_person_id?: string;
    app_version?: string;
  }) => post<{ success: boolean }>('/api/push/register', data),

  unregisterPush: (playerId: string) =>
    del<{ success: boolean }>('/api/push/register', { player_id: playerId }),
};
