import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getDownloadPresignedUrl } from "@/lib/s3";
import { transcribeAudio } from "@/lib/transcribe";

export const maxDuration = 300;

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  let recording;
  try {
    recording = await prisma.recording.findUnique({
      where: { id },
      select: { id: true, audioUrl: true, status: true },
    });

    if (!recording) {
      return Response.json({ error: "Recording not found" }, { status: 404 });
    }
    if (!recording.audioUrl) {
      return Response.json({ error: "No audio file" }, { status: 400 });
    }

    await prisma.recording.update({
      where: { id },
      data: { status: "transcribing" },
    });

    const downloadUrl = await getDownloadPresignedUrl(recording.audioUrl);
    const result = await transcribeAudio(downloadUrl);

    const updated = await prisma.recording.update({
      where: { id },
      data: {
        status: "transcribed",
        syncState: "transcribed",
        transcriptVerbatim: result.text,
        transcriptSegments: result.words as unknown as object,
      },
      select: {
        id: true,
        status: true,
        syncState: true,
        transcriptVerbatim: true,
      },
    });

    return Response.json(updated);
  } catch (err) {
    console.error("Transcribe error:", err);
    if (recording) {
      await prisma.recording
        .update({ where: { id }, data: { status: "failed" } })
        .catch(() => {});
    }
    const message = err instanceof Error ? err.message : "Transcription failed";
    return Response.json({ error: message }, { status: 500 });
  }
}
