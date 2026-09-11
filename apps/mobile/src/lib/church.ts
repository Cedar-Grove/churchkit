import Constants from 'expo-constants';

/**
 * Church configuration supplied at build time by app.config.ts, which reads
 * it from this church's brand file.
 *
 * Every value is nullable on purpose. A church that has not configured
 * Church Center, giving, or a privacy policy should see those entry points
 * hidden — not a button that opens nothing, and never another church's URL
 * as a fallback.
 */
const extra = (Constants.expoConfig?.extra ?? {}) as Record<string, string | null | undefined>;

export const CHURCH_NAME: string = extra.churchName ?? '';
export const CHURCH_SHORT_NAME: string = extra.shortName ?? extra.churchName ?? '';
export const API_BASE_URL: string = extra.apiBaseUrl ?? '';
export const WEBSITE_URL: string | null = extra.websiteUrl ?? null;
export const CHURCH_CENTER_URL: string | null = extra.churchCenterUrl ?? null;
export const GIVING_URL: string | null = extra.givingUrl ?? null;
export const PRIVACY_POLICY_URL: string | null = extra.privacyPolicyUrl ?? null;
export const TERMS_URL: string | null = extra.termsUrl ?? null;
export const ATTENDANCE_BASE_URL: string | null = extra.attendanceBaseUrl ?? null;
