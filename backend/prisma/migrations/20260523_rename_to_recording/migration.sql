-- Rename enums
ALTER TYPE "LessonStatus" RENAME TO "RecordingStatus";
ALTER TYPE "LessonSource" RENAME TO "RecordingSource";

-- Rename table
ALTER TABLE "Lesson" RENAME TO "Recording";

-- Rename indexes
ALTER INDEX "Lesson_pkey" RENAME TO "Recording_pkey";
ALTER INDEX "Lesson_userId_idx" RENAME TO "Recording_userId_idx";
ALTER INDEX "Lesson_recordedAt_idx" RENAME TO "Recording_recordedAt_idx";
