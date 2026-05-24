#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_DIR="${ROOT_DIR}/compose"
SERVICE="${1:-}"
ACTION="${2:-up}"

# shellcheck disable=SC1091
source "${ROOT_DIR}/scripts/podman-env.sh"

if [ -f "${ROOT_DIR}/.env" ]; then
  set -a
  # shellcheck disable=SC1091
  source "${ROOT_DIR}/.env"
  set +a
fi

usage() {
  cat <<'EOF'
Usage:
  npm run modular:collector:up
  npm run modular:qdrant:up
  npm run modular:ollama:up
  bash scripts/modular-service.sh collector up
  bash scripts/modular-service.sh qdrant logs

Services:
  collector
  qdrant
  ollama

Actions:
  up
  down
  restart
  status
  logs
  pull
EOF
}

if [ -z "$SERVICE" ] || [ "$SERVICE" = "-h" ] || [ "$SERVICE" = "--help" ]; then
  usage
  exit 0
fi

case "$SERVICE" in
  collector|qdrant|ollama) ;;
  *)
    echo "Unknown modular service: ${SERVICE}" >&2
    usage >&2
    exit 1
    ;;
esac

COMPOSE_FILE="${COMPOSE_DIR}/${SERVICE}.yml"
CONTAINER_NAME="redu-os-${SERVICE}"

if [ ! -f "$COMPOSE_FILE" ]; then
  echo "Missing compose file: ${COMPOSE_FILE}" >&2
  exit 1
fi

cd "$COMPOSE_DIR"

case "$ACTION" in
  up)
    if [ "$SERVICE" = "collector" ]; then
      podman-compose -f "$COMPOSE_FILE" up -d --build
    else
      podman-compose -f "$COMPOSE_FILE" up -d
    fi
    ;;
  down)
    podman-compose -f "$COMPOSE_FILE" down
    ;;
  restart)
    podman-compose -f "$COMPOSE_FILE" down
    if [ "$SERVICE" = "collector" ]; then
      podman-compose -f "$COMPOSE_FILE" up -d --build
    else
      podman-compose -f "$COMPOSE_FILE" up -d
    fi
    ;;
  status)
    podman ps -a --filter "name=${CONTAINER_NAME}" \
      --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'
    ;;
  logs)
    podman logs --tail "${TAIL:-150}" "$CONTAINER_NAME"
    ;;
  pull)
    if [ "$SERVICE" = "collector" ]; then
      podman build -f "${ROOT_DIR}/Containerfile" -t localhost/redu-os-collector:latest "$ROOT_DIR"
    else
      podman-compose -f "$COMPOSE_FILE" pull
    fi
    ;;
  *)
    echo "Unknown action: ${ACTION}" >&2
    usage >&2
    exit 1
    ;;
esac
