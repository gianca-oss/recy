import { fetchRecordings } from './api';
import { getAllRecordings, updateRecording } from '../stores/recordingStore';

interface ServerRecording {
  id: string;
  title: string;
  recordedAt: string;
  durationSeconds: number;
}

export async function reconcileServerIds(): Promise<number> {
  let server: ServerRecording[];
  try {
    server = await fetchRecordings();
  } catch (err) {
    console.warn('[sync] fetchRecordings failed, skipping reconcile:', err);
    return 0;
  }

  const local = await getAllRecordings();
  const candidates = local.filter((r) => !r.serverId && r.syncState !== 'local_only');
  if (candidates.length === 0) return 0;

  let matched = 0;
  for (const rec of candidates) {
    const match = server.find(
      (s) =>
        s.title === rec.title &&
        Math.abs(new Date(s.recordedAt).getTime() - new Date(rec.recordedAt).getTime()) < 5000
    );
    if (match) {
      await updateRecording(rec.id, { serverId: match.id });
      matched += 1;
    }
  }
  return matched;
}
