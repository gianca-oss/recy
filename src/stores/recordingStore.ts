import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Recording, Bookmark } from '../types';

const RECORDINGS_KEY = '@recordings';

export async function getAllRecordings(): Promise<Recording[]> {
  const raw = await AsyncStorage.getItem(RECORDINGS_KEY);
  if (!raw) return [];
  const recordings: Recording[] = JSON.parse(raw);
  return recordings.sort(
    (a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime()
  );
}

export async function saveRecording(recording: Recording): Promise<void> {
  const recordings = await getAllRecordings();
  const idx = recordings.findIndex((r) => r.id === recording.id);
  if (idx >= 0) {
    recordings[idx] = { ...recording, updatedAt: new Date().toISOString() };
  } else {
    recordings.push(recording);
  }
  await AsyncStorage.setItem(RECORDINGS_KEY, JSON.stringify(recordings));
}

export async function deleteRecording(id: string): Promise<void> {
  const recordings = await getAllRecordings();
  const filtered = recordings.filter((r) => r.id !== id);
  await AsyncStorage.setItem(RECORDINGS_KEY, JSON.stringify(filtered));
}

export async function updateRecording(
  id: string,
  updates: Partial<Recording>
): Promise<Recording | null> {
  const recordings = await getAllRecordings();
  const idx = recordings.findIndex((r) => r.id === id);
  if (idx < 0) return null;
  recordings[idx] = { ...recordings[idx], ...updates, updatedAt: new Date().toISOString() };
  await AsyncStorage.setItem(RECORDINGS_KEY, JSON.stringify(recordings));
  return recordings[idx];
}

export function createRecordingFromSession(params: {
  title: string;
  subject: string | null;
  audioUri: string;
  durationSeconds: number;
  bookmarks: Bookmark[];
  recordedAt: string;
}): Recording {
  const now = new Date().toISOString();
  return {
    id: `rec_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    title: params.title,
    subject: params.subject,
    recordedAt: params.recordedAt,
    durationSeconds: params.durationSeconds,
    audioUri: params.audioUri,
    source: 'recording',
    bookmarks: params.bookmarks,
    status: 'recorded',
    syncState: 'local_only',
    createdAt: now,
    updatedAt: now,
  };
}
