#!/usr/bin/env bash
# Builds the images the local production copy runs (docker-compose.rehearsal.yml), from this checkout.
#   bash scripts/build-rehearsal-images.sh                 # all four
#   bash scripts/build-rehearsal-images.sh api storefront  # only these (api, storefront, store-admin, super-admin)
# The web images bake in the rehearsal's addresses (*.ecom.localhost). A real server's images come from CI.
set -euo pipefail
cd "$(dirname "$0")/.."

web_args=(
  --build-arg NEXT_PUBLIC_API_BASE_URL=http://api.ecom.localhost/api
  --build-arg NEXT_PUBLIC_SITE_URL=http://shop.ecom.localhost
  --build-arg NEXT_PUBLIC_STOREFRONT_URL=http://shop.ecom.localhost
  --build-arg NEXT_PUBLIC_STORE_ADMIN_URL=http://admin.ecom.localhost/login
)

build() {
  echo "==> $1"
  case "$1" in
    api) docker build -f apps/api/Dockerfile -t ghcr.io/local/ecom-api:rehearsal . ;;
    storefront) docker build -f docker/web.Dockerfile --build-arg APP=storefront-fashion "${web_args[@]}" -t ghcr.io/local/ecom-storefront:rehearsal . ;;
    store-admin | super-admin) docker build -f docker/web.Dockerfile --build-arg APP="$1" "${web_args[@]}" -t "ghcr.io/local/ecom-$1:rehearsal" . ;;
    *) echo "Unknown image '$1' (use api, storefront, store-admin, super-admin)" >&2; exit 1 ;;
  esac
}

# One at a time: building all four at once can run Docker Desktop out of memory.
for image in "${@:-api storefront store-admin super-admin}"; do
  for one in $image; do build "$one"; done
done
echo "Done. Start or restart: docker compose -p ecom-rehearsal --env-file .env.rehearsal -f docker-compose.prod.yml -f docker-compose.rehearsal.yml up -d"
