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

---

## 0. Your first deployment: do these ten steps in order

**New to deploying?** Work down this section. Each step says what to do, what to type, and how to tell it worked. Sections 1–13 below are the detailed reference; you only need them if something goes wrong.

### Words you'll meet

| Word | What it means here |
|---|---|
| **Server** | A computer you rent that is never switched off, sitting in a data centre. Everything (shop, admin, API, database) runs on this one machine. |
| **Domain** | The name people type, e.g. `shop.com`. You buy it once a year. |
| **DNS** | The address book that turns a name into the server's IP address. You add records at whoever you bought the domain from. |
| **A record** | One line of DNS: "this name → this IP". You'll add five. |
| **SSH** | How you type commands on the server from your own computer. |
| **Docker / containers** | The server runs each part of the platform in its own sealed box. **Docker Compose** starts all the boxes together from one file. |
| **Image** | The sealed box itself, built by GitHub and downloaded by the server. The server never builds anything. |
| **`.env`** | One text file on the server holding every setting and password. Never in git. |
| **Caddy** | The front door. It handles HTTPS (the padlock) by itself, for free. |

### What you'll end up with

Five web addresses, all on the one server:

| Address | What it is |
|---|---|
| `shop.com`, `www.shop.com` | The storefront — customers shop here |
| `admin.shop.com` | The store admin — the shop owner runs the business here |
| `super.shop.com` | The super admin — you run the whole platform here |
| `api.shop.com` | The API — the engine the three apps talk to; not for browsing |

---

### Step 1 — Create the accounts (your side, roughly an hour)

Costs today: **the domain**. Oracle, Cloudflare R2 and Brevo all have free tiers; SMS and courier test bookings cost a little later.

Keep one notes file with everything you create here: the server's IP, the domain, bucket names, keys. You'll paste these into `.env` in step 5.

**1a. Buy a domain.** Any registrar. About 1,200–1,500 BDT a year for a `.com`. Do **not** use a free subdomain (like DuckDNS): the admin and API addresses can't share login cookies on those, and sign-in breaks.

**1b. An Oracle Cloud server (free).**
1. Sign up at oracle.com/cloud/free. It asks for a card to check who you are; it is not charged. Some cards are refused.
2. Choose a **home region** near Bangladesh: Singapore or Mumbai.
3. Create a compute instance:
   - **Image:** Ubuntu 24.04 (the ARM/aarch64 build),
   - **Shape:** `VM.Standard.A1.Flex`, 4 OCPU / 24 GB RAM (that's the whole Always Free allowance),
   - **SSH keys:** let it create one and **download the private key file** — you need it to log in, and it can't be downloaded again.
4. **Open the web ports.** Two firewalls are involved on Oracle, and both block HTTPS by default:
   - in the console: the instance's subnet → Security List → add ingress rules for **TCP 80** and **TCP 443** from `0.0.0.0/0`;
   - on the machine: step 4 below runs `ufw`.
5. Note the instance's **public IP address**.
6. Check you can get in:
   ```bash
   ssh -i <your-key-file> ubuntu@<server-ip>
   ```

   **Catches:** free ARM servers are sometimes "out of capacity" in a region — try again later or pick another region. Oracle may reclaim a free server that sits idle for a week; that stops being a risk once testers are using it.

**1c. Cloudflare R2 storage (free, 10 GB).** This holds product photos and the nightly database backups.
1. Make a Cloudflare account, then R2 → **Create bucket** twice: `shop-media` (product photos) and `shop-backups` (database backups).
2. On `shop-media`, turn on public access (the R2.dev address, or a custom domain like `media.shop.com`). `shop-backups` stays private.
3. R2 → **Manage API tokens** → create one with access to both buckets. It gives you an **Access Key ID** and a **Secret Access Key**, plus your endpoint that looks like `https://<account-id>.r2.cloudflarestorage.com`.

**1d. Brevo email (free, 300 emails a day).** Order confirmations and password resets go through this.
1. Sign up at brevo.com, then **verify a sender address** (e.g. `no-reply@shop.com`) — Brevo won't send from an unverified address.
2. SMTP settings: host `smtp-relay.brevo.com`, port `587`, and a **SMTP key** as the password.

---

### Step 2 — Point the domain at the server (DNS)

At your registrar's DNS screen, add five **A records**, all pointing at the server's IP from step 1b:

| Type | Name | Value |
|---|---|---|
| A | `@` | `<server-ip>` |
| A | `www` | `<server-ip>` |
| A | `admin` | `<server-ip>` |
| A | `super` | `<server-ip>` |
| A | `api` | `<server-ip>` |

- TTL can stay at its default or "auto".
- Wait a few minutes, then check from your own computer:
  ```bash
  nslookup api.shop.com
  ```
  It must answer with your server's IP. **Do this before starting the platform** — Caddy can only get the padlock certificates once the names already point at the server.
- **If your domain's DNS is managed by Cloudflare,** set these five records to **DNS only** (grey cloud), not "Proxied" (orange cloud) at first. Proxying hides the server from Caddy and the certificates fail. You can turn proxying on later.

---

### Step 3 — Let GitHub build the images

1. In the GitHub repository: **Settings → Secrets and variables → Actions → Variables** tab, add three repository variables:

   | Variable | Value |
   |---|---|
   | `PUBLIC_API_URL` | `https://api.shop.com/api` |
   | `PUBLIC_SITE_URL` | `https://shop.com` |
   | `PUBLIC_STORE_ADMIN_URL` | `https://admin.shop.com/login` |

   These get baked into the web apps when they're built, so use your real addresses. Changing them later means rebuilding (push to `main` again).

2. Push to `main`, then open the repository's **Actions** tab and watch the **Docker images** job. It builds four images (API, storefront, store admin, super admin) for both processor types. **The ARM half runs under emulation and is slow — expect this job to take a long time.** Coffee-break long.
3. When it's green, the images exist as `ghcr.io/<your-github-name>/ecom-api` and three more (see the repository's **Packages**).

Optional: add `PUBLIC_SENTRY_DSN` as well if you've set up Sentry (section 7).

---

### Step 4 — Prepare the server

Log in (`ssh -i <your-key-file> ubuntu@<server-ip>`) and run, one block at a time:

```bash
# Docker, the program that runs everything
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER      # then sign out and back in for this to take effect

# The machine's own firewall: only SSH and the web
sudo ufw allow OpenSSH && sudo ufw allow 80 && sudo ufw allow 443 && sudo ufw enable
```

The images are private, so the server must sign in to GitHub's registry. Make a GitHub **personal access token** with the **read:packages** permission, then:

```bash
echo <token> | docker login ghcr.io -u <your-github-name> --password-stdin
```

Now put the three deployment files on the server. The server needs the files, not the source code:

```bash
mkdir -p ~/ecom/docker && cd ~/ecom
curl -fsSLO https://raw.githubusercontent.com/<owner>/ecom/main/docker-compose.prod.yml
curl -fsSL -o docker/Caddyfile https://raw.githubusercontent.com/<owner>/ecom/main/docker/Caddyfile
curl -fsSL -o .env https://raw.githubusercontent.com/<owner>/ecom/main/.env.production.example
chmod 600 .env
```

**If your repository is private, those `curl` commands return 404.** Copy the three files from your own computer instead (run this on your computer, not the server):

```bash
scp -i <your-key-file> docker-compose.prod.yml docker/Caddyfile .env.production.example ubuntu@<server-ip>:~/ecom/
```

…then on the server rename the last one: `mv .env.production.example .env && chmod 600 .env`, and move `Caddyfile` into `docker/`. (`scp` can't create the folder, so run `mkdir -p ~/ecom/docker` on the server first.)

---

### Step 5 — Fill in `.env`

`nano ~/ecom/.env` and replace **every** `<…>`. Two rules:

- **Every secret must be different.** Make each one on the server with:
  ```bash
  openssl rand -hex 32
  ```
- **Never reuse a value from this guide or from a local `.env`.** In production the API refuses to start with weak or placeholder secrets, local addresses (localhost) or the local mail catcher — it prints which setting to fix.

The blocks you'll edit, and what goes in them:

| Block | What to put |
|---|---|
| Images | `GHCR_OWNER` = your GitHub name, lowercase. Leave `IMAGE_TAG=latest`. |
| Domains | `ACME_EMAIL` = your email (certificate notices); `SHOP_DOMAIN=shop.com`; `SHOP_DOMAINS=shop.com, www.shop.com`; `ADMIN_DOMAIN`, `SUPER_DOMAIN`, `API_DOMAIN`; `COOKIE_DOMAIN=shop.com`; `ALLOWED_ORIGINS_REGEX=^https://([a-z0-9-]+\.)?shop\.com$` (your domain, dots escaped). Cancel the "conflict" if one comes up. |
| Database | `POSTGRES_PASSWORD` = a new secret (24 bytes), and put the **same** value inside `DATABASE_URL` and `DIRECT_URL`. |
| Redis | `REDIS_PASSWORD` = a new secret, same value inside `REDIS_URL`. |
| Storage | `S3_ENDPOINT` = your R2 endpoint; `S3_BUCKET=shop-media`; the R2 access key and secret; `S3_PUBLIC_URL` = the public R2.dev address or `https://media.shop.com`; `BACKUP_S3_BUCKET=shop-backups`. |
| Secrets | One new `openssl rand -hex 32` value each, for the six `JWT_*` secrets, `COOKIE_SECRET` and `APP_ENCRYPTION_KEY`. |
| Email | `SMTP_HOST=smtp-relay.brevo.com`, `SMTP_PORT=587`, `SMTP_ENCRYPTION=tls`, the Brevo SMTP **key** as `SMTP_PASS`, `SMTP_USER` as given by Brevo, and `MAIL_FROM_ADDRESS` = your **verified** sender. |
| First start only | `BOOTSTRAP_EMAIL` and `BOOTSTRAP_PASSWORD` — your own super-admin login for the first sign-in. |

**Copy `APP_ENCRYPTION_KEY` somewhere safe, off the server.** The payment, courier and SMS keys the shop later saves in the admin are encrypted with it; without it they can't be read back.

Save with `Ctrl+O`, `Enter`, then `Ctrl+X`.

---

### Step 6 — Start everything

```bash
cd ~/ecom
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d
docker compose -f docker-compose.prod.yml ps
```

**How to tell it worked:**
- `ps` shows every service **running**, except `migrate`, which shows **exited (0)** — that's correct: it sets up the database tables, then stops on purpose. The API and the background worker wait for it.
- When you visit `https://shop.com`, the padlock appears on its own (Caddy asked Let's Encrypt for a certificate).
- If the API keeps restarting, read why:
  ```bash
  docker compose -f docker-compose.prod.yml logs api | grep -A20 FATAL
  ```
  It names the setting to fix in `.env`.

---

### Step 7 — Create the platform owner, then the shop

**The platform owner** (you) — this is the only time `BOOTSTRAP_*` is used:

```bash
docker compose -f docker-compose.prod.yml run --rm api ./node_modules/.bin/tsx scripts/bootstrap.ts
```

It creates the owner from `BOOTSTRAP_EMAIL`/`BOOTSTRAP_PASSWORD` and nothing else, and refuses if an owner already exists. **Then delete those two lines from `.env`.** Never run the demo seed (`prisma:seed`) in production.

Then, in the browser:

1. Sign in at `https://super.shop.com`. Open **My account** and turn on **two-step sign-in** straight away.
2. **Stores → New store.** This is where the shop's first owner account is created.
3. Add the store's **domains** (storefront `shop.com` and `www.shop.com`, admin `admin.shop.com`). This is how the API knows which shop a request belongs to.
4. Sign in at `https://admin.shop.com` as the shop owner and fill in the store's settings: payments, couriers, SMS, shipping, taxes. Turn on two-step sign-in here too; **Staff → "Require two-step sign-in for all staff"** is recommended.

The platform is now live and empty.

---

### Step 8 — Backups and monitoring

- **Backups run by themselves** every night at 02:30 Dhaka time, to the server and to the private `shop-backups` bucket, keeping the last 7 nights plus one from each of the last 4 weeks. Check it once:
  ```bash
  C="docker compose -f docker-compose.prod.yml"
  $C logs backup | tail        # expect "Database backup done"
  ```
- **Test a restore once a month.** It restores into a scratch database and compares it; nothing live is touched:
  ```bash
  $C exec backup ./node_modules/.bin/tsx scripts/restore.ts latest --test
  ```
- **Error reports (optional):** create a free Sentry project (platform Node.js), put its DSN in `SENTRY_DSN` in `.env` **and** as the GitHub variable `PUBLIC_SENTRY_DSN`, then `up -d` and push to `main` (the browser side is baked in at build).
- **Uptime:** add free checks (UptimeRobot or similar) on `https://api.shop.com/readyz` and `https://shop.com`. `/readyz` returns 200 when the database, Redis and the background worker are healthy, and 503 with the reason when they aren't.

---

### Step 9 — The testing phase, with real testers

1. Put payment gateways in **sandbox mode** (store admin → Settings → Payments) and use the test SMS/courier setups available there.
2. **Hide the site from Google** while it's a test: store admin → Online store → Theme → block all search engines.
3. Fill the shop with demo data people can click around on. The demo shop script (`scripts/demo/index.ts`) **refuses to run on a production server**, and this server is one, so pick a way round it:
   ```bash
   C="docker compose -f docker-compose.prod.yml"
   $C run --rm api ./node_modules/.bin/tsx scripts/demo/index.ts --shop-host shop.com --admin-host admin.shop.com
   ```
   - **Testing with made-up data:** add `PRODUCTION_REHEARSAL=on` to `.env` and run it. It creates a made-up shop (products, orders, reviews, staff, customers). Understand the trade-off: that switch also relaxes the API's production checks elsewhere, so it is a switch for a server you are still testing — **remove it before real trading.**
   - **No demo data:** skip this and fill the shop by hand, then test with your own products. This is what a live shop needs anyway.
4. Have the team work through `TESTING_CHECKLIST.md` — that list is written for exactly this stage.

---

### Step 10 — Go live

1. Switch the gateways to **live keys**, and the couriers and SMS to live accounts.
2. Turn **off** the "block all search engines" switch.
3. **Wipe the test data before real trading** — this deletes everything, so only do it when testing is finished:
   ```bash
   cd ~/ecom
   docker compose -f docker-compose.prod.yml down -v
   ```
   Then start again (step 6), re-run `bootstrap.ts`, and add the real shop by hand (step 7). A real shop should start empty.
4. Stay on the free server while traffic is small. Moving to a paid one later is easy — everything runs in Docker.

---

### If something goes wrong

| What you see | What it usually is |
|---|---|
| `shop.com` won't load, or no padlock | DNS not pointing at the server yet (check with `nslookup`), or ports 80/443 still closed — **remember Oracle has its own Security List as well as `ufw`.** See why: `docker compose -f docker-compose.prod.yml logs caddy` |
| The API container restarts over and over | A `.env` value is still a placeholder or a local address: `logs api \| grep -A20 FATAL` names it |
| "No space left on device" | Disk full: `docker image prune -f`, and check what the backups volume is using |
| You can't sign in at `admin.shop.com` (but the storefront works) | `COOKIE_DOMAIN` doesn't match the domain, or you used a free subdomain domain — see step 1a |
| Product photos show as broken images | Wrong `S3_ACCESS_KEY`/`S3_SECRET_KEY`, or `S3_PUBLIC_URL` isn't the bucket's public address |
| Oracle says "out of capacity" | Free ARM servers are popular; retry later, or use another region. Fallback: a paid ARM server elsewhere (section 13) |

---

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
2. **Error reports (optional):** add `PUBLIC_SENTRY_DSN` too (see Monitoring).
3. **Images:** push to `main` and wait for the **Docker images** CI job. Its packages appear under the repository's "Packages".

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

## 7. Monitoring

**Error reports (Sentry, free tier):**

1. Create a project at sentry.io (platform: Node.js; one project is enough for all apps).
2. Copy its DSN into `SENTRY_DSN` in `.env`, and into the GitHub repository variable **`PUBLIC_SENTRY_DSN`**. The browser side of the web apps bakes it in at build, so push to `main` afterwards.
3. Restart: `docker compose -f docker-compose.prod.yml up -d`.

- **What reports:** the API, the worker, the backup service and the three web apps, tagged by app.
- **API errors:** carry the request ID, so a Sentry event matches the log line (`logs api | grep <requestId>`).
- **Stripped before sending:** passwords, codes, tokens, keys, cookies, the `Authorization` header, customers' emails and phones, and every URL's query string.
- **Failed backups:** report too.
- **No DSN:** nothing is sent.

**Uptime:** add a free check (e.g. UptimeRobot, Better Stack) for:

- `https://api.shop.com/readyz`: 200 when the database, Redis and the background worker are fine and emails aren't piling up. 503 lists the problems, e.g. "The background worker stopped 5 minutes ago".
- `https://shop.com`: the storefront itself.

**Team alerts:** an email that fails after every retry shows "Email couldn't be sent" in the store admin's bell (Settings → Notifications → "Email couldn't be sent" can add email or SMS). Import and export jobs tell the person who started them when they fail.

**Logs:** every service logs JSON, rotated at 5 × 10 MB. `docker compose -f docker-compose.prod.yml logs -f --tail=100 api worker`.

## 8. Updating

```bash
cd ~/ecom
docker compose -f docker-compose.prod.yml pull          # IMAGE_TAG=latest: the newest main
docker compose -f docker-compose.prod.yml up -d         # runs new migrations first, then restarts
docker image prune -f
```

**To pin a version,** set `IMAGE_TAG=<commit>` in `.env` (the 7-character commit shown in GitHub), then `pull` and `up -d`.

## 9. Rolling back

- **Code-only change:** set `IMAGE_TAG` to the previous commit, then `pull` and `up -d`.
- **Release with a database migration:** migrations don't undo themselves.
  1. Restore the last backup taken before the update (see section 6). Take one by hand just before a big update.
  2. Then start the previous `IMAGE_TAG`.

## 10. Everyday commands

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

## 11. Rehearse locally first (optional)

The same images and compose file run on a developer machine, at `http://*.ecom.localhost`:

1. Copy `.env.production.example` to `.env.rehearsal` and fill it in with throwaway values, plus `ENV_FILE=.env.rehearsal` (so the containers read it, not your dev `.env`).
2. Use `http://` addresses for the four domains, and add `PRODUCTION_REHEARSAL=on` (localhost addresses allowed).
3. Start it:
   ```bash
   docker compose -p ecom-rehearsal --env-file .env.rehearsal \
     -f docker-compose.prod.yml -f docker-compose.rehearsal.yml up -d
   ```

The rehearsal adds Mailpit (http://localhost:8026), stores files on the API's local disk (`STORAGE_DRIVER=local`, in the `uploads` volume shared by every API copy), and runs under its own project name, so it never touches the dev database. **Never set `PRODUCTION_REHEARSAL` on a real server.**

### A demo shop to look around

`scripts/demo` fills a store called **Rongtuli** with a complete, made-up fashion shop:
- logo, colours and delivery areas;
- a dressed homepage, menus, pages (About, Contact, Shipping, Returns, Size guide), 6 blog posts and 10 FAQs;
- a live and an upcoming flash sale, 4 coupons, 4 promotions and an Eid gift box;
- 23 categories, 10 invented brands and 112 products with sizes, colours and real photos (free Unsplash photos, downloaded once);
- a second storefront, **Rongtuli Outlet** (15% lower prices, same stock, its own colours);
- 4 staff, 42 customers, about 150 orders over the last 90 days in every state, and about 120 reviews.

It takes over `shop.ecom.localhost` and `admin.ecom.localhost`, and puts the Outlet on `outlet.ecom.localhost`. So that Caddy serves the Outlet, add `http://outlet.ecom.localhost` to `SHOP_DOMAINS` in `.env.rehearsal` (comma separated) and restart Caddy (`$C up -d caddy`).

```bash
C="docker compose -p ecom-rehearsal --env-file .env.rehearsal -f docker-compose.prod.yml -f docker-compose.rehearsal.yml"
$C run --rm api ./node_modules/.bin/tsx scripts/demo/index.ts
```

- **Logins (local test accounts):**
  - **shop customer:** `nusrat@rongtuli.test` / `Customer@123!` (has an order history);
  - **admin owner:** `owner@rongtuli.test` / `Rongtuli@123!`;
  - **staff:** `sabbir@` (Order Manager), `mitu@` (Customer Support), `jamal@` (Shipper), `priya@rongtuli.test` (Product Manager), all `Rongtuli-Staff-2026!`.
- **Safe to run again:** it only adds what's missing. Orders and reviews are made once, for a store with no orders yet.
- **Production:** it refuses to run on a production server.
- **Cached pages:** the storefront caches pages for a minute, so restart it (`$C restart storefront`) to see the changes at once.

**Starting clean for real data:** the demo lives only in the rehearsal's database. To empty it, stop the rehearsal and remove its volumes (`$C down -v`). That deletes everything in the rehearsal: database, photos, backups. Then start again, and create the platform owner with `scripts/bootstrap.ts` (section 5). A real server starts empty anyway.

## 12. Load test

`loadtest/` has two [k6](https://k6.io) scripts. Run them against the rehearsal or a staging copy, **never a live shop** (they place real cash-on-delivery orders):

```bash
# 50 shoppers browsing (home, list, product, search) and 3 placing orders, for about 4 minutes.
docker run --rm -i --network ecom-rehearsal_ecom -v "$PWD/loadtest:/t" grafana/k6:0.57.0 run /t/shop.k6.js
# CPU cost of one API call: a fixed rate; watch `docker stats` (CPU% ÷ RATE = cost per request).
docker run --rm -i --network ecom-rehearsal_ecom -v "$PWD/loadtest:/t" -e RATE=20 -e PATH_TO=/api/storefront/products grafana/k6:0.57.0 run /t/api-cost.k6.js
```

**Targets:** browsing p95 under 500 ms, checkout p95 under 1.5 s, under 1% errors.

**API copies (`API_REPLICAS`, default 2):** one Node process uses one core, so run one copy per core you can spare after the storefront (it renders every page) and Postgres. Caddy finds every copy by name and sends each request to the least busy one. On a 2-core server, set `API_REPLICAS=1`.

**Results on a 4-core laptop** (everything plus k6 on the same 4 cores, so this is a floor, not the server's numbers), Batch 46:

| | Browse p95 | Checkout p95 | Errors | Requests/s |
|---|---|---|---|---|
| 1 API copy | 1.02 s | 0.60 s | 0 | 25 |
| 2 API copies | 0.84 s | 0.71 s | 0 | 26 |

The machine was the limit: the storefront used the most CPU, then the API copies. Run it again on the real server before launch.

## 13. Plan: a free live test server (not started yet)
**Goal:** a real live shop on the internet, with a production database, for testing before launch. You on both computers and the QA team all use the same live data. After testing, the test data is wiped and the same server takes the real shop. Money is spent only at full launch.

### The free setup
| Need | Free option | Notes |
|---|---|---|
| **Server** | **Oracle Cloud "Always Free"**: ARM (Ampere), 4 CPU, 24 GB RAM, 200 GB disk | Above this guide's minimum (2 CPU / 4 GB). Runs `docker-compose.prod.yml` unchanged: API, worker, the four web apps, Postgres, Redis, Caddy with HTTPS. Pick the Singapore or Mumbai region |
| **Database** | **Postgres on that server**, as in sections 3–5 | A real production database, not a free hosted tier that sleeps or pauses |
| **Backups** | **Cloudflare R2**: 10 GB free | Section 6's backup service sends to S3-style storage; R2 fits with no code change. Product photos can go there too, or stay on the server's disk |
| **Email** | **Brevo** SMTP: 300 emails a day free | Order and password-reset emails |
| **Domain** | **Buy one `.com`** (about 1,200–1,500 BDT a year) | The only cost. It can become the real shop's domain. Free subdomains (DuckDNS and similar) break sign-in: the admin and API addresses can't share cookies on them |
| **Payment gateways** | Sandbox mode | With live HTTPS, gateway callbacks and webhooks work, which they can't on a local computer |

**Costs a little even while testing:**
- **SMS:** every message costs a little; the providers charge per SMS.
- **Courier test bookings:** check with each courier; some have test modes.

**Check before signing up:** Oracle's, Cloudflare's and Brevo's free limits change over time; the numbers above are from October 2026.

### Steps
1. **Your side:**
   - create the accounts: Oracle Cloud, Cloudflare (R2), Brevo;
   - buy the domain;
   - signups and payments are yours to do; nobody else should enter your card or passwords.
2. **Code side (done on 2026-11-02):** the Oracle server is ARM, and CI built images only for Intel/AMD servers. `.github/workflows/ci.yml` now sets `platforms: linux/amd64,linux/arm64` and sets up QEMU, with the job's timeout raised to 90 minutes because the ARM half is built under emulation. If that turns out too slow, the alternative is to build on the server with `scripts/build-rehearsal-images.sh`, changed to the real addresses.
3. **Deploy:** sections 2–7 of this guide, with the domain's addresses, R2 for backups and Brevo for SMTP.
4. **Test phase:**
   - run the demo shop (step 9 — on a real server it needs `PRODUCTION_REHEARSAL=on`, and that switch comes off again before trading);
   - hide the site from Google: store admin → Online store → Theme, "block all" search engines;
   - put the gateways in sandbox mode;
   - the team works through `TESTING_CHECKLIST.md`.
5. **Clean up:** `docker compose ... down -v` deletes all test data. Start again, run `bootstrap.ts`, and add the real shop by hand.
6. **Go live:**
   - switch the gateways to live keys;
   - turn off "block all";
   - move to paid hosting only when traffic needs it. Moving is easy because everything runs in Docker.

### Catches
- **Oracle signup needs a card** for checking your identity, and it isn't charged. Some cards are refused.
- **Capacity:** free ARM servers are sometimes "out of capacity" in a region; retry later, or try another region.
- **Reclaiming:** Oracle may take back a free server that sits almost unused for a week. With testers on it that's unlikely, but keep R2 backups on.
- **Fallback if Oracle doesn't work out:** a Hetzner ARM server, about 600–700 BDT a month, with the same setup.
- **Server size:** 4 CPU suits `API_REPLICAS=2` (section 12). Run the load test there before launch.
