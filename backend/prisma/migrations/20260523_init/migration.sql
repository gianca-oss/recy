-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "LessonStatus" AS ENUM ('recorded', 'transcribing', 'transcribed', 'failed');

-- CreateEnum
CREATE TYPE "SyncState" AS ENUM ('local_only', 'uploaded', 'transcribed', 'summarized');

-- CreateEnum
CREATE TYPE "LessonSource" AS ENUM ('recording', 'import');

-- CreateTable
CREATE TABLE "Lesson" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "title" TEXT NOT NULL,
    "subject" TEXT,
    "recordedAt" TIMESTAMP(3) NOT NULL,
    "source" "LessonSource" NOT NULL DEFAULT 'recording',
    "durationSeconds" INTEGER NOT NULL,
    "audioUrl" TEXT,
    "status" "LessonStatus" NOT NULL DEFAULT 'recorded',
    "syncState" "SyncState" NOT NULL DEFAULT 'uploaded',
    "bookmarks" JSONB NOT NULL DEFAULT '[]',
    "transcriptVerbatim" TEXT,
    "transcriptClean" TEXT,
    "transcriptEdited" TEXT,
    "transcriptSegments" JSONB,
    "summary" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lesson_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Lesson_userId_idx" ON "Lesson"("userId");

-- CreateIndex
CREATE INDEX "Lesson_recordedAt_idx" ON "Lesson"("recordedAt");
