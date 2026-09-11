# E-Commerce Platform — DEVELOPMENT JOURNAL
> A step-by-step narrative of everything being built, why, how, what files were created, and lessons learned.
> Companion doc to `PROJECT_DOCUMENTATION.md`.

---

## 💾 POSTGRESQL STORAGE — REFERENCE (Asked 2026-09-11)
### Local Dev
- Postgres runs **inside Docker container**.
- Persistent storage = Docker **named volume** `pgdata` (from docker-compose.yml).
- Data survives container restarts. Lost only with `docker compose down -v`.
- Connect/inspect via: `pnpm prisma studio` (web UI at localhost:5555), or `docker compose exec postgres psql -U ecom ecom_platform`.
- Backup to file: `docker compose exec -T postgres pg_dump -U ecom ecom_platform > backup_YYYYMMDD.sql`.
### Production
- `DATABASE_URL` env var points to a **Managed Postgres service**: Supabase / Neon / DO Managed / RDS / Railway / Render (RECOMMENDED — they handle backups, HA, scaling).
- OR: VPS-hosted docker volume (cheaper) + daily backups.
---

---

## 🔵 BATCH #1 — Monorepo Root Configuration
**Date**: 2026-09-11
**Goal**: Create the root backbone of the monorepo so pnpm/Turbo/TypeScript/ESLint/Prettier all work consistently across every future app/package.

### Why this batch first?
Without a single source of truth for TS strictness, formatting, lint rules, and workspaces — every package we add later would fight with different configs. Locking these at the root keeps everything consistent for junior devs.

### Files Created/Edited (ALL at repo root `g:\Web Development\My Projects\ecom\`):

| # | File | Purpose |
|---|---|---|
| 1 | `package.json` | pnpm workspaces, scripts delegate to turbo: `dev`, `build`, `lint`, `typecheck`, `test`, `e2e`, `clean`. Dependencies shared: TS, ESLint, Prettier, Vitest types, pnpm, turborepo. |
| 2 | `pnpm-workspace.yaml` | Declares workspace packages: `packages/*` and `apps/*`. |
| 3 | `turbo.json` | Turborepo pipeline caching strategy: `build` dependsOn `^build` (build dependencies first), `dev` persistent, `lint`/`typecheck`/`test` no dependencies (can parallel), all cache outputs. |
| 4 | `tsconfig.base.json` | EVERY package/app will `extend` from this. `strict: true` ON, `noUncheckedIndexedAccess: true` (prevents hidden `undefined` bugs), `exactOptionalPropertyTypes: false`, ESNext target, module: bundler, paths aliases for `@ecom/*`. |
| 5 | `.eslintrc.cjs` | Root eslint: parser `typescript-eslint/parser`, plugins: `@typescript-eslint` + `prettier`, extends `eslint:recommended`, `@typescript-eslint/recommended-type-checked`, `prettier`. Ignores dist, .next, node_modules. |
| 6 | `.prettierrc` | Print width 100, single quotes, trailing commas `all`, arrow parens `always`, tabWidth 2, semi false — matches common Nextjs/shadcn style. |
| 7 | `.prettierignore` | Ignore build outputs, lock files, migrations, env, md files (optional). |
| 8 | `.gitignore` | node_modules, .turbo, dist, .next, coverage, .env*, *.local, docker volumes data paths, prisma generated, Playwright reports, IDE (.vscode, .idea), OS files. |
| 9 | `.editorconfig` | root=true, 2 spaces, lf line endings, utf8 — for IDEs to match prettier automatically. |
| 10 | `.env.example` | Skeleton placeholder section headers (API, DB, REDIS, S3, AUTH, EMAIL, SMS, PAYMENTS, SHIPPING, PLATFORM, CORS). Values blank, comments indicate what each does — real one expanded in API batch. |

### Next steps after batch
After these 10 files exist, we can:
- Run `pnpm install` once → installs dependencies + links all workspaces.
- Create empty apps/* and packages/* in Batch #2.

### Notes / Pitfalls
- `pnpm-workspace.yaml` MUST exist for pnpm to resolve `@ecom/shared-types` etc. between packages.
- `tsconfig.base.json` `"strict": true` is NON-NEGOTIABLE — prevents 80% of junior dev runtime bugs (undefined, null, any).
- Turborepo cache (`.turbo/` folder) is gitignored but will make builds 10x faster on repeated runs after the first time.

---

## 🔜 NEXT: Waiting for validation → BATCH #2 (Empty packages + apps/ scaffolding + docker-compose.yml infra)
