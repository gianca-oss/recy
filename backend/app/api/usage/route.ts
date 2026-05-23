import { prisma } from "@/lib/prisma";
import { getBucketUsage } from "@/lib/s3";

export async function GET() {
  try {
    const [recordingsCount, bucket] = await Promise.all([
      prisma.recording.count(),
      getBucketUsage(),
    ]);

    return Response.json({
      recordings: { count: recordingsCount },
      storage: {
        files: bucket.count,
        bytes: bucket.totalBytes,
      },
    });
  } catch (err) {
    console.error("GET /api/usage error:", err);
    return Response.json({ error: "Failed to fetch usage" }, { status: 500 });
  }
}
