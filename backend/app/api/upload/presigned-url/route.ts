import { NextRequest } from "next/server";
import { getUploadPresignedUrl } from "@/lib/s3";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { filename, contentType } = body;

    if (!filename || !contentType) {
      return Response.json(
        { error: "filename and contentType are required" },
        { status: 400 }
      );
    }

    const timestamp = Date.now();
    const sanitized = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
    const key = `audio/${timestamp}_${sanitized}`;

    const url = await getUploadPresignedUrl(key, contentType);

    return Response.json({ url, key });
  } catch (err) {
    console.error("Presigned URL error:", err);
    console.error("S3 env check:", {
      endpoint: !!process.env.S3_ENDPOINT,
      bucket: !!process.env.S3_BUCKET,
      accessKey: !!process.env.S3_ACCESS_KEY,
      secretKey: !!process.env.S3_SECRET_KEY,
      region: process.env.S3_REGION,
    });
    return Response.json(
      { error: "Failed to generate upload URL" },
      { status: 500 }
    );
  }
}
