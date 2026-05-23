import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const lesson = await prisma.lesson.findUnique({ where: { id } });

    if (!lesson) {
      return Response.json({ error: "Lesson not found" }, { status: 404 });
    }

    return Response.json(lesson);
  } catch (err) {
    console.error("GET /api/lessons/[id] error:", err);
    return Response.json({ error: "Failed to fetch lesson" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const allowed = [
      "title", "subject", "status", "syncState", "audioUrl",
      "transcriptVerbatim", "transcriptClean", "transcriptEdited",
      "transcriptSegments", "summary", "bookmarks",
    ];
    const data: Record<string, unknown> = {};
    for (const key of allowed) {
      if (key in body) data[key] = body[key];
    }

    const lesson = await prisma.lesson.update({
      where: { id },
      data,
    });

    return Response.json(lesson);
  } catch (err) {
    console.error("PATCH /api/lessons/[id] error:", err);
    return Response.json({ error: "Failed to update lesson" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await prisma.lesson.delete({ where: { id } });
    return Response.json({ success: true });
  } catch (err) {
    console.error("DELETE /api/lessons/[id] error:", err);
    return Response.json({ error: "Failed to delete lesson" }, { status: 500 });
  }
}
