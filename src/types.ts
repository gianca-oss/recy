export interface Bookmark {
  id: string;
  timestamp: number;
  createdAt: string;
}

export type LessonSource = 'recording' | 'import';
export type LessonStatus = 'recorded' | 'transcribing' | 'transcribed' | 'failed';
export type SyncState = 'local_only' | 'uploaded' | 'transcribed' | 'summarized';

export interface Lesson {
  id: string;
  title: string;
  subject: string | null;
  recordedAt: string;
  durationSeconds: number;
  audioUri: string;
  source: LessonSource;
  bookmarks: Bookmark[];
  status: LessonStatus;
  syncState: SyncState;
  createdAt: string;
  updatedAt: string;
}

export interface RecordingSessionState {
  id: string;
  audioUri: string | null;
  startedAt: string;
  elapsedSeconds: number;
  isPaused: boolean;
  bookmarks: Bookmark[];
  provisionalTitle: string;
  subject: string | null;
  isActive: boolean;
}

export const SyncMeta: Record<SyncState, { label: string; iconName: string }> = {
  local_only: { label: 'Sul dispositivo', iconName: 'phone-portrait-outline' },
  uploaded: { label: 'Caricata', iconName: 'cloud-outline' },
  transcribed: { label: 'Trascritta', iconName: 'checkmark-circle-outline' },
  summarized: { label: 'Con riassunto', iconName: 'sparkles-outline' },
};
