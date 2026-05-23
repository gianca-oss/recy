import { S3Client, PutObjectCommand, GetObjectCommand, HeadObjectCommand, DeleteObjectCommand, ListObjectsV2Command, PutBucketCorsCommand, GetBucketCorsCommand } from "@aws-sdk/client-s3";
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

export async function getBucketUsage() {
  let totalBytes = 0;
  let count = 0;
  let ContinuationToken: string | undefined;
  do {
    const res = await getS3().send(
      new ListObjectsV2Command({ Bucket: getBucket(), ContinuationToken })
    );
    for (const obj of res.Contents ?? []) {
      totalBytes += obj.Size ?? 0;
      count += 1;
    }
    ContinuationToken = res.IsTruncated ? res.NextContinuationToken : undefined;
  } while (ContinuationToken);
  return { totalBytes, count };
}

export async function configureCors() {
  const command = new PutBucketCorsCommand({
    Bucket: getBucket(),
    CORSConfiguration: {
      CORSRules: [
        {
          AllowedMethods: ["GET", "PUT", "HEAD"],
          AllowedOrigins: ["*"],
          AllowedHeaders: ["*"],
          ExposeHeaders: ["ETag"],
          MaxAgeSeconds: 3000,
        },
      ],
    },
  });
  await getS3().send(command);
}

export async function getCors() {
  try {
    const res = await getS3().send(new GetBucketCorsCommand({ Bucket: getBucket() }));
    return res.CORSRules ?? [];
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

export async function deleteObject(key: string) {
  const command = new DeleteObjectCommand({
    Bucket: getBucket(),
    Key: key,
  });
  await getS3().send(command);
}

export async function getObjectMetadata(key: string) {
  const command = new HeadObjectCommand({
    Bucket: getBucket(),
    Key: key,
  });
  const res = await getS3().send(command);
  return {
    size: res.ContentLength ?? null,
    contentType: res.ContentType ?? null,
    lastModified: res.LastModified?.toISOString() ?? null,
  };
}
