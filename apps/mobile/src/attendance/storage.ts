import AsyncStorage from '@react-native-async-storage/async-storage';

// There is no sign-in for attendance check-in, so this is how the app remembers "who this
// device belongs to" between scans: a Planning Center person ID picked once and reused for
// every check-in after that, until someone taps "Not you?".
const STORAGE_KEY = 'attendance.personId';

export async function getStoredPersonId(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export async function setStoredPersonId(personId: string): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, personId);
  } catch {}
}

export async function clearStoredPersonId(): Promise<void> {
  try {
    await AsyncStorage.removeItem(STORAGE_KEY);
  } catch {}
}
