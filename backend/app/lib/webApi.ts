'use client';

async function apiFetch(path: string, options?: RequestInit) {
  const res = await fetch(path, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
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

export async function getPresignedUploadUrl(filename: string, contentType: string) {
  const r = await apiFetch('/api/upload/presigned-url', {
    method: 'POST',
    body: JSON.stringify({ filename, contentType }),
  });
  if (!r.ok) throw new Error(`${r.status}`);
  return r.json() as Promise<{ url: string; key: string }>;
}

export async function createRecording(data: {
  title: string;
  recordedAt: string;
  durationSeconds: number;
  audioUrl: string | null;
  source: 'recording' | 'import';
  bookmarks?: unknown[];
}) {
  const r = await apiFetch('/api/recordings', {
    method: 'POST',
    body: JSON.stringify({ ...data, bookmarks: data.bookmarks ?? [] }),
  });
  if (!r.ok) throw new Error(`${r.status}`);
  return r.json() as Promise<{ id: string }>;
}
