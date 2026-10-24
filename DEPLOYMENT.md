# Deploying to production

One Linux server runs everything with Docker Compose. Caddy sits in front and gets HTTPS
certificates by itself:

```
            ┌──────────── one server ─────────────────────────────────────────┐
browser ──▶ │ Caddy :443 ─▶ storefront · store-admin · super-admin · api      │
            │                                   │                             │
            │                         worker ◀──┤ Redis (queues)  Postgres    │
            └──────────────────────────────────────────────────────────────────┘
                     product images, backups ─▶ S3-compatible storage (R2, Spaces, S3)
```

- **CI builds the images.** Each push to `main` builds them and puts them in GitHub's registry (`ghcr.io/<owner>/ecom-*`), tagged with the commit (e.g. `1a2b3c4`) and `latest`.
- **The server never builds.** It pulls a tag and runs it.
- **Files:**
  - `docker-compose.prod.yml`: the services;
  - `docker/Caddyfile`: the web addresses;
  - `.env.production.example`: every setting, explained.

## 1. Before you start

| You need | Notes |
|---|---|
| A server | Ubuntu 24.04, **2 vCPU / 4 GB RAM** at least (4 vCPU / 8 GB for busy shops), 40 GB disk. |
| Domains | e.g. `shop.com` (storefront), `admin.shop.com`, `super.shop.com`, `api.shop.com`. |
| S3-compatible storage | Two buckets: one for product images (public read), one for backups (private). Cloudflare R2, DigitalOcean Spaces or AWS S3. |
| An SMTP provider | For order and password-reset emails (Mailgun, Amazon SES, Brevo…). |
| GitHub access | A personal access token with **read:packages**, so the server can pull the images. |

## 2. One-time GitHub setup

1. **Repository variables:** in the repository, open Settings → Secrets and variables → Actions → **Variables**, and add:
   - `PUBLIC_API_URL` = `https://api.shop.com/api`
   - `PUBLIC_SITE_URL` = `https://shop.com`
   - `PUBLIC_STORE_ADMIN_URL` = `https://admin.shop.com/login`

   The web apps bake these in when they're built. If you change them, rebuild by pushing to `main`, or re-run the "Docker images" job.
2. **Images:** push to `main` and wait for the **Docker images** CI job. Its packages appear under the repository's "Packages".

## 3. Prepare the server

```bash
# Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER   # sign out and in again

# Firewall: only SSH and web
sudo ufw allow OpenSSH && sudo ufw allow 80 && sudo ufw allow 443 && sudo ufw enable

# The images are private: sign in to GitHub's registry with the read:packages token
echo <token> | docker login ghcr.io -u <github-user> --password-stdin

# The deployment files (no need for the whole source)
mkdir -p ~/ecom/docker && cd ~/ecom
curl -fsSLO https://raw.githubusercontent.com/<owner>/ecom/main/docker-compose.prod.yml
curl -fsSL -o docker/Caddyfile https://raw.githubusercontent.com/<owner>/ecom/main/docker/Caddyfile
curl -fsSL -o .env https://raw.githubusercontent.com/<owner>/ecom/main/.env.production.example
chmod 600 .env
```

**DNS:** point an **A record** for each domain (`shop.com`, `www.shop.com`, `admin.shop.com`, `super.shop.com`, `api.shop.com`) at the server's IP address. Do this before starting, so Caddy can get the certificates.

## 4. Fill in `.env`

Open `.env` and replace every `<…>`. For each secret, run `openssl rand -hex 32` and paste a **different** value.

- **The API checks the settings when it starts.** In production it refuses placeholder or weak secrets, the local MinIO keys, localhost addresses and the local mail catcher, and prints which setting to fix:
  ```bash
  docker compose -f docker-compose.prod.yml logs api | grep -A20 FATAL
  ```
- **Keep a copy of `APP_ENCRYPTION_KEY`** somewhere safe, apart from the server. The gateway, courier and SMS keys in the database can't be read without it.

## 5. First start

```bash
cd ~/ecom
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d
docker compose -f docker-compose.prod.yml ps      # all "running"; migrate "exited (0)"
```

- **Migrations:** the `migrate` service applies database migrations, then stops. The API and the worker start only after it succeeds.
- **The platform owner:**
  ```bash
  docker compose -f docker-compose.prod.yml run --rm api ./node_modules/.bin/tsx scripts/bootstrap.ts
  ```
  This uses `BOOTSTRAP_EMAIL` and `BOOTSTRAP_PASSWORD` from `.env`. It creates the owner and nothing else, and refuses if a platform admin already exists. **Delete those two lines from `.env` afterwards.** Never run the demo seed (`prisma:seed`) in production.

Then:

1. **Sign in** at `https://super.shop.com`. Open **My account** and turn on **two-step sign-in**.
2. **Create the store:** Stores → New store. Its first owner account is made there.
3. **Domains:** add the store's addresses. Storefront: `shop.com` (and `www.shop.com`). Admin: `admin.shop.com`. The API finds the store from these.
4. **Store admin:** sign in at `https://admin.shop.com` as the store owner and set up the store's settings: payments, couriers, SMS, shipping, taxes. Turn on two-step sign-in there too. **Staff → "Require two-step sign-in for all staff"** is recommended.

## 6. Backups

- **Every night at 02:30 (Dhaka time)** the `backup` service saves a compressed copy of the database (`pg_dump`):
  - on the server, in the `backups` volume;
  - in the **private** bucket `BACKUP_S3_BUCKET`.
- **What's kept:** the last 7 nights, and one from each of the 4 weeks before, in both places. Older ones are deleted.
- **What isn't in it:**
  - product images: they live in the storage bucket, so turn on its versioning or lifecycle rules with your provider;
  - Redis: only queues and caches.

```bash
C="docker compose -f docker-compose.prod.yml"
 exec backup ./node_modules/.bin/tsx scripts/backup.ts              # a backup now (e.g. before a big change)
 logs backup | tail                                                # last runs ("Database backup done")
 exec backup ls -lh /backups                                       # what's on the server
```

**Test a restore once a month.** It restores into a scratch database, compares every table's row count with the live one, and deletes the scratch copy. Nothing live is touched:

```bash
 exec backup ./node_modules/.bin/tsx scripts/restore.ts latest --test
```

**In an emergency** (a bad migration, or data deleted by mistake), this replaces the live database with a backup:

```bash
 stop api worker
 exec backup ./node_modules/.bin/tsx scripts/restore.ts latest --yes        # or a file name: ecom-20261025-0230.dump
 start api worker
```

- **Atomic:** it runs as one transaction. If anything fails, the database stays as it was.
- **New server:** restore there the same way. It fetches the file from the bucket when it isn't on the server.
- **Afterwards:** everyone signs in again; sessions are lost with the old server's Redis.

## 7. Updating

```bash
cd ~/ecom
docker compose -f docker-compose.prod.yml pull          # IMAGE_TAG=latest: the newest main
docker compose -f docker-compose.prod.yml up -d         # runs new migrations first, then restarts
docker image prune -f
```

**To pin a version,** set `IMAGE_TAG=<commit>` in `.env` (the 7-character commit shown in GitHub), then `pull` and `up -d`.

## 8. Rolling back

- **Code-only change:** set `IMAGE_TAG` to the previous commit, then `pull` and `up -d`.
- **Release with a database migration:** migrations don't undo themselves.
  1. Restore the last backup taken before the update (see section 6). Take one by hand just before a big update.
  2. Then start the previous `IMAGE_TAG`.

## 9. Everyday commands

```bash
C="docker compose -f docker-compose.prod.yml"
$C ps                                   # what's running
$C logs -f --tail=100 api worker        # logs (rotated: 5 × 10 MB per service)
$C restart api                          # restart one service
$C exec postgres psql -U ecom ecom_platform    # a database shell

# Someone lost their phone and backup codes (two-step sign-in):
$C run --rm api ./node_modules/.bin/tsx scripts/reset-two-factor.ts --admin owner@shop.com --store <store-slug>
$C run --rm api ./node_modules/.bin/tsx scripts/reset-two-factor.ts --super you@shop.com

# Recount product star ratings (rarely needed):
$C run --rm api ./node_modules/.bin/tsx scripts/refresh-ratings.ts
```

## 10. Rehearse locally first (optional)

The same images and compose file run on a developer machine, at `http://*.ecom.localhost`:

1. Copy `.env.production.example` to `.env.rehearsal` and fill it in with throwaway values, plus `ENV_FILE=.env.rehearsal` (so the containers read it, not your dev `.env`).
2. Use `http://` addresses for the four domains, and add `PRODUCTION_REHEARSAL=on` (localhost addresses allowed).
3. Start it:
   ```bash
   docker compose -p ecom-rehearsal --env-file .env.rehearsal \
     -f docker-compose.prod.yml -f docker-compose.rehearsal.yml up -d
   ```

The rehearsal adds Mailpit (http://localhost:8026), stores files on the API's local disk (`STORAGE_DRIVER=local`),, and runs under its own project name, so it never touches the dev database. **Never set `PRODUCTION_REHEARSAL` on a real server.**
