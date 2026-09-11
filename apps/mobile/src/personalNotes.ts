import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY_PREFIX = 'personalSermonNote:';

export async function getPersonalNote(sermonId: string): Promise<string> {
  try {
    return (await AsyncStorage.getItem(KEY_PREFIX + sermonId)) ?? '';
  } catch {
    return '';
  }
}

export async function savePersonalNote(sermonId: string, text: string): Promise<void> {
  try {
    if (text.trim()) {
      await AsyncStorage.setItem(KEY_PREFIX + sermonId, text);
    } else {
      await AsyncStorage.removeItem(KEY_PREFIX + sermonId);
    }
  } catch {}
}
