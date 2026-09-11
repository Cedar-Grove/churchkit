import AsyncStorage from '@react-native-async-storage/async-storage';

export type NotificationRecord = {
  id: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  receivedAt: number;
  read: boolean;
};

const STORAGE_KEY = 'notificationHistory';
const MAX_HISTORY = 100;

export async function getHistory(): Promise<NotificationRecord[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

async function saveHistory(list: NotificationRecord[]): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {}
}

// Adds a received notification to the top of the history, ignoring duplicates
// (the same notification can reach both the foreground and click listeners).
export async function recordNotification(
  input: Omit<NotificationRecord, 'read'>
): Promise<NotificationRecord> {
  const record: NotificationRecord = { ...input, read: false };
  const current = await getHistory();
  if (current.some(item => item.id === record.id)) return record;
  await saveHistory([record, ...current].slice(0, MAX_HISTORY));
  return record;
}

export async function markNotificationRead(id: string): Promise<void> {
  const current = await getHistory();
  const index = current.findIndex(item => item.id === id);
  if (index === -1 || current[index].read) return;
  current[index] = { ...current[index], read: true };
  await saveHistory(current);
}

export async function markAllNotificationsRead(): Promise<void> {
  const current = await getHistory();
  await saveHistory(current.map(item => (item.read ? item : { ...item, read: true })));
}

export async function getUnreadCount(): Promise<number> {
  return (await getHistory()).filter(item => !item.read).length;
}
