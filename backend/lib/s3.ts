import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const s3 = new S3Client({
  endpoint: process.env.S3_ENDPOINT!,
  region: process.env.S3_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY!,
    secretAccessKey: process.env.S3_SECRET_KEY!,
  },
  forcePathStyle: false,
});

const BUCKET = process.env.S3_BUCKET!;

export async function getUploadPresignedUrl(key: string, contentType: string) {
  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    ContentType: contentType,
  });
  const url = await getSignedUrl(s3, command, { expiresIn: 3600 });
  return url;
}

export async function getDownloadPresignedUrl(key: string) {
  const command = new GetObjectCommand({
    Bucket: BUCKET,
    Key: key,
  });
  const url = await getSignedUrl(s3, command, { expiresIn: 3600 });
  return url;
}
