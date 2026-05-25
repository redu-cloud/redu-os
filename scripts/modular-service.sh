#!/usr/bin/env bash
# Manage one modular service compose file.
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
  npm run modular:activepieces:up
  npm run modular:uptime:up
  bash scripts/modular-service.sh collector up
  bash scripts/modular-service.sh qdrant logs

Services:
  collector
  qdrant
  ollama
  activepieces
  uptime

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
  collector|qdrant|ollama|activepieces|uptime) ;;
  *)
    echo "Unknown modular service: ${SERVICE}" >&2
    usage >&2
    exit 1
    ;;
esac

COMPOSE_FILE="${COMPOSE_DIR}/${SERVICE}.yml"
CONTAINER_NAME="redu-os-${SERVICE}"
if [ "$SERVICE" = "uptime" ]; then
  CONTAINER_NAME="redu-os-uptime-kuma"
fi

if [ ! -f "$COMPOSE_FILE" ]; then
  echo "Missing compose file: ${COMPOSE_FILE}" >&2
  exit 1
fi

cd "$COMPOSE_DIR"

case "$ACTION" in
  up)
    if [ "$SERVICE" = "activepieces" ]; then
      "${ROOT_DIR}/scripts/activepieces-env.sh"
      set -a
      # shellcheck disable=SC1091
      source "${ROOT_DIR}/.env"
      set +a
    fi
    if [ "$SERVICE" = "uptime" ]; then
      "${ROOT_DIR}/scripts/uptime-env.sh"
      set -a
      # shellcheck disable=SC1091
      source "${ROOT_DIR}/.env"
      set +a
    fi

    if [ "$SERVICE" = "collector" ]; then
      podman-compose -f "$COMPOSE_FILE" up -d --build
    else
      podman-compose -f "$COMPOSE_FILE" up -d
    fi

    if [ "$SERVICE" = "uptime" ]; then
      "${ROOT_DIR}/scripts/setup-uptime-kuma.sh"
    fi
    ;;
  down)
    podman-compose -f "$COMPOSE_FILE" down
    ;;
  restart)
    if [ "$SERVICE" = "activepieces" ]; then
      "${ROOT_DIR}/scripts/activepieces-env.sh"
      set -a
      # shellcheck disable=SC1091
      source "${ROOT_DIR}/.env"
      set +a
    fi
    if [ "$SERVICE" = "uptime" ]; then
      "${ROOT_DIR}/scripts/uptime-env.sh"
      set -a
      # shellcheck disable=SC1091
      source "${ROOT_DIR}/.env"
      set +a
    fi

    podman-compose -f "$COMPOSE_FILE" down
    if [ "$SERVICE" = "collector" ]; then
      podman-compose -f "$COMPOSE_FILE" up -d --build
    else
      podman-compose -f "$COMPOSE_FILE" up -d
    fi

    if [ "$SERVICE" = "uptime" ]; then
      "${ROOT_DIR}/scripts/setup-uptime-kuma.sh"
    fi
    ;;
  status)
    if [ "$SERVICE" = "uptime" ]; then
      podman ps -a --filter "name=redu-os-uptime-kuma" \
        --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'
    else
      podman ps -a --filter "name=${CONTAINER_NAME}" \
        --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'
    fi
    ;;
  logs)
    if [ "$SERVICE" = "activepieces" ]; then
      for name in redu-os-activepieces redu-os-activepieces-postgres redu-os-activepieces-redis; do
        echo
        echo "==> ${name}"
        if podman container exists "$name" 2>/dev/null; then
          podman logs --tail "${TAIL:-150}" "$name"
        else
          echo "${name} is not present"
        fi
      done
    elif [ "$SERVICE" = "uptime" ]; then
      for name in redu-os-uptime-kuma redu-os-uptime-kuma-mariadb; do
        echo
        echo "==> ${name}"
        if podman container exists "$name" 2>/dev/null; then
          podman logs --tail "${TAIL:-150}" "$name"
        else
          echo "${name} is not present"
        fi
      done
    else
      podman logs --tail "${TAIL:-150}" "$CONTAINER_NAME"
    fi
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
