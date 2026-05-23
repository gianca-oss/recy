import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import { getPresignedUploadUrl, createRecording } from './api';
import { updateRecording as updateLocalRecording, getAllRecordings } from '../stores/recordingStore';
import type { Recording } from '../types';
import { AppState } from 'react-native';

const QUEUE_KEY = '@upload_queue';
const MAX_RETRIES = 10;
const BACKOFF_BASE = 2000;

interface QueueItem {
  recordingId: string;
  audioUri: string;
  retries: number;
  lastAttempt: string | null;
}

let processing = false;
let pendingRerun = false;

type Listener = () => void;
const listeners = new Set<Listener>();

export function subscribeToUploadQueue(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function notify() {
  listeners.forEach((l) => l());
}

export async function removeFromQueue(recordingId: string): Promise<void> {
  const queue = await getQueue();
  const filtered = queue.filter((q) => q.recordingId !== recordingId);
  if (filtered.length !== queue.length) {
    await saveQueue(filtered);
  }
}

export async function enqueueUpload(recording: Recording): Promise<void> {
  const queue = await getQueue();
  const exists = queue.find((q) => q.recordingId === recording.id);
  if (exists) return;

  queue.push({
    recordingId: recording.id,
    audioUri: recording.audioUri,
    retries: 0,
    lastAttempt: null,
  });
  await saveQueue(queue);
  processQueue();
}

export async function processQueue(): Promise<void> {
  if (processing) {
    pendingRerun = true;
    return;
  }
  processing = true;

  try {
    const queue = await getQueue();
    const remaining: QueueItem[] = [];

    for (const item of queue) {
      if (item.retries >= MAX_RETRIES) {
        await updateLocalRecording(item.recordingId, { syncState: 'local_only' });
        continue;
      }

      try {
        await processItem(item);
      } catch (err) {
        console.log(`Upload failed for ${item.recordingId}, retry ${item.retries + 1}:`, err);
        remaining.push({
          ...item,
          retries: item.retries + 1,
          lastAttempt: new Date().toISOString(),
        });
      }
    }

    const processedIds = new Set(queue.map((i) => i.recordingId));
    const queueNow = await getQueue();
    const newlyAdded = queueNow.filter((i) => !processedIds.has(i.recordingId));
    const finalQueue = [...remaining, ...newlyAdded];
    await saveQueue(finalQueue);

    if (newlyAdded.length > 0) pendingRerun = true;

    if (remaining.length > 0) {
      const delay = Math.min(
        BACKOFF_BASE * Math.pow(2, remaining[0].retries - 1),
        60000
      );
      setTimeout(() => processQueue(), delay);
    }
  } finally {
    processing = false;
    if (pendingRerun) {
      pendingRerun = false;
      processQueue();
    }
  }
}

async function processItem(item: QueueItem): Promise<void> {
  const filename = item.audioUri.split('/').pop() || 'recording.m4a';
  const contentType = 'audio/mp4';

  const { url, key } = await getPresignedUploadUrl(filename, contentType);

  const uploadResult = await FileSystem.uploadAsync(url, item.audioUri, {
    httpMethod: 'PUT',
    headers: { 'Content-Type': contentType },
  });

  if (uploadResult.status < 200 || uploadResult.status >= 300) {
    throw new Error(`S3 upload failed: ${uploadResult.status}`);
  }

  const recordings = await getAllRecordings();
  const local = recordings.find((r) => r.id === item.recordingId);
  if (!local) return;

  const serverRecording = await createRecording({
    title: local.title,
    subject: local.subject,
    recordedAt: local.recordedAt,
    durationSeconds: local.durationSeconds,
    audioUrl: key,
    source: local.source,
    bookmarks: local.bookmarks,
    status: 'recorded',
  });

  await updateLocalRecording(item.recordingId, {
    syncState: 'uploaded',
    serverId: serverRecording.id,
  });
  notify();
}

async function getQueue(): Promise<QueueItem[]> {
  const raw = await AsyncStorage.getItem(QUEUE_KEY);
  return raw ? JSON.parse(raw) : [];
}

async function saveQueue(queue: QueueItem[]): Promise<void> {
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

AppState.addEventListener('change', (state) => {
  if (state === 'active') processQueue();
});
