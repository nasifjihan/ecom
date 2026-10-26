$ npm -v
$ docker -v
$ docker compose version
$ node -v
$ pnpm -v

pnpm install

pnpm db:up
docker compose ps

export DATABASE_URL="postgresql://ecom:ecom_local_pw@localhost:5432/ecom_platform?schema=public&connection_limit=20&pool_timeout=0"
export DIRECT_URL="postgresql://ecom:ecom_local_pw@localhost:5432/ecom_platform"
pnpm prisma:migrate:deploy
docker exec ecom-postgres psql -U ecom -d ecom_platform -c "select count(*) from information_schema.tables where table_schema='public';"

pnpm prisma:seed

pnpm dev

http://localhost:4000/healthz -> 200   (API)
http://localhost:3100         -> 200   (storefront)
http://localhost:3101         -> 200   (store admin)
http://localhost:3102         -> 200   (super admin)
http://localhost:8025         -> 200   (Mailpit)

## Day-to-day usage
pnpm db:up            # start Postgres + Redis + Mailpit (after a reboot)
pnpm dev              # start all four apps (leave running, Ctrl+C to stop)
pnpm prisma:studio    # browse the DB at http://localhost:5555
pnpm db:down          # stop the containers when you're finished