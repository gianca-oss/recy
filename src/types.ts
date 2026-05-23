export interface Bookmark {
  id: string;
  timestamp: number;
  createdAt: string;
}

export interface TranscriptSegment {
  text: string;
  start: number;
  end: number;
  type?: string;
}

export type RecordingSource = 'recording' | 'import';
export type RecordingStatus = 'recorded' | 'transcribing' | 'transcribed' | 'failed';
export type SyncState = 'local_only' | 'uploaded' | 'transcribed' | 'summarized';

export interface Recording {
  id: string;
  serverId?: string | null;
  title: string;
  subject: string | null;
  recordedAt: string;
  durationSeconds: number;
  audioUri: string;
  source: RecordingSource;
  bookmarks: Bookmark[];
  status: RecordingStatus;
  syncState: SyncState;
  transcript?: string | null;
  transcriptEdited?: string | null;
  transcriptSegments?: TranscriptSegment[] | null;
  transcriptFetchedAt?: string | null;
  summary?: string | null;
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
