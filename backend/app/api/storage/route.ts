import { getBucketUsage } from "@/lib/s3";

export async function GET() {
  try {
    const usage = await getBucketUsage();
    return Response.json(usage);
  } catch (err) {
    console.error("GET /api/storage error:", err);
    return Response.json({ error: "Failed to read bucket usage" }, { status: 500 });
  }
}
