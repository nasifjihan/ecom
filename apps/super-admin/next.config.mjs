import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..");

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Docker builds set NEXT_OUTPUT=standalone (see docker/web.Dockerfile); local dev is unchanged.
  ...(process.env.NEXT_OUTPUT === "standalone" ? { output: "standalone" } : {}),
  transpilePackages: ["@ecom/*"],
  experimental: {
    outputFileTracingRoot: repoRoot,
    serverComponentsExternalPackages: [],
  },
};

export default nextConfig;
