'use client';

const KEY_STORAGE = 'recy_api_key';

export function getApiKey(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(KEY_STORAGE);
}

export function setApiKey(value: string) {
  window.localStorage.setItem(KEY_STORAGE, value);
}

export function clearApiKey() {
  window.localStorage.removeItem(KEY_STORAGE);
}

async function apiFetch(path: string, options?: RequestInit) {
  const apiKey = getApiKey();
  const res = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(apiKey ? { 'x-api-key': apiKey } : {}),
      ...options?.headers,
    },
  });
  return res;
}

export interface ApiRecording {
  id: string;
  title: string;
  subject: string | null;
  recordedAt: string;
  source: 'recording' | 'import';
  durationSeconds: number;
  status: 'recorded' | 'transcribing' | 'transcribed' | 'failed';
  syncState: 'local_only' | 'uploaded' | 'transcribed' | 'summarized';
  transcriptionStartedAt?: string | null;
  summarizationStartedAt?: string | null;
}

export interface ApiRecordingFull extends ApiRecording {
  audioUrl: string | null;
  transcriptVerbatim: string | null;
  transcriptEdited: string | null;
  transcriptSegments: { text: string; start: number; end: number }[] | null;
  summary: string | null;
}

export async function listRecordings(): Promise<ApiRecording[]> {
  const r = await apiFetch('/api/recordings');
  if (!r.ok) throw new Error(`${r.status}`);
  return r.json();
}

export async function getRecording(id: string): Promise<ApiRecordingFull> {
  const r = await apiFetch(`/api/recordings/${id}`);
  if (!r.ok) throw new Error(`${r.status}`);
  return r.json();
}

export async function getRecordingAudio(id: string) {
  const r = await apiFetch(`/api/recordings/${id}/audio`);
  if (!r.ok) throw new Error(`${r.status}`);
  return r.json() as Promise<{ url: string; size: number | null; contentType: string | null }>;
}

export async function transcribeRecording(id: string) {
  const r = await apiFetch(`/api/recordings/${id}/transcribe`, { method: 'POST' });
  if (!r.ok) throw new Error(`${r.status}`);
  return r.json();
}

export async function summarizeRecording(id: string) {
  const r = await apiFetch(`/api/recordings/${id}/summarize`, { method: 'POST' });
  if (!r.ok) throw new Error(`${r.status}`);
  return r.json();
}

export async function updateRecording(id: string, data: Record<string, unknown>) {
  const r = await apiFetch(`/api/recordings/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
  if (!r.ok) throw new Error(`${r.status}`);
  return r.json();
}

export async function deleteRecording(id: string) {
  const r = await apiFetch(`/api/recordings/${id}`, { method: 'DELETE' });
  if (!r.ok) throw new Error(`${r.status}`);
  return r.json();
}

export async function ping(): Promise<boolean> {
  try {
    const r = await apiFetch('/api/recordings');
    return r.ok;
  } catch {
    return false;
  }
}
