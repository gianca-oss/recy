import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Lesson, Bookmark } from '../types';

const LESSONS_KEY = '@lessons';

export async function getAllLessons(): Promise<Lesson[]> {
  const raw = await AsyncStorage.getItem(LESSONS_KEY);
  if (!raw) return [];
  const lessons: Lesson[] = JSON.parse(raw);
  return lessons.sort(
    (a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime()
  );
}

export async function saveLesson(lesson: Lesson): Promise<void> {
  const lessons = await getAllLessons();
  const idx = lessons.findIndex((l) => l.id === lesson.id);
  if (idx >= 0) {
    lessons[idx] = { ...lesson, updatedAt: new Date().toISOString() };
  } else {
    lessons.push(lesson);
  }
  await AsyncStorage.setItem(LESSONS_KEY, JSON.stringify(lessons));
}

export async function deleteLesson(id: string): Promise<void> {
  const lessons = await getAllLessons();
  const filtered = lessons.filter((l) => l.id !== id);
  await AsyncStorage.setItem(LESSONS_KEY, JSON.stringify(filtered));
}

export async function updateLesson(
  id: string,
  updates: Partial<Lesson>
): Promise<Lesson | null> {
  const lessons = await getAllLessons();
  const idx = lessons.findIndex((l) => l.id === id);
  if (idx < 0) return null;
  lessons[idx] = { ...lessons[idx], ...updates, updatedAt: new Date().toISOString() };
  await AsyncStorage.setItem(LESSONS_KEY, JSON.stringify(lessons));
  return lessons[idx];
}

export function createLessonFromRecording(params: {
  title: string;
  subject: string | null;
  audioUri: string;
  durationSeconds: number;
  bookmarks: Bookmark[];
  recordedAt: string;
}): Lesson {
  const now = new Date().toISOString();
  return {
    id: `lesson_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
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
