#!/usr/bin/env bash
# Configure one or more automation webhook URLs in .env, then recreate the
# collector so the new automation target is loaded.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${ROOT_DIR}/.env"
MOCK_PORT="${AUTOMATION_MOCK_PORT:-3010}"
MOCK_KEY="${AUTOMATION_WEBHOOK_API_KEY:-local-demo-key}"
TARGET_URL="${AUTOMATION_WEBHOOK_URL:-http://host.containers.internal:${MOCK_PORT}/webhook/reduos}"
TARGET_URLS="${AUTOMATION_WEBHOOK_URLS:-$TARGET_URL}"
TARGET_KEY="${AUTOMATION_WEBHOOK_API_KEY:-$MOCK_KEY}"

# shellcheck disable=SC1091
source "${ROOT_DIR}/scripts/podman-env.sh"

if [ ! -f "$ENV_FILE" ]; then
  echo "Missing .env. Run npm run stack:up or npm run modular:local:up first." >&2
  exit 1
fi

set_env() {
  local key="$1"
  local value="$2"

  python3 - "$ENV_FILE" "$key" "$value" <<'PY'
from pathlib import Path
import sys

path = Path(sys.argv[1])
key = sys.argv[2]
value = sys.argv[3]

lines = path.read_text().splitlines()
out = []
changed = False

for line in lines:
    if line.startswith(key + "=") or line.startswith("#" + key + "="):
        out.append(f"{key}={value}")
        changed = True
    else:
        out.append(line)

if not changed:
    out.append(f"{key}={value}")

path.write_text("\n".join(out) + "\n")
PY
}

set_env "AUTOMATION_WEBHOOK_URL" "$TARGET_URL"
set_env "AUTOMATION_WEBHOOK_URLS" "$TARGET_URLS"
set_env "AUTOMATION_WEBHOOK_API_KEY" "$TARGET_KEY"

echo "Enabled automation webhook in .env:"
echo "  AUTOMATION_WEBHOOK_URL=${TARGET_URL}"
echo "  AUTOMATION_WEBHOOK_URLS=${TARGET_URLS}"
echo "  AUTOMATION_WEBHOOK_API_KEY=${TARGET_KEY}"

if ! podman container exists redu-os-collector >/dev/null 2>&1; then
  echo "Collector is not running. Start the collector before testing automation."
  exit 0
fi

working_dir="$(podman inspect -f '{{ index .Config.Labels "com.docker.compose.project.working_dir" }}' redu-os-collector 2>/dev/null || true)"
config_files="$(podman inspect -f '{{ index .Config.Labels "com.docker.compose.project.config_files" }}' redu-os-collector 2>/dev/null || true)"

echo "Recreating collector so automation env takes effect..."

if [[ "$working_dir" == "${ROOT_DIR}/compose" ]] || [[ "$config_files" == *"collector.same-machine.yml"* ]]; then
  cd "${ROOT_DIR}/compose"
  podman-compose -f collector.yml -f collector.same-machine.yml down
  podman-compose -f collector.yml -f collector.same-machine.yml up -d --build
else
  cd "$ROOT_DIR"
  podman rm -f redu-os-collector >/dev/null 2>&1 || true
  podman-compose -f podman-compose.yml up -d --build collector
fi

echo "Collector recreated."
if [[ "$TARGET_URL" == *":${MOCK_PORT}/webhook/reduos"* ]]; then
  echo "Start the mock receiver in another terminal:"
  echo "  npm run automation:mock"
else
  echo "Send an event to test the configured webhook:"
  echo "  npm run demo:onboarding"
fi
