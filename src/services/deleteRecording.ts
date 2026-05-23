import * as FileSystem from 'expo-file-system/legacy';
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
  if (recording.offlineAudioPath) {
    try {
      await FileSystem.deleteAsync(recording.offlineAudioPath, { idempotent: true });
    } catch (err) {
      console.log('Offline file delete failed (continuing):', err);
    }
  }
  await removeFromQueue(recording.id);
  await deleteLocal(recording.id);
}
