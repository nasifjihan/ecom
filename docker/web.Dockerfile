# syntax=docker/dockerfile:1.7
# ============================================================
#   Next.js apps (storefront-fashion, store-admin, super-admin)
#   docker build -f docker/web.Dockerfile --build-arg APP=storefront-fashion .
#
#   NEXT_PUBLIC_* values are baked in at build time, so the browser-facing
#   API URL is a build arg. The app is built in "standalone" mode and runs
#   with plain `node server.js`.
# ============================================================
ARG NODE_IMAGE=node:22-alpine

FROM ${NODE_IMAGE} AS builder
ARG APP
ARG NEXT_PUBLIC_API_BASE_URL=http://localhost:4000/api
ARG NEXT_PUBLIC_SITE_URL=http://localhost:3000
RUN test -n "$APP" || (echo "Pass --build-arg APP=<app folder>" && exit 1)
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml turbo.json tsconfig.base.json ./
COPY packages ./packages
COPY apps/storefront-base ./apps/storefront-base
COPY apps/${APP} ./apps/${APP}
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

ENV NEXT_TELEMETRY_DISABLED=1 \
    NEXT_OUTPUT=standalone \
    NEXT_PUBLIC_API_BASE_URL=${NEXT_PUBLIC_API_BASE_URL} \
    NEXT_PUBLIC_SITE_URL=${NEXT_PUBLIC_SITE_URL}
RUN cd apps/${APP} && pnpm exec next build --no-lint && mkdir -p public

FROM ${NODE_IMAGE} AS runtime
ARG APP
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 HOSTNAME=0.0.0.0 PORT=3000 APP=${APP}
WORKDIR /app
# Standalone output mirrors the monorepo layout: server.js lives under apps/<APP>.
COPY --from=builder --chown=node:node /app/apps/${APP}/.next/standalone ./
COPY --from=builder --chown=node:node /app/apps/${APP}/.next/static ./apps/${APP}/.next/static
COPY --from=builder --chown=node:node /app/apps/${APP}/public ./apps/${APP}/public
USER node
EXPOSE 3000
CMD ["sh", "-c", "node apps/$APP/server.js"]
