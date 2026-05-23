import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const recordings = await prisma.recording.findMany({
      orderBy: { recordedAt: "desc" },
      select: {
        id: true,
        title: true,
        subject: true,
        recordedAt: true,
        source: true,
        durationSeconds: true,
        status: true,
        syncState: true,
        bookmarks: true,
        transcriptionStartedAt: true,
        summarizationStartedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    return Response.json(recordings);
  } catch (err) {
    console.error("GET /api/recordings error:", err);
    return Response.json({ error: "Failed to fetch recordings" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const recording = await prisma.recording.create({
      data: {
        title: body.title,
        subject: body.subject || null,
        recordedAt: new Date(body.recordedAt),
        source: body.source || "recording",
        durationSeconds: body.durationSeconds,
        audioUrl: body.audioUrl || null,
        status: body.status || "recorded",
        syncState: "uploaded",
        bookmarks: body.bookmarks || [],
      },
    });

    return Response.json(recording, { status: 201 });
  } catch (err) {
    console.error("POST /api/recordings error:", err);
    return Response.json({ error: "Failed to create recording" }, { status: 500 });
  }
}
