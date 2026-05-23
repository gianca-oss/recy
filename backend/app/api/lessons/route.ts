import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const lessons = await prisma.lesson.findMany({
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
        createdAt: true,
        updatedAt: true,
      },
    });
    return Response.json(lessons);
  } catch (err) {
    console.error("GET /api/lessons error:", err);
    return Response.json({ error: "Failed to fetch lessons" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const lesson = await prisma.lesson.create({
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

    return Response.json(lesson, { status: 201 });
  } catch (err) {
    console.error("POST /api/lessons error:", err);
    return Response.json({ error: "Failed to create lesson" }, { status: 500 });
  }
}
