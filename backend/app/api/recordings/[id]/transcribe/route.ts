import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getDownloadPresignedUrl } from "@/lib/s3";
import { transcribeAudio } from "@/lib/transcribe";

export const maxDuration = 800;

async function runTranscription(id: string, audioUrl: string) {
  try {
    const downloadUrl = await getDownloadPresignedUrl(audioUrl);
    const result = await transcribeAudio(downloadUrl);
    await prisma.recording.update({
      where: { id },
      data: {
        status: "transcribed",
        syncState: "transcribed",
        transcriptVerbatim: result.text,
        transcriptSegments: result.words as unknown as object,
        transcriptionStartedAt: null,
      },
    });
    console.log(`[transcribe] ${id} completed (${result.text.length} chars)`);
  } catch (err) {
    console.error(`[transcribe] ${id} failed:`, err);
    await prisma.recording
      .update({ where: { id }, data: { status: "failed" } })
      .catch(() => {});
  }
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const recording = await prisma.recording.findUnique({
    where: { id },
    select: { id: true, audioUrl: true, status: true },
  });

  if (!recording) {
    return Response.json({ error: "Recording not found" }, { status: 404 });
  }
  if (!recording.audioUrl) {
    return Response.json({ error: "No audio file" }, { status: 400 });
  }
  if (recording.status === "transcribing") {
    return Response.json(
      { status: "transcribing", message: "Already in progress" },
      { status: 202 }
    );
  }

  await prisma.recording.update({
    where: { id },
    data: { status: "transcribing", transcriptionStartedAt: new Date() },
  });

  // Fire-and-forget: job continues server-side after response.
  void runTranscription(id, recording.audioUrl);

  return Response.json({ status: "transcribing" }, { status: 202 });
}
