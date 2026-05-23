import AsyncStorage from '@react-native-async-storage/async-storage';

const API_URL_KEY = '@api_base_url';
const DEFAULT_API_URL = 'https://recy.up.railway.app';

let cachedBaseUrl: string | null = null;

export async function getApiBaseUrl(): Promise<string> {
  if (cachedBaseUrl) return cachedBaseUrl;
  const stored = await AsyncStorage.getItem(API_URL_KEY);
  cachedBaseUrl = stored || DEFAULT_API_URL;
  return cachedBaseUrl;
}

export async function setApiBaseUrl(url: string): Promise<void> {
  cachedBaseUrl = url;
  await AsyncStorage.setItem(API_URL_KEY, url);
}

async function apiFetch(path: string, options?: RequestInit) {
  const base = await getApiBaseUrl();
  const res = await fetch(`${base}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });
  return res;
}

export async function getPresignedUploadUrl(filename: string, contentType: string) {
  const res = await apiFetch('/api/upload/presigned-url', {
    method: 'POST',
    body: JSON.stringify({ filename, contentType }),
  });
  if (!res.ok) throw new Error(`Upload URL failed: ${res.status}`);
  return res.json() as Promise<{ url: string; key: string }>;
}

export async function createRecording(data: {
  title: string;
  subject: string | null;
  recordedAt: string;
  durationSeconds: number;
  audioUrl: string | null;
  source: 'recording' | 'import';
  bookmarks: unknown[];
  status?: string;
}) {
  const res = await apiFetch('/api/recordings', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Create recording failed: ${res.status}`);
  return res.json();
}

export async function fetchRecordings() {
  const res = await apiFetch('/api/recordings');
  if (!res.ok) throw new Error(`Fetch recordings failed: ${res.status}`);
  return res.json();
}

export async function updateRecording(id: string, data: Record<string, unknown>) {
  const res = await apiFetch(`/api/recordings/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Update recording failed: ${res.status}`);
  return res.json();
}

export async function deleteRecording(id: string) {
  const res = await apiFetch(`/api/recordings/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error(`Delete recording failed: ${res.status}`);
  return res.json();
}
