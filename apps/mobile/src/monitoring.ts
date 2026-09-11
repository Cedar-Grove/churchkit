import Constants from 'expo-constants';
import * as Sentry from '@sentry/react-native';

/**
 * Crash and error reporting.
 *
 * Inert until `extra.sentryDsn` is set in app.json — no DSN means no
 * initialization and no network calls, so the app behaves exactly as it did
 * before this existed. Set the DSN from your Sentry project
 * (Settings → Projects → Client Keys) to start receiving reports.
 */
const SENTRY_DSN = (Constants.expoConfig?.extra?.sentryDsn as string | undefined) ?? '';

export const isMonitoringEnabled = !!SENTRY_DSN;

export function initMonitoring(): void {
  if (!isMonitoringEnabled) return;

  Sentry.init({
    dsn: SENTRY_DSN,
    // A church app's traffic is small enough that full tracing costs nothing
    // meaningful, and partial sampling makes a rare crash easy to miss.
    tracesSampleRate: 1.0,
    // Names, emails, prayer requests and children's details pass through this
    // app. Sentry must never become a second copy of that: no IP addresses,
    // no cookies, no request bodies.
    sendDefaultPii: false,
    environment: __DEV__ ? 'development' : 'production',
    release: Constants.expoConfig?.version,
  });
}

/**
 * Reports an error that was already handled — the app recovered, but someone
 * should still know it happened.
 */
export function reportError(error: unknown, context?: Record<string, unknown>): void {
  if (!isMonitoringEnabled) return;
  Sentry.captureException(error, context ? { extra: context } : undefined);
}
