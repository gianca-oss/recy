import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getDownloadPresignedUrl, getObjectMetadata } from "@/lib/s3";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const recording = await prisma.recording.findUnique({
      where: { id },
      select: { audioUrl: true },
    });

    if (!recording) {
      return Response.json({ error: "Recording not found" }, { status: 404 });
    }
    if (!recording.audioUrl) {
      return Response.json({ error: "No audio file associated" }, { status: 404 });
    }

    const [url, metadata] = await Promise.all([
      getDownloadPresignedUrl(recording.audioUrl),
      getObjectMetadata(recording.audioUrl),
    ]);

    return Response.json({
      key: recording.audioUrl,
      url,
      ...metadata,
    });
  } catch (err) {
    console.error("GET /api/recordings/[id]/audio error:", err);
    return Response.json({ error: "Failed to fetch audio info" }, { status: 500 });
  }
}
