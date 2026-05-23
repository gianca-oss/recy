import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { summarizeTranscript } from "@/lib/summarize";

export const maxDuration = 800;

async function runSummary(id: string, sourceText: string) {
  try {
    const summary = await summarizeTranscript(sourceText);
    await prisma.recording.update({
      where: { id },
      data: {
        summary,
        syncState: "summarized",
        summarizationStartedAt: null,
      },
    });
    console.log(`[summary] ${id} completed (${summary.length} chars)`);
  } catch (err) {
    console.error(`[summary] ${id} failed:`, err);
    await prisma.recording
      .update({ where: { id }, data: { summarizationStartedAt: null } })
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
    select: {
      id: true,
      transcriptEdited: true,
      transcriptVerbatim: true,
      summarizationStartedAt: true,
    },
  });

  if (!recording) {
    return Response.json({ error: "Recording not found" }, { status: 404 });
  }

  if (recording.summarizationStartedAt) {
    return Response.json(
      { status: "summarizing", message: "Already in progress" },
      { status: 202 }
    );
  }

  const sourceText = recording.transcriptEdited || recording.transcriptVerbatim;
  if (!sourceText || sourceText.trim().length === 0) {
    return Response.json(
      { error: "Nessuna trascrizione disponibile da riassumere" },
      { status: 400 }
    );
  }

  await prisma.recording.update({
    where: { id },
    data: { summarizationStartedAt: new Date() },
  });

  void runSummary(id, sourceText);

  return Response.json({ status: "summarizing" }, { status: 202 });
}
