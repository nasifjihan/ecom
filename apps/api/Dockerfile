# syntax=docker/dockerfile:1.7
# ============================================================
#   @ecom/api
#   The API and the shared packages are TypeScript sources run with tsx
#   (the workspace packages have no compiled output), so the image keeps
#   the workspace install and runs src/server.ts directly.
#
#   Build from the repo root:  docker build -f apps/api/Dockerfile .
#   Default command: apply migrations, then start the API.
#   Seed once with:            docker compose run --rm api pnpm prisma:seed
# ============================================================
FROM node:22-alpine
# Prisma needs OpenSSL on Alpine.
RUN apk add --no-cache openssl
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

ENV NODE_ENV=production
WORKDIR /app/apps/api
EXPOSE 4000
HEALTHCHECK --interval=15s --timeout=5s --start-period=60s --retries=5 \
  CMD node -e "fetch('http://localhost:4000/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["sh", "-c", "pnpm exec prisma migrate deploy && pnpm exec tsx src/server.ts"]
