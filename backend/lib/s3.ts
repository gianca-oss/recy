import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

let _s3: S3Client | null = null;

function getS3() {
  if (!_s3) {
    _s3 = new S3Client({
      endpoint: process.env.S3_ENDPOINT!,
      region: process.env.S3_REGION || "us-east-1",
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY!,
        secretAccessKey: process.env.S3_SECRET_KEY!,
      },
      forcePathStyle: false,
    });
  }
  return _s3;
}

function getBucket() {
  return process.env.S3_BUCKET!;
}

export async function getUploadPresignedUrl(key: string, contentType: string) {
  const command = new PutObjectCommand({
    Bucket: getBucket(),
    Key: key,
    ContentType: contentType,
  });
  const url = await getSignedUrl(getS3(), command, { expiresIn: 3600 });
  return url;
}

export async function getDownloadPresignedUrl(key: string) {
  const command = new GetObjectCommand({
    Bucket: getBucket(),
    Key: key,
  });
  const url = await getSignedUrl(getS3(), command, { expiresIn: 3600 });
  return url;
}
