import AsyncStorage from '@react-native-async-storage/async-storage';
import type { RecordingSessionState, Bookmark } from '../types';

const SESSION_KEY = '@recording_session';

function generateTitle(): string {
  const now = new Date();
  const day = now.getDate();
  const months = [
    'gen', 'feb', 'mar', 'apr', 'mag', 'giu',
    'lug', 'ago', 'set', 'ott', 'nov', 'dic',
  ];
  const month = months[now.getMonth()];
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  return `Lezione ${day} ${month}, ${hours}:${minutes}`;
}

export function createNewSession(): RecordingSessionState {
  return {
    id: `session_${Date.now()}`,
    audioUri: null,
    startedAt: new Date().toISOString(),
    elapsedSeconds: 0,
    isPaused: false,
    bookmarks: [],
    provisionalTitle: generateTitle(),
    subject: null,
    isActive: true,
  };
}

export async function persistSession(
  session: RecordingSessionState
): Promise<void> {
  await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export async function loadDanglingSession(): Promise<RecordingSessionState | null> {
  const raw = await AsyncStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  const session: RecordingSessionState = JSON.parse(raw);
  if (session.isActive) return session;
  return null;
}

export async function clearSession(): Promise<void> {
  await AsyncStorage.removeItem(SESSION_KEY);
}

export function addBookmarkToSession(
  session: RecordingSessionState,
  elapsedSeconds: number
): RecordingSessionState {
  const bookmark: Bookmark = {
    id: `bm_${Date.now()}`,
    timestamp: elapsedSeconds,
    createdAt: new Date().toISOString(),
  };
  return {
    ...session,
    bookmarks: [...session.bookmarks, bookmark],
  };
}
