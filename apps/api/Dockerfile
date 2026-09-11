# syntax=docker/dockerfile:1.7
# ============================================================
#   @ecom/api — 2-stage Docker build
#   Stage 1 (builder): pnpm install + tsc build
#   Stage 2 (runtime): slim node:22-alpine with only deps + dist
# ============================================================

# -------- DEPS / BUILDER STAGE --------
FROM node:22-alpine AS builder
RUN apk add --no-cache libc6-compat python3 make g++
WORKDIR /app

# Install pnpm globally
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate

# Copy workspace configs first (for better caching)
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* turbo.json tsconfig.base.json ./

# Copy shared packages' package.json
COPY packages/shared-types/package.json ./packages/shared-types/package.json
COPY packages/utils/package.json ./packages/utils/package.json
COPY packages/zod-schemas/package.json ./packages/zod-schemas/package.json
COPY packages/api-client/package.json ./packages/api-client/package.json
COPY packages/ui/package.json ./packages/ui/package.json

# Copy api + any apps needed for install (we just need api + shared)
COPY apps/api/package.json ./apps/api/package.json

# Install prod + dev deps in builder (for build/tsc)
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile || pnpm install --no-frozen-lockfile

# Copy full source
COPY packages ./packages
COPY apps/api ./apps/api

# Build the workspace
RUN pnpm --filter @ecom/api... build

# -------- RUNTIME STAGE --------
FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
RUN apk add --no-cache libc6-compat curl tini
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate

ENTRYPOINT ["/sbin/tini", "--"]
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD curl -fsS http://localhost:4000/healthz || exit 1

# Only copy built packages + their package.json
COPY --from=builder /app/package.json /app/pnpm-workspace.yaml /app/turbo.json ./
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/apps/api/package.json /app/apps/api/
COPY --from=builder /app/apps/api/dist /app/apps/api/dist
COPY --from=builder /app/apps/api/prisma /app/apps/api/prisma

# Re-install only production deps
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --prod --ignore-scripts || pnpm install --prod

# Generate Prisma client
RUN cd apps/api && pnpm exec prisma generate

USER node
WORKDIR /app/apps/api
CMD ["node", "dist/server.js"]
