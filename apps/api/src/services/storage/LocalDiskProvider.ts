import { mkdir, writeFile, unlink, readdir, stat, readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { join, dirname, resolve } from "node:path";
import { Readable } from "node:stream";
import { fileURLToPath } from "node:url";
import type { StoredFile, StorageProvider } from "./types";
import { env } from "../../config";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const UPLOADS_DIR = resolve(__dirname, "..", "..", "..", "uploads");
const BUCKET = "local-disk";

export class LocalDiskProvider implements StorageProvider {
  private baseDir: string;

  constructor(baseDir: string = UPLOADS_DIR) {
    this.baseDir = baseDir;
  }

  private resolvePath(key: string): string {
    return join(this.baseDir, key);
  }

  private toUrl(key: string): string {
    // Absolute, because the storefront and admin run on other origins than the API that serves /uploads.
    return `${env.API_BASE_URL}/uploads/${key}`;
  }

  private async md5Hash(data: Buffer): Promise<string> {
    return createHash("md5").update(data).digest("hex");
  }

  private async readInput(
    buffer: Uint8Array | Readable,
  ): Promise<{ data: Buffer; size: number; etag: string }> {
    let data: Buffer;

    if (buffer instanceof Uint8Array) {
      data = Buffer.from(buffer);
    } else {
      const chunks: Buffer[] = [];
      for await (const chunk of buffer) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as Uint8Array));
      }
      data = Buffer.concat(chunks);
    }

    const size = data.length;
    const etag = await this.md5Hash(data);
    return { data, size, etag };
  }

  async put(
    key: string,
    buffer: Uint8Array | Readable,
    contentType?: string,
  ): Promise<StoredFile> {
    const { data, size, etag } = await this.readInput(buffer);
    const fullPath = this.resolvePath(key);
    const dir = dirname(fullPath);

    await mkdir(dir, { recursive: true });
    await writeFile(fullPath, data);

    return {
      key,
      url: this.toUrl(key),
      size,
      etag,
      bucket: BUCKET,
      mimeType: contentType,
    };
  }

  async getSignedUrlDownload(key: string, _ttlSec: number = 3600): Promise<string> {
    return this.toUrl(key);
  }

  async delete(keys: string[]): Promise<void> {
    const promises = keys.map(async (key) => {
      const fullPath = this.resolvePath(key);
      try {
        await unlink(fullPath);
      } catch (err) {
        const code = (err as { code?: string }).code;
        if (code === "ENOENT") return;
        throw err;
      }
    });
    await Promise.all(promises);
  }

  private async walkDir(
    dir: string,
    prefix?: string,
    depth: number = 0,
  ): Promise<string[]> {
    if (depth > 4) return [];

    const entries = await readdir(dir, { withFileTypes: true });
    const files: string[] = [];

    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        const subFiles = await this.walkDir(fullPath, prefix, depth + 1);
        files.push(...subFiles);
      } else if (entry.isFile()) {
        const rel = fullPath.slice(this.baseDir.length + 1).replace(/\\/g, "/");
        if (!prefix || rel.startsWith(prefix)) {
          files.push(rel);
        }
      }
    }

    return files;
  }

  async list(prefix?: string): Promise<StoredFile[]> {
    try {
      await stat(this.baseDir);
    } catch (err) {
      const code = (err as { code?: string }).code;
      if (code === "ENOENT") return [];
      throw err;
    }

    const keys = await this.walkDir(this.baseDir, prefix);
    const files: StoredFile[] = [];

    for (const key of keys) {
      const fullPath = this.resolvePath(key);
      const s = await stat(fullPath);
      const data = await readFile(fullPath);
      const etag = await this.md5Hash(data);
      files.push({
        key,
        url: this.toUrl(key),
        size: s.size,
        etag,
        bucket: BUCKET,
      });
    }

    return files;
  }
}
