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

  if (env.S3_ENDPOINT) {
    cachedProvider = new S3Provider();
  } else {
    cachedProvider = new LocalDiskProvider();
  }

  return cachedProvider;
}
