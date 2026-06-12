#!/usr/bin/env bash
#
# pixelface — deploy / update on the server.
#
# Pulls the latest image published by CI to GHCR and (re)starts the stack with
# docker compose. Defaults to docker-compose.shared.yml (the app behind the
# existing shared Caddy, e.g. the padelscores one). Override the compose file
# with PIXELFACE_COMPOSE=docker-compose.yml for the self-contained stack.
#
# Usage:  ./deploy.sh
#
# Requirements: Docker + docker compose, and a public GHCR package (or a prior
# `docker login ghcr.io`).

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "${SCRIPT_DIR}"

if [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  . ./.env
  set +a
fi

COMPOSE_FILE="${PIXELFACE_COMPOSE:-docker-compose.shared.yml}"

echo "==> Updating repo (compose files, Caddyfile, scripts)"
git pull --ff-only || echo "   (git pull skipped/failed; continuing with local files)"

echo "==> Pulling latest image"
docker compose -f "${COMPOSE_FILE}" pull

echo "==> Restarting stack"
docker compose -f "${COMPOSE_FILE}" up -d

docker image prune -f >/dev/null || true
echo "==> Done (${COMPOSE_FILE}). https://${PIXELFACE_HOST:-pixelface.ojoalprecio.com}"
