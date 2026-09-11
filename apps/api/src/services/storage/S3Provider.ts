import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectsCommand,
  ListObjectsV2Command,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Readable } from "node:stream";
import { env } from "../../config/env";
import type { StoredFile, StorageProvider } from "./types";

interface S3ProviderOverrides {
  endpoint?: string;
  region?: string;
  bucket?: string;
  accessKey?: string;
  secretKey?: string;
  forcePathStyle?: boolean;
  publicUrl?: string;
}

export class S3Provider implements StorageProvider {
  private client: S3Client;
  private bucket: string;
  private publicUrl?: string;

  constructor(overrides: S3ProviderOverrides = {}) {
    const endpoint = overrides.endpoint ?? env.S3_ENDPOINT;
    const region = overrides.region ?? env.S3_REGION;
    this.bucket = overrides.bucket ?? env.S3_BUCKET;
    const accessKey = overrides.accessKey ?? env.S3_ACCESS_KEY;
    const secretKey = overrides.secretKey ?? env.S3_SECRET_KEY;
    const forcePathStyle =
      overrides.forcePathStyle ?? env.S3_FORCE_PATH_STYLE === "true";
    this.publicUrl = overrides.publicUrl ?? env.S3_PUBLIC_URL;

    this.client = new S3Client({
      region,
      endpoint,
      forcePathStyle,
      credentials: {
        accessKeyId: accessKey,
        secretAccessKey: secretKey,
      },
    });
  }

  async put(
    key: string,
    buffer: Uint8Array | Readable,
    contentType?: string,
  ): Promise<StoredFile> {
    let body: Uint8Array | Readable;
    let size: number;

    if (buffer instanceof Uint8Array) {
      body = buffer;
      size = buffer.length;
    } else {
      const chunks: Buffer[] = [];
      for await (const chunk of buffer) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as Uint8Array));
      }
      const combined = Buffer.concat(chunks);
      body = combined;
      size = combined.length;
    }

    const res = await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
    );

    const url = this.publicUrl
      ? `${this.publicUrl.replace(/\/$/, "")}/${key}`
      : key;

    return {
      key,
      url,
      size,
      etag: res.ETag?.replace(/"/g, "") ?? "",
      bucket: this.bucket,
      mimeType: contentType,
    };
  }

  async getSignedUrlDownload(key: string, ttlSec: number = 3600): Promise<string> {
    return getSignedUrl(
      this.client,
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
      }),
      { expiresIn: ttlSec },
    );
  }

  async delete(keys: string[]): Promise<void> {
    if (keys.length === 0) return;

    const batches: string[][] = [];
    for (let i = 0; i < keys.length; i += 1000) {
      batches.push(keys.slice(i, i + 1000));
    }

    for (const batch of batches) {
      await this.client.send(
        new DeleteObjectsCommand({
          Bucket: this.bucket,
          Delete: { Objects: batch.map((Key) => ({ Key })) },
        }),
      );
    }
  }

  async list(prefix?: string): Promise<StoredFile[]> {
    const files: StoredFile[] = [];
    let continuationToken: string | undefined;

    do {
      const res = await this.client.send(
        new ListObjectsV2Command({
          Bucket: this.bucket,
          Prefix: prefix,
          ContinuationToken: continuationToken,
        }),
      );

      if (res.Contents) {
        for (const obj of res.Contents) {
          if (obj.Key) {
            const url = this.publicUrl
              ? `${this.publicUrl.replace(/\/$/, "")}/${obj.Key}`
              : obj.Key;
            files.push({
              key: obj.Key,
              url,
              size: obj.Size ?? 0,
              etag: obj.ETag?.replace(/"/g, "") ?? "",
              bucket: this.bucket,
            });
          }
        }
      }

      continuationToken = res.NextContinuationToken;
    } while (continuationToken);

    return files;
  }
}
