import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..");

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Docker builds set NEXT_OUTPUT=standalone (see docker/web.Dockerfile); local dev is unchanged.
  ...(process.env.NEXT_OUTPUT === "standalone" ? { output: "standalone" } : {}),
  transpilePackages: ["@ecom/*"],
  images: {
    remotePatterns: [
      { protocol: "http", hostname: "localhost" },
      { protocol: "https", hostname: "**" },
    ],
  },
  outputFileTracingRoot: repoRoot,
  // Sentry loads this package by its own name at start-up; tracing copies its files but not its
  // package.json, so it failed to load in the Docker image (standalone).
  outputFileTracingIncludes: {
    "/**": ["../../node_modules/.pnpm/@sentry+server-runtime-injection@*/node_modules/@sentry/server-runtime-injection/package.json"],
  },
};

export default nextConfig;
