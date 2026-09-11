/**
 * Date and time formatting for a church that may be anywhere.
 *
 * Timezone and locale are settings, not constants. Formatting an event in
 * the server's timezone shows the wrong hour to every visitor outside it,
 * and a church in another country should not be forced into US date order.
 *
 * Defaults: the church's own `timezone` setting, else UTC — never the
 * runtime's, which on Cloudflare is UTC anyway but on a developer's laptop
 * is whatever they happen to be in.
 */
export interface Formats {
  locale: string;
  timeZone: string;
}

export function formatsFrom(settings: Record<string, any>): Formats {
  return {
    locale: settings.locale || 'en-US',
    timeZone: settings.timezone || 'UTC',
  };
}

export function formatDate(
  value: string | number | Date,
  { locale, timeZone }: Formats,
  options: Intl.DateTimeFormatOptions = { month: 'long', day: 'numeric', year: 'numeric' }
): string {
  return new Date(value).toLocaleDateString(locale, { ...options, timeZone });
}

export function formatTime(
  value: string | number | Date,
  { locale, timeZone }: Formats,
  options: Intl.DateTimeFormatOptions = { hour: 'numeric', minute: '2-digit' }
): string {
  return new Date(value).toLocaleTimeString(locale, { ...options, timeZone });
}
