# Ecom: multi-store, multi-storefront e-commerce for Bangladesh

One platform runs many online shops. Each shop can have several storefronts (for example a main shop and an outlet with its own prices) that share one stock.

| Part | Folder | What it is |
|---|---|---|
| API | `apps/api` | Express + Prisma + Postgres + Redis/BullMQ: every rule, price, order and payment |
| Storefront | `apps/storefront-fashion` | The shop shoppers see (Next.js) |
| Store admin | `apps/store-admin` | Where a shop's owner and staff run it |
| Super admin | `apps/super-admin` | Where the platform team creates stores, plans and domains |

More: [DEPLOYMENT.md](DEPLOYMENT.md) (servers, backups, monitoring), [DEVELOPMENT_JOURNAL.md](DEVELOPMENT_JOURNAL.md) (what each batch built), [FEATURE_COMPARISON.md](FEATURE_COMPARISON.md).

## Setting up on a new computer

### Files git doesn't have
Two settings files hold local passwords and keys, so they're not in the repository. Copy them from your other computer privately (a USB stick or your own cloud drive), never through git or email:
- `.env.rehearsal`: the local production copy (way A)
- `.env`: development (way B)

### Install
- **Git**
- **Docker Desktop**, with WSL 2 on Windows. Give it at least 8 GB of memory (Settings → Resources).
- **Node.js 22 or newer**: only for way B.

```bash
git clone https://github.com/nasifjihan/ecom.git
```

Put the copied settings files in the new `ecom` folder. Run the commands below from that folder, in Git Bash on Windows.

### A. The local production copy, with the demo shop
The same images and setup as a real server, at `*.ecom.localhost` addresses. Chrome and Edge find those by themselves. This is the way to look around and test as a shopper or the shop's staff.

```bash
bash scripts/build-rehearsal-images.sh
```

The first build takes 15–25 minutes. Then:

```bash
C="docker compose -p ecom-rehearsal --env-file .env.rehearsal -f docker-compose.prod.yml -f docker-compose.rehearsal.yml"
$C up -d
$C run --rm api ./node_modules/.bin/tsx scripts/bootstrap.ts
$C run --rm api ./node_modules/.bin/tsx scripts/demo/index.ts
$C restart storefront
```

- **`up -d`:** starts everything; the database is created and migrated automatically.
- **`bootstrap.ts`:** creates the platform owner from `BOOTSTRAP_EMAIL` / `BOOTSTRAP_PASSWORD` in `.env.rehearsal`.
- **`demo/index.ts`:** builds the demo shop. It needs internet for the photos and takes about 3 minutes.
- **`restart storefront`:** shows the new shop straight away.

**Where to go:**

| | Address | Sign in |
|---|---|---|
| Shop | http://shop.ecom.localhost | `nusrat@rongtuli.test` / `Customer@123!` |
| Outlet (15% lower prices) | http://outlet.ecom.localhost | the same customer |
| Store admin | http://admin.ecom.localhost | `owner@rongtuli.test` / `Rongtuli@123!` |
| Staff | the same admin address | `sabbir@`, `mitu@`, `jamal@`, `priya@rongtuli.test` / `Rongtuli-Staff-2026!` |
| Super admin | http://super.ecom.localhost | `BOOTSTRAP_EMAIL` / `BOOTSTRAP_PASSWORD` from `.env.rehearsal` |
| Test emails | http://localhost:8026 | Mailpit catches every email |

These are made-up local test accounts.

**Rules:**
- **Outlet address:** the Outlet needs `http://outlet.ecom.localhost` in `SHOP_DOMAINS` in `.env.rehearsal` (comma separated).
- **One database per computer:** the demo is made fresh on each computer. The catalogue comes out the same; the order history differs a little.
- **After pulling new code:** run `git pull`, then rebuild what changed (`bash scripts/build-rehearsal-images.sh`, or name the images: `api storefront store-admin super-admin`), then `$C up -d`.
- **Start clean for real data:** `$C down -v` deletes the rehearsal's database, photos and backups. Start again and run `bootstrap.ts`.
- **Stop:** `$C stop` stops it without deleting anything.

### B. Development (changing the code)
The apps run on your computer and reload as you edit. Docker only holds Postgres (port 5432), Redis (6381) and Mailpit.

```bash
corepack enable
pnpm install
pnpm db:up
pnpm prisma:migrate:deploy
pnpm prisma:seed
pnpm dev
```

- **`corepack enable`:** turns on pnpm, at the version `package.json` names.
- **`pnpm db:up`:** starts Postgres, Redis and Mailpit.
- **`pnpm prisma:migrate:deploy`:** creates the tables.
- **`pnpm prisma:seed`:** adds the dev store, Fashion BD, and its logins.
- **`pnpm dev`:** starts the storefront (http://localhost:3100), store admin (3101), super admin (3102) and API (4000).

Dev logins (from the seed):
- **store admin:** `owner@fashionbd.local` / `Owner@123!`
- **super admin:** `super@admin.ecom.local` / `Super@dmin123!`

**No `.env` to copy?** Start from the example:

```bash
cp .env.example .env
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Paste the printed key into `APP_ENCRYPTION_KEY`; it must be exactly 64 characters. The `replace_me_…` secrets are fine for development.

**Tests:** they run against a separate `ecom_test` database, never the dev one, which some tests empty.

Create the test database once:

```bash
docker exec ecom-postgres createdb -U ecom ecom_test
```

Then run the tests from `apps/api`:

```bash
export DATABASE_URL="postgresql://ecom:ecom_local_pw@localhost:5432/ecom_test?schema=public" DIRECT_URL="$DATABASE_URL"
npx prisma migrate deploy
NODE_ENV=test RUN_DB_TESTS=1 MAIL_DRIVER=log npx vitest run
```

- **`prisma migrate deploy`:** creates the tables, once, and again after new migrations.
- **`vitest run`:** the full suite.

### Ports
- **Development:** 3100–3102 and 4000.
- **Production copy:** 80, 443 and 8026.
- **Something else on those ports?** Stop it, or change the port in `.env` and the app's `dev` script.
