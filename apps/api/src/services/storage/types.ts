import { Readable } from "node:stream";

export interface StoredFile {
  key: string;
  url: string;
  size: number;
  etag: string;
  bucket: string;
  mimeType?: string;
}

export interface StorageProvider {
  put(
    key: string,
    buffer: Uint8Array | Readable,
    contentType?: string,
  ): Promise<StoredFile>;
  /** The public address of a stored file (the same `url` put returns). */
  urlOf(key: string): string;
  getSignedUrlDownload(key: string, ttlSec?: number): Promise<string>;
  delete(keys: string[]): Promise<void>;
  list(prefix?: string): Promise<StoredFile[]>;
}
