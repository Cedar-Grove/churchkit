import type { Settings } from '../types';

/**
 * Service schedule handling for a church that meets whenever it meets.
 *
 * The app used to name Sunday and Wednesday directly — in the type, in the
 * "is it service time" check, and in the summary line. That encoded one
 * congregation's schedule three layers deep: a church meeting on Saturday,
 * or on Sunday and Thursday, could not express it even after the database
 * and the website learned to. Everything here works from whatever days the
 * church actually published.
 */

/** Day names as JavaScript's getDay() numbers them. */
const DAY_INDEX: Record<string, number> = {
  sunday: 0, monday: 1, tuesday: 2, wednesday: 3,
  thursday: 4, friday: 5, saturday: 6,
};

export type ServiceTimes = Record<string, string[]>;

/**
 * No invented fallback. An unconfigured schedule shows nothing, because a
 * wrong service time sends a visitor to a locked building — and the church
 * never said it.
 */
export function serviceTimesOf(settings: Settings): ServiceTimes {
  const configured = settings.service_times;
  if (!configured || typeof configured !== 'object') return {};
  return Object.fromEntries(
    Object.entries(configured)
      .filter(([, times]) => Array.isArray(times) && times.length > 0)
      .map(([day, times]) => [day.toLowerCase(), times as string[]])
  );
}

/** "9:00 AM — Bible Study" → 540, minutes past midnight. */
export function parseServiceMinutes(entry: string): number | null {
  const match = entry.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)/i);
  if (!match) return null;
  let hour = Number(match[1]) % 12;
  if (match[3].toLowerCase() === 'pm') hour += 12;
  return hour * 60 + Number(match[2] ?? 0);
}

/** Today's services, for whichever day today happens to be. */
export function todaysServices(settings: Settings, now = new Date()): string[] {
  const times = serviceTimesOf(settings);
  for (const [day, entries] of Object.entries(times)) {
    if (DAY_INDEX[day] === now.getDay()) return entries;
  }
  return [];
}

export function minutesUntilNextService(settings: Settings, now = new Date()): number {
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const upcoming = todaysServices(settings, now)
    .map(parseServiceMinutes)
    .filter((m): m is number => m !== null && m > nowMinutes)
    .sort((a, b) => a - b);
  return upcoming.length ? upcoming[0] - nowMinutes : 0;
}

/**
 * Whether to show the home screen's service-day layout.
 *
 * Derived from the church's own schedule rather than assuming Sunday: the
 * window opens a few hours before the first service of the day and closes a
 * few hours after the last. A church with no schedule published never
 * enters it, which is correct — there is no service to be in the middle of.
 */
const WINDOW_BEFORE_MINUTES = 3 * 60;
const WINDOW_AFTER_MINUTES = 3 * 60;

export function isServiceDayMode(settings: Settings, now = new Date()): boolean {
  const today = todaysServices(settings, now)
    .map(parseServiceMinutes)
    .filter((m): m is number => m !== null)
    .sort((a, b) => a - b);
  if (!today.length) return false;

  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  return (
    nowMinutes >= today[0] - WINDOW_BEFORE_MINUTES &&
    nowMinutes <= today[today.length - 1] + WINDOW_AFTER_MINUTES
  );
}

/** "Sunday 9:00 AM & 10:30 AM · Wednesday 6:30 PM" */
export function summarizeServiceTimes(settings: Settings): string {
  return Object.entries(serviceTimesOf(settings))
    .sort(([a], [b]) => (DAY_INDEX[a] ?? 9) - (DAY_INDEX[b] ?? 9))
    .map(([day, entries]) => {
      const hours = entries.map((e) => e.split(/\s+[—-]\s+/)[0].trim()).filter(Boolean);
      if (!hours.length) return null;
      const label = day.charAt(0).toUpperCase() + day.slice(1);
      return `${label} ${hours.join(' & ')}`;
    })
    .filter(Boolean)
    .join('  ·  ');
}
