import { Linking } from 'react-native';
import { navigationRef } from './navigation/navigationRef';

// The check-in QR code / NFC tags always point at this exact host (the attendance Worker's
// custom domain), declared as an associated domain / intent filter in app.json. Anything else
// that reaches this handler is not ours to act on.
import { ATTENDANCE_BASE_URL } from './lib/church';

/**
 * Host serving attendance deep links, taken from this church's own
 * configured domain. A church with none configured matches no link, which
 * is correct — it has no attendance links to match.
 */
const ATTENDANCE_HOST = ATTENDANCE_BASE_URL
  ? ATTENDANCE_BASE_URL.replace(/^https?:\/\//, '').replace(/\/+$/, '')
  : null;

function isAttendanceLink(url: string): boolean {
  try {
    return new URL(url).host === ATTENDANCE_HOST;
  } catch {
    return false;
  }
}

let pending = false;

function goToCheckIn() {
  if (navigationRef.isReady()) {
    navigationRef.navigate('CheckIn' as never);
  } else {
    // Cold start: the link can arrive before NavigationContainer has mounted.
    pending = true;
  }
}

export function flushPendingAttendanceLink() {
  if (pending && navigationRef.isReady()) {
    navigationRef.navigate('CheckIn' as never);
    pending = false;
  }
}

// Call once, e.g. from App.tsx, to catch the QR/NFC link on cold start and while running.
export async function initAttendanceLink() {
  const initialUrl = await Linking.getInitialURL();
  if (initialUrl && isAttendanceLink(initialUrl)) goToCheckIn();

  Linking.addEventListener('url', ({ url }) => {
    if (isAttendanceLink(url)) goToCheckIn();
  });
}
