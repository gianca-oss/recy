import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { summarizeTranscript } from "@/lib/summarize";

export const maxDuration = 300;

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const recording = await prisma.recording.findUnique({
      where: { id },
      select: {
        id: true,
        transcriptEdited: true,
        transcriptVerbatim: true,
      },
    });

    if (!recording) {
      return Response.json({ error: "Recording not found" }, { status: 404 });
    }

    const sourceText = recording.transcriptEdited || recording.transcriptVerbatim;
    if (!sourceText || sourceText.trim().length === 0) {
      return Response.json(
        { error: "Nessuna trascrizione disponibile da riassumere" },
        { status: 400 }
      );
    }

    const summary = await summarizeTranscript(sourceText);

    const updated = await prisma.recording.update({
      where: { id },
      data: {
        summary,
        syncState: "summarized",
      },
      select: { id: true, summary: true, syncState: true },
    });

    return Response.json(updated);
  } catch (err) {
    console.error("Summarize error:", err);
    const message = err instanceof Error ? err.message : "Summary failed";
    return Response.json({ error: message }, { status: 500 });
  }
}
