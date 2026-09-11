import Constants from 'expo-constants';

// A separate backend from src/api/client.ts (apps/api) - this is the attendance
// Worker, which records check-ins locally and needs no sign-in at all.
const BASE_URL: string =
  (Constants.expoConfig?.extra?.attendanceBaseUrl as string | undefined) ?? '';

export type AttendanceStatus = {
  configured: boolean;
  canCheckIn?: boolean;
  eventName?: string;
  eventDate?: string;
  ageRange?: string;
  message?: string;
};

export type SearchResult = { id: string; name: string; phoneHint: string; emailHint: string };

export type SearchResponse = { success: boolean; results: SearchResult[]; message?: string };

export type CheckInOutcome = {
  success: boolean;
  personId?: string;
  personName?: string;
  eventName?: string;
  alreadyCheckedIn?: boolean;
  message?: string;
};

export type RegisterDetails = {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  /** YYYY-MM-DD, optional. */
  birthdate: string;
};

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, { headers: { Accept: 'application/json' } });
  return response.json() as Promise<T>;
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body),
  });
  return response.json() as Promise<T>;
}

export const attendanceApi = {
  status: () => getJson<AttendanceStatus>('/api/status'),
  search: (query: string) => getJson<SearchResponse>(`/api/search?query=${encodeURIComponent(query)}`),
  checkIn: (personId: string) => postJson<CheckInOutcome>('/api/checkin', { personId }),
  register: (details: RegisterDetails) => postJson<CheckInOutcome>('/api/register', details),
};
