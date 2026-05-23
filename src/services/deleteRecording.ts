import { deleteRecording as deleteOnServer } from './api';
import { deleteRecording as deleteLocal } from '../stores/recordingStore';
import { removeFromQueue } from './uploadQueue';
import type { Recording } from '../types';

export async function deleteRecordingFully(recording: Recording): Promise<void> {
  if (recording.serverId) {
    try {
      await deleteOnServer(recording.serverId);
    } catch (err) {
      console.warn('Server delete failed, removing locally anyway:', err);
    }
  }
  await removeFromQueue(recording.id);
  await deleteLocal(recording.id);
}
