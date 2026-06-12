#!/usr/bin/env bash
#
# pixelface — deploy on the server.
#
# Pulls the prebuilt image published by CI to GHCR and (re)starts the container.
# The container listens ONLY on 127.0.0.1 so your reverse proxy is the only thing
# facing the internet (it terminates TLS for ${PIXELFACE_HOST} -> here).
#
# Config comes from a local .env file (copy .env.example -> .env). Any value can
# also be overridden inline, e.g.:  PIXELFACE_TAG=<sha> ./deploy.sh
#
# Requirements on the server: Docker, and either a public GHCR package or a prior
# `docker login ghcr.io` if the package is private.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Load .env if present (does not override values already set in the environment).
if [ -f "${SCRIPT_DIR}/.env" ]; then
  set -a
  # shellcheck disable=SC1091
  . "${SCRIPT_DIR}/.env"
  set +a
fi

PIXELFACE_IMAGE="${PIXELFACE_IMAGE:-ghcr.io/davic80/pixelface}"
PIXELFACE_TAG="${PIXELFACE_TAG:-latest}"
PIXELFACE_PORT="${PIXELFACE_PORT:-8080}"
PIXELFACE_HOST="${PIXELFACE_HOST:-pixelface.ojoalprecio.com}"
NAME="pixelface"
IMAGE="${PIXELFACE_IMAGE}:${PIXELFACE_TAG}"

echo "==> Pulling ${IMAGE}"
docker pull "${IMAGE}"

echo "==> (Re)starting container '${NAME}' on 127.0.0.1:${PIXELFACE_PORT}"
docker rm -f "${NAME}" 2>/dev/null || true
docker run -d \
  --name "${NAME}" \
  --restart unless-stopped \
  -p "127.0.0.1:${PIXELFACE_PORT}:80" \
  "${IMAGE}"

echo "==> Pruning dangling images"
docker image prune -f >/dev/null || true

echo "==> Done."
echo "    pixelface is running on http://127.0.0.1:${PIXELFACE_PORT}"
echo "    Reverse proxy: ${PIXELFACE_HOST} -> 127.0.0.1:${PIXELFACE_PORT}"
