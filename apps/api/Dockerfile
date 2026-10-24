# syntax=docker/dockerfile:1.7
# ============================================================
#   @ecom/api
#   The API and the shared packages are TypeScript sources run with tsx
#   (the workspace packages have no compiled output), so the image keeps
#   the workspace install and runs src/server.ts directly.
#
#   Build from the repo root:  docker build -f apps/api/Dockerfile .
#   Default command: start the API. The same image also runs:
#     migrations   ./node_modules/.bin/prisma migrate deploy   (the "migrate" service, before the API)
#     the worker   ./node_modules/.bin/tsx src/workers/index.ts (the "worker" service)
#     bootstrap    ./node_modules/.bin/tsx scripts/bootstrap.ts (first start: the platform owner)
#   Never run the demo seed in production.
# ============================================================
FROM node:22-alpine
# Prisma needs OpenSSL on Alpine; pg_dump/pg_restore (17, as the server) for backups.
RUN apk add --no-cache openssl postgresql17-client
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
WORKDIR /app

# Workspace manifests first so the install layer caches between code changes.
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml turbo.json tsconfig.base.json ./
COPY packages/shared-types/package.json packages/shared-types/
COPY packages/utils/package.json packages/utils/
COPY packages/zod-schemas/package.json packages/zod-schemas/
COPY packages/api-client/package.json packages/api-client/
COPY packages/ui/package.json packages/ui/
COPY packages/export-utils/package.json packages/export-utils/
COPY apps/api/package.json apps/api/
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile --filter @ecom/api...

COPY packages ./packages
COPY apps/api ./apps/api
RUN cd apps/api && pnpm exec prisma generate
# Runs as the unprivileged node user; it only writes local uploads (STORAGE_DRIVER=local).
RUN mkdir -p apps/api/uploads /backups && chown -R node:node apps/api/uploads /backups

# Order numbers and the dashboard's "today" read the local day: the shop's, not the container's UTC.
ENV NODE_ENV=production TZ=Asia/Dhaka
WORKDIR /app/apps/api
EXPOSE 4000
HEALTHCHECK --interval=15s --timeout=5s --start-period=60s --retries=5 \
  CMD node -e "fetch('http://localhost:4000/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
USER node
# The installed binaries, not pnpm: as the node user, corepack would try to fetch pnpm at start.
CMD ["./node_modules/.bin/tsx", "src/server.ts"]
