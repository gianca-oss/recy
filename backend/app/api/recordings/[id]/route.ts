import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const recording = await prisma.recording.findUnique({ where: { id } });

    if (!recording) {
      return Response.json({ error: "Recording not found" }, { status: 404 });
    }

    return Response.json(recording);
  } catch (err) {
    console.error("GET /api/recordings/[id] error:", err);
    return Response.json({ error: "Failed to fetch recording" }, { status: 500 });
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

    const recording = await prisma.recording.update({
      where: { id },
      data,
    });

    return Response.json(recording);
  } catch (err) {
    console.error("PATCH /api/recordings/[id] error:", err);
    return Response.json({ error: "Failed to update recording" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await prisma.recording.delete({ where: { id } });
    return Response.json({ success: true });
  } catch (err) {
    console.error("DELETE /api/recordings/[id] error:", err);
    return Response.json({ error: "Failed to delete recording" }, { status: 500 });
  }
}
