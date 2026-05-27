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
  npm run modular:umami:up
  npm run modular:glitchtip:up
  npm run modular:listmonk:up
  npm run modular:zammad:up
  npm run modular:langfuse:up
  npm run modular:litellm:up
  npm run modular:langgraph:up
  npm run modular:dashboard:up
  bash scripts/modular-service.sh collector up
  bash scripts/modular-service.sh qdrant logs

Services:
  collector
  qdrant
  ollama
  activepieces
  uptime
  umami
  glitchtip
  listmonk
  zammad
  langfuse
  litellm
  langgraph
  dashboard

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
  collector|qdrant|ollama|activepieces|uptime|umami|glitchtip|listmonk|zammad|langfuse|litellm|langgraph|dashboard) ;;
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
if [ "$SERVICE" = "zammad" ]; then
  COMPOSE_FILE="${ROOT_DIR}/.local/zammad/docker-compose.yml"
  CONTAINER_NAME="zammad_zammad-railsserver_1"
fi

if [ "$SERVICE" != "zammad" ] && [ ! -f "$COMPOSE_FILE" ]; then
  echo "Missing compose file: ${COMPOSE_FILE}" >&2
  exit 1
fi

if [ "$SERVICE" = "zammad" ]; then
  mkdir -p "${ROOT_DIR}/.local"
  cd "${ROOT_DIR}/.local"
else
  cd "$COMPOSE_DIR"
fi

case "$ACTION" in
  up)
    if [ "$SERVICE" = "zammad" ]; then
      "${ROOT_DIR}/scripts/zammad-env.sh"
      cd "${ROOT_DIR}/.local/zammad"
      set -a
      # shellcheck disable=SC1091
      source .env
      set +a
      zammad_compose=(-f docker-compose.yml)
      if [ "${ELASTICSEARCH_ENABLED:-false}" = "false" ]; then
        zammad_compose+=(-f scenarios/disable-elasticsearch-service.yml)
      fi
      podman-compose --env-file .env "${zammad_compose[@]}" pull \
        zammad-postgresql zammad-redis zammad-memcached zammad-init \
        zammad-railsserver zammad-scheduler zammad-websocket zammad-nginx
      podman-compose --env-file .env "${zammad_compose[@]}" up -d
      "${ROOT_DIR}/scripts/setup-zammad.sh"
      exit 0
    fi
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
    if [ "$SERVICE" = "umami" ]; then
      "${ROOT_DIR}/scripts/umami-env.sh"
      set -a
      # shellcheck disable=SC1091
      source "${ROOT_DIR}/.env"
      set +a
    fi
    if [ "$SERVICE" = "glitchtip" ]; then
      "${ROOT_DIR}/scripts/glitchtip-env.sh"
      set -a
      # shellcheck disable=SC1091
      source "${ROOT_DIR}/.env"
      set +a
    fi
    if [ "$SERVICE" = "listmonk" ]; then
      "${ROOT_DIR}/scripts/listmonk-env.sh"
      set -a
      # shellcheck disable=SC1091
      source "${ROOT_DIR}/.env"
      set +a
    fi
    if [ "$SERVICE" = "langfuse" ]; then
      "${ROOT_DIR}/scripts/langfuse-env.sh"
      set -a
      # shellcheck disable=SC1091
      source "${ROOT_DIR}/.env"
      set +a
    fi
    if [ "$SERVICE" = "litellm" ]; then
      "${ROOT_DIR}/scripts/litellm-env.sh"
      set -a
      # shellcheck disable=SC1091
      source "${ROOT_DIR}/.env"
      set +a
    fi
    if [ "$SERVICE" = "langgraph" ]; then
      "${ROOT_DIR}/scripts/langgraph-env.sh"
      set -a
      # shellcheck disable=SC1091
      source "${ROOT_DIR}/.env"
      set +a
    fi

    if [ "$SERVICE" = "listmonk" ]; then
      podman-compose -f "$COMPOSE_FILE" up -d listmonk-postgres
      "${ROOT_DIR}/scripts/setup-listmonk.sh"
      podman-compose -f "$COMPOSE_FILE" up -d listmonk
      "${ROOT_DIR}/scripts/setup-listmonk.sh"
    elif [ "$SERVICE" = "collector" ] || [ "$SERVICE" = "langgraph" ] || [ "$SERVICE" = "dashboard" ]; then
      podman-compose -f "$COMPOSE_FILE" up -d --build
    else
      podman-compose -f "$COMPOSE_FILE" up -d
    fi

    if [ "$SERVICE" = "uptime" ]; then
      "${ROOT_DIR}/scripts/setup-uptime-kuma.sh"
    fi
    if [ "$SERVICE" = "umami" ]; then
      "${ROOT_DIR}/scripts/setup-umami.sh"
    fi
    if [ "$SERVICE" = "glitchtip" ]; then
      "${ROOT_DIR}/scripts/setup-glitchtip.sh"
    fi
    if [ "$SERVICE" = "langfuse" ]; then
      "${ROOT_DIR}/scripts/setup-langfuse.sh"
      if podman container exists redu-os-collector 2>/dev/null; then
        echo "Restarting same-machine collector with Langfuse tracing enabled..."
        podman-compose -f "${COMPOSE_DIR}/collector.yml" -f "${COMPOSE_DIR}/collector.same-machine.yml" up -d --build
      fi
    fi
    if [ "$SERVICE" = "litellm" ]; then
      "${ROOT_DIR}/scripts/setup-litellm.sh"
      if podman container exists redu-os-collector 2>/dev/null; then
        echo "Restarting same-machine collector with LiteLLM provider enabled..."
        podman-compose -f "${COMPOSE_DIR}/collector.yml" -f "${COMPOSE_DIR}/collector.same-machine.yml" up -d --build
      fi
    fi
    if [ "$SERVICE" = "langgraph" ]; then
      "${ROOT_DIR}/scripts/setup-langgraph.sh"
    fi
    ;;
  down)
    if [ "$SERVICE" = "zammad" ]; then
      "${ROOT_DIR}/scripts/zammad-env.sh" >/dev/null
      cd "${ROOT_DIR}/.local/zammad"
      set -a
      # shellcheck disable=SC1091
      source .env
      set +a
      zammad_compose=(-f docker-compose.yml)
      if [ "${ELASTICSEARCH_ENABLED:-false}" = "false" ]; then
        zammad_compose+=(-f scenarios/disable-elasticsearch-service.yml)
      fi
      podman-compose --env-file .env "${zammad_compose[@]}" down
      podman rm -f zammad_zammad-elasticsearch_1 >/dev/null 2>&1 || true
    else
      podman-compose -f "$COMPOSE_FILE" down
    fi
    ;;
  restart)
    if [ "$SERVICE" = "zammad" ]; then
      "${ROOT_DIR}/scripts/zammad-env.sh"
      cd "${ROOT_DIR}/.local/zammad"
      set -a
      # shellcheck disable=SC1091
      source .env
      set +a
      zammad_compose=(-f docker-compose.yml)
      if [ "${ELASTICSEARCH_ENABLED:-false}" = "false" ]; then
        zammad_compose+=(-f scenarios/disable-elasticsearch-service.yml)
      fi
      podman-compose --env-file .env "${zammad_compose[@]}" down
      podman-compose --env-file .env "${zammad_compose[@]}" up -d
      "${ROOT_DIR}/scripts/setup-zammad.sh"
      exit 0
    fi
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
    if [ "$SERVICE" = "umami" ]; then
      "${ROOT_DIR}/scripts/umami-env.sh"
      set -a
      # shellcheck disable=SC1091
      source "${ROOT_DIR}/.env"
      set +a
    fi
    if [ "$SERVICE" = "glitchtip" ]; then
      "${ROOT_DIR}/scripts/glitchtip-env.sh"
      set -a
      # shellcheck disable=SC1091
      source "${ROOT_DIR}/.env"
      set +a
    fi
    if [ "$SERVICE" = "listmonk" ]; then
      "${ROOT_DIR}/scripts/listmonk-env.sh"
      set -a
      # shellcheck disable=SC1091
      source "${ROOT_DIR}/.env"
      set +a
    fi
    if [ "$SERVICE" = "langfuse" ]; then
      "${ROOT_DIR}/scripts/langfuse-env.sh"
      set -a
      # shellcheck disable=SC1091
      source "${ROOT_DIR}/.env"
      set +a
    fi
    if [ "$SERVICE" = "litellm" ]; then
      "${ROOT_DIR}/scripts/litellm-env.sh"
      set -a
      # shellcheck disable=SC1091
      source "${ROOT_DIR}/.env"
      set +a
    fi
    if [ "$SERVICE" = "langgraph" ]; then
      "${ROOT_DIR}/scripts/langgraph-env.sh"
      set -a
      # shellcheck disable=SC1091
      source "${ROOT_DIR}/.env"
      set +a
    fi

    podman-compose -f "$COMPOSE_FILE" down
    if [ "$SERVICE" = "listmonk" ]; then
      podman-compose -f "$COMPOSE_FILE" up -d listmonk-postgres
      "${ROOT_DIR}/scripts/setup-listmonk.sh"
      podman-compose -f "$COMPOSE_FILE" up -d listmonk
      "${ROOT_DIR}/scripts/setup-listmonk.sh"
    elif [ "$SERVICE" = "collector" ] || [ "$SERVICE" = "langgraph" ] || [ "$SERVICE" = "dashboard" ]; then
      podman-compose -f "$COMPOSE_FILE" up -d --build
    else
      podman-compose -f "$COMPOSE_FILE" up -d
    fi

    if [ "$SERVICE" = "uptime" ]; then
      "${ROOT_DIR}/scripts/setup-uptime-kuma.sh"
    fi
    if [ "$SERVICE" = "umami" ]; then
      "${ROOT_DIR}/scripts/setup-umami.sh"
    fi
    if [ "$SERVICE" = "glitchtip" ]; then
      "${ROOT_DIR}/scripts/setup-glitchtip.sh"
    fi
    if [ "$SERVICE" = "langfuse" ]; then
      "${ROOT_DIR}/scripts/setup-langfuse.sh"
      if podman container exists redu-os-collector 2>/dev/null; then
        echo "Restarting same-machine collector with Langfuse tracing enabled..."
        podman-compose -f "${COMPOSE_DIR}/collector.yml" -f "${COMPOSE_DIR}/collector.same-machine.yml" up -d --build
      fi
    fi
    if [ "$SERVICE" = "litellm" ]; then
      "${ROOT_DIR}/scripts/setup-litellm.sh"
      if podman container exists redu-os-collector 2>/dev/null; then
        echo "Restarting same-machine collector with LiteLLM provider enabled..."
        podman-compose -f "${COMPOSE_DIR}/collector.yml" -f "${COMPOSE_DIR}/collector.same-machine.yml" up -d --build
      fi
    fi
    if [ "$SERVICE" = "langgraph" ]; then
      "${ROOT_DIR}/scripts/setup-langgraph.sh"
    fi
    ;;
  status)
    if [ "$SERVICE" = "zammad" ]; then
      podman ps -a --filter "name=zammad_" \
        --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'
    elif [ "$SERVICE" = "uptime" ]; then
      podman ps -a --filter "name=redu-os-uptime-kuma" \
        --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'
    elif [ "$SERVICE" = "langfuse" ]; then
      podman ps -a --filter "name=redu-os-langfuse" \
        --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'
    elif [ "$SERVICE" = "litellm" ]; then
      podman ps -a --filter "name=redu-os-litellm" \
        --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'
    elif [ "$SERVICE" = "langgraph" ]; then
      podman ps -a --filter "name=redu-os-langgraph" \
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
    elif [ "$SERVICE" = "umami" ]; then
      for name in redu-os-umami redu-os-umami-postgres; do
        echo
        echo "==> ${name}"
        if podman container exists "$name" 2>/dev/null; then
          podman logs --tail "${TAIL:-150}" "$name"
        else
          echo "${name} is not present"
        fi
      done
    elif [ "$SERVICE" = "glitchtip" ]; then
      for name in redu-os-glitchtip redu-os-glitchtip-postgres redu-os-glitchtip-redis; do
        echo
        echo "==> ${name}"
        if podman container exists "$name" 2>/dev/null; then
          podman logs --tail "${TAIL:-150}" "$name"
        else
          echo "${name} is not present"
        fi
      done
    elif [ "$SERVICE" = "listmonk" ]; then
      for name in redu-os-listmonk redu-os-listmonk-postgres; do
        echo
        echo "==> ${name}"
        if podman container exists "$name" 2>/dev/null; then
          podman logs --tail "${TAIL:-150}" "$name"
        else
          echo "${name} is not present"
        fi
      done
    elif [ "$SERVICE" = "zammad" ]; then
      for name in zammad_zammad-nginx_1 zammad_zammad-railsserver_1 zammad_zammad-scheduler_1 zammad_zammad-websocket_1 zammad_zammad-postgresql_1 zammad_zammad-redis_1 zammad_zammad-memcached_1; do
        echo
        echo "==> ${name}"
        if podman container exists "$name" 2>/dev/null; then
          podman logs --tail "${TAIL:-150}" "$name"
        else
          echo "${name} is not present"
        fi
      done
    elif [ "$SERVICE" = "langfuse" ]; then
      for name in redu-os-langfuse-web redu-os-langfuse-worker redu-os-langfuse-postgres redu-os-langfuse-clickhouse redu-os-langfuse-minio redu-os-langfuse-redis; do
        echo
        echo "==> ${name}"
        if podman container exists "$name" 2>/dev/null; then
          podman logs --tail "${TAIL:-150}" "$name"
        else
          echo "${name} is not present"
        fi
      done
    elif [ "$SERVICE" = "litellm" ]; then
      for name in redu-os-litellm redu-os-litellm-postgres; do
        echo
        echo "==> ${name}"
        if podman container exists "$name" 2>/dev/null; then
          podman logs --tail "${TAIL:-150}" "$name"
        else
          echo "${name} is not present"
        fi
      done
    elif [ "$SERVICE" = "langgraph" ]; then
      echo
      echo "==> redu-os-langgraph"
      if podman container exists redu-os-langgraph 2>/dev/null; then
        podman logs --tail "${TAIL:-150}" redu-os-langgraph
      else
        echo "redu-os-langgraph is not present"
      fi
    elif [ "$SERVICE" = "dashboard" ]; then
      echo
      echo "==> redu-os-dashboard"
      if podman container exists redu-os-dashboard 2>/dev/null; then
        podman logs --tail "${TAIL:-150}" redu-os-dashboard
      else
        echo "redu-os-dashboard is not present"
      fi
    else
      podman logs --tail "${TAIL:-150}" "$CONTAINER_NAME"
    fi
    ;;
  pull)
    if [ "$SERVICE" = "zammad" ]; then
      "${ROOT_DIR}/scripts/zammad-env.sh"
      cd "${ROOT_DIR}/.local/zammad"
      set -a
      # shellcheck disable=SC1091
      source .env
      set +a
      zammad_compose=(-f docker-compose.yml)
      if [ "${ELASTICSEARCH_ENABLED:-false}" = "false" ]; then
        zammad_compose+=(-f scenarios/disable-elasticsearch-service.yml)
      fi
      podman-compose --env-file .env "${zammad_compose[@]}" pull \
        zammad-postgresql zammad-redis zammad-memcached zammad-init \
        zammad-railsserver zammad-scheduler zammad-websocket zammad-nginx
    elif [ "$SERVICE" = "collector" ]; then
      podman build -f "${ROOT_DIR}/Containerfile" -t localhost/redu-os-collector:latest "$ROOT_DIR"
    elif [ "$SERVICE" = "langfuse" ]; then
      "${ROOT_DIR}/scripts/langfuse-env.sh"
      podman-compose -f "$COMPOSE_FILE" pull
    elif [ "$SERVICE" = "litellm" ]; then
      "${ROOT_DIR}/scripts/litellm-env.sh"
      podman-compose -f "$COMPOSE_FILE" pull
    elif [ "$SERVICE" = "langgraph" ]; then
      podman build -f "${ROOT_DIR}/langgraph-app/Containerfile" -t localhost/redu-os-langgraph:latest "${ROOT_DIR}/langgraph-app"
    elif [ "$SERVICE" = "dashboard" ]; then
      podman build -f "${ROOT_DIR}/Containerfile.dashboard" -t localhost/redu-os-dashboard:latest "$ROOT_DIR"
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
