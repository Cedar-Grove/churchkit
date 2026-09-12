/**
 * Small, generic reads over `service_times` and address settings, shared by
 * anything that wants a single line rather than the full schedule — the
 * header's utility bar, the footer's copyright line.
 *
 * Deliberately not a fallback: each of these returns null when the data
 * needed isn't there, and callers omit the line entirely rather than
 * showing half of it or inventing the rest.
 */

/** "10:00 AM — Worship Service" -> "10:00 AM". Whatever precedes the dash,
 *  em-dash or hyphen a church used to separate time from label. */
function leadingTime(entry: string): string {
  return entry.split(/[—–-]/)[0].trim();
}

/**
 * The time of a church's main Sunday gathering, for a one-line summary.
 * Prefers an entry labelled "worship"; falls back to the last Sunday entry,
 * since earlier ones are usually a preceding class or study.
 */
export function primarySundayTime(serviceTimes: Record<string, string[]> | undefined): string | null {
  const sunday = serviceTimes?.sunday ?? [];
  if (sunday.length === 0) return null;
  const worship = sunday.find((entry) => /worship/i.test(entry)) ?? sunday[sunday.length - 1];
  const time = leadingTime(worship);
  return time || null;
}

/** "Leeds, AL" from the `city`/`region` settings — not parsed back out of
 *  the one-line `address`, which may contain commas of its own. */
export function cityRegion(settings: Record<string, any>): string | null {
  const parts = [settings.city, settings.region].filter(Boolean);
  return parts.length ? parts.join(', ') : null;
}
