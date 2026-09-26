import { env } from "../../config/env";
import type { StoredFile, StorageProvider } from "./types";
import { S3Provider } from "./S3Provider";
import { LocalDiskProvider } from "./LocalDiskProvider";

export type { StoredFile, StorageProvider };
export { S3Provider, LocalDiskProvider };

let cachedProvider: StorageProvider | null = null;

export function getStorageProvider(): StorageProvider {
  if (cachedProvider) {
    return cachedProvider;
  }

  // STORAGE_DRIVER decides; S3_ENDPOINT alone (set in .env.example) must not force S3 when driver=local.
  if (env.STORAGE_DRIVER === "s3") {
    cachedProvider = new S3Provider();
  } else {
    cachedProvider = new LocalDiskProvider();
  }

  return cachedProvider;
}
