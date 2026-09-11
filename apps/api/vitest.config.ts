import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: [
      "src/**/*.{test,spec}.{ts,tsx}",
      "tests/**/*.{test,spec}.{ts,tsx}",
      "test/**/*.{test,spec}.{ts,tsx}",
    ],
    exclude: ["node_modules", "dist", ".next"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      include: ["src/modules/**/*.ts", "src/core/**/*.ts"],
      exclude: ["**/routes.ts", "**/*.dto.ts", "src/server.ts"],
    },
    setupFiles: [path.resolve(__dirname, "tests/setup.ts")],
  },
  resolve: {
    alias: {
      "@ecom/shared-types": path.resolve(__dirname, "../../packages/shared-types/src/index.ts"),
      "@ecom/utils": path.resolve(__dirname, "../../packages/utils/src/index.ts"),
      "@ecom/zod-schemas": path.resolve(__dirname, "../../packages/zod-schemas/src/index.ts"),
    },
  },
});
