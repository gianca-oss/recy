import { fetchRecordings } from './api';
import { getAllRecordings, updateRecording } from '../stores/recordingStore';
import type { Recording, RecordingStatus, SyncState } from '../types';

interface ServerRecording {
  id: string;
  title: string;
  recordedAt: string;
  durationSeconds: number;
  status?: RecordingStatus;
  syncState?: SyncState;
}

/**
 * Pull server list, backfill serverId on local records that don't have one,
 * and patch status/syncState for everything we have a server match for.
 * Returns number of records updated.
 */
export async function syncAllFromServer(): Promise<number> {
  let server: ServerRecording[];
  try {
    server = await fetchRecordings();
  } catch (err) {
    console.warn('[sync] fetchRecordings failed:', err);
    return 0;
  }

  const local = await getAllRecordings();
  let touched = 0;

  for (const rec of local) {
    if (rec.syncState === 'local_only') continue;

    let match: ServerRecording | undefined = rec.serverId
      ? server.find((s) => s.id === rec.serverId)
      : undefined;
    if (!match) {
      match = server.find(
        (s) =>
          s.title === rec.title &&
          Math.abs(new Date(s.recordedAt).getTime() - new Date(rec.recordedAt).getTime()) < 5000
      );
    }
    if (!match) continue;

    const patch: Partial<Recording> = {};
    if (!rec.serverId) patch.serverId = match.id;
    if (match.status && match.status !== rec.status) patch.status = match.status;
    if (match.syncState && match.syncState !== rec.syncState) patch.syncState = match.syncState;

    if (Object.keys(patch).length > 0) {
      await updateRecording(rec.id, patch);
      touched += 1;
    }
  }
  return touched;
}

// Backward-compatible alias
export const reconcileServerIds = syncAllFromServer;
