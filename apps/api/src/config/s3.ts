/**
 * S3-COMPATIBLE STORAGE CLIENT (MinIO / AWS S3 / Cloudflare R2 / DO Spaces)
 * Everything goes through here — product images, digital downloads, PDF invoices, CSVs.
 */
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  HeadObjectCommand,
  type HeadObjectCommandOutput,
  CreateBucketCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl as s3GetSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Readable } from "node:stream";
import { env } from "./env";

export const s3 = new S3Client({
  region: env.S3_REGION,
  endpoint: env.S3_ENDPOINT,
  forcePathStyle: env.S3_FORCE_PATH_STYLE === "true",
  credentials: {
    accessKeyId: env.S3_ACCESS_KEY,
    secretAccessKey: env.S3_SECRET_KEY,
  },
});

export async function ensureBucket(): Promise<void> {
  try {
    await s3.send(
      new CreateBucketCommand({
        Bucket: env.S3_BUCKET,
        ACL: env.STORAGE_DRIVER === "local" ? undefined : "public-read",
      }),
    );
  } catch (err) {
    // BucketAlreadyOwnedByYou / BucketAlreadyExists → ignore silently
    const code = (err as { name?: string; Code?: string }).name;
    if (code && code.includes("Bucket")) return;
    throw err;
  }
}

export async function uploadFile(args: {
  key: string;
  body: Buffer | Uint8Array | Readable | string;
  contentType?: string;
  acl?: "public-read" | "private";
  metadata?: Record<string, string>;
}): Promise<{ key: string; url: string; size: number; etag?: string }> {
  const res = await s3.send(
    new PutObjectCommand({
      Bucket: env.S3_BUCKET,
      Key: args.key,
      Body: args.body as never,
      ContentType: args.contentType,
      ACL: args.acl ?? "private",
      Metadata: args.metadata,
    }),
  );
  return {
    key: args.key,
    url: `${env.S3_PUBLIC_URL.replace(/\/$/, "")}/${args.key}`,
    size: 0,
    etag: res.ETag,
  };
}

export async function deleteFile(key: string): Promise<void> {
  await s3.send(new DeleteObjectCommand({ Bucket: env.S3_BUCKET, Key: key }));
}

export async function deleteMany(keys: string[]): Promise<number> {
  if (!keys.length) return 0;
  const batches: string[][] = [];
  for (let i = 0; i < keys.length; i += 1000) batches.push(keys.slice(i, i + 1000));
  let total = 0;
  for (const batch of batches) {
    const res = await s3.send(
      new DeleteObjectsCommand({
        Bucket: env.S3_BUCKET,
        Delete: { Objects: batch.map((Key) => ({ Key })) },
      }),
    );
    total += res.Deleted?.length ?? 0;
  }
  return total;
}

export async function headFile(key: string): Promise<HeadObjectCommandOutput | null> {
  try {
    return await s3.send(new HeadObjectCommand({ Bucket: env.S3_BUCKET, Key: key }));
  } catch {
    return null;
  }
}

export function publicUrl(key: string): string {
  return `${env.S3_PUBLIC_URL.replace(/\/$/, "")}/${key}`;
}

export async function presignedDownloadUrl(key: string, expiresIn = 600): Promise<string> {
  return s3GetSignedUrl(
    s3,
    new GetObjectCommand({ Bucket: env.S3_BUCKET, Key: key }),
    { expiresIn },
  );
}
