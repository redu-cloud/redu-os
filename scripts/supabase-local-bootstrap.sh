#!/usr/bin/env bash
# Prepare official Supabase self-hosting files and local reduOS .env values.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOCAL_DIR="${ROOT_DIR}/.local"
APP_DIR="${LOCAL_DIR}/supabase"
SRC_DIR="${LOCAL_DIR}/supabase-src"
DOCKER_DIR="${SRC_DIR}/docker"
LOCAL_ENV="${LOCAL_DIR}/supabase-local.env"

# shellcheck disable=SC1091
source "${ROOT_DIR}/scripts/podman-env.sh"

mkdir -p "$LOCAL_DIR" "$APP_DIR"

need_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

for cmd in git rsync openssl python3 podman podman-compose curl; do
  need_cmd "$cmd"
done

generate_hex() {
  openssl rand -hex "$1"
}

generate_jwt() {
  local role="$1"
  local secret="$2"

  python3 - "$role" "$secret" <<'PY'
import base64
import hashlib
import hmac
import json
import sys
import time

role = sys.argv[1]
secret = sys.argv[2].encode()

def b64url(data):
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()

header = {"alg": "HS256", "typ": "JWT"}
payload = {
    "role": role,
    "iss": "supabase",
    "iat": int(time.time()),
    "exp": 2524608000,
}

signing_input = (
    b64url(json.dumps(header, separators=(",", ":")).encode())
    + "."
    + b64url(json.dumps(payload, separators=(",", ":")).encode())
)

signature = hmac.new(secret, signing_input.encode(), hashlib.sha256).digest()
print(signing_input + "." + b64url(signature))
PY
}

if [ ! -f "$LOCAL_ENV" ]; then
  cat > "$LOCAL_ENV" <<EOF
SUPABASE_PUBLIC_URL=http://127.0.0.1:8000
SUPABASE_STUDIO_URL=http://127.0.0.1:3000
SUPABASE_KONG_HTTP_PORT=8000
SUPABASE_KONG_HTTPS_PORT=8443
SUPABASE_STUDIO_PORT=3000
SUPABASE_DB_PORT=5432
SUPABASE_POOLER_PORT=6543
DASHBOARD_USERNAME=admin
DASHBOARD_PASSWORD=ChangeMeStrong123!
POSTGRES_DB=postgres
POSTGRES_PASSWORD=AUTO_GENERATE
JWT_SECRET=AUTO_GENERATE
ANON_KEY=AUTO_GENERATE
SERVICE_ROLE_KEY=AUTO_GENERATE
SECRET_KEY_BASE=AUTO_GENERATE
VAULT_ENC_KEY=AUTO_GENERATE
STUDIO_DEFAULT_ORGANIZATION=redu.cloud
STUDIO_DEFAULT_PROJECT=reduOS_Local_Backend
COLLECTOR_API_KEY=change-me-please
QDRANT_API_KEY=AUTO_GENERATE
OLLAMA_MODEL=deepseek-r1:1.5b
OLLAMA_EMBED_MODEL=nomic-embed-text
OLLAMA_PORT=11435
EOF
  chmod 600 "$LOCAL_ENV"
fi

python3 - "$LOCAL_ENV" <<'PY'
from pathlib import Path
import sys

path = Path(sys.argv[1])
lines = []
for line in path.read_text().splitlines():
    if line.startswith("STUDIO_DEFAULT_PROJECT="):
        key, value = line.split("=", 1)
        line = f"{key}={value.replace(' ', '_')}"
    lines.append(line)
path.write_text("\n".join(lines) + "\n")
PY

set -a
# shellcheck disable=SC1090
source "$LOCAL_ENV"
set +a

OLLAMA_MODEL="${OLLAMA_MODEL:-deepseek-r1:1.5b}"
OLLAMA_EMBED_MODEL="${OLLAMA_EMBED_MODEL:-nomic-embed-text}"
OLLAMA_PORT="${OLLAMA_PORT:-11435}"

if [ "${POSTGRES_PASSWORD:-AUTO_GENERATE}" = "AUTO_GENERATE" ] || [ -z "${POSTGRES_PASSWORD:-}" ]; then
  POSTGRES_PASSWORD="$(generate_hex 24)"
fi

if [ "${JWT_SECRET:-AUTO_GENERATE}" = "AUTO_GENERATE" ] || [ -z "${JWT_SECRET:-}" ]; then
  JWT_SECRET="$(generate_hex 64)"
fi

if [ "${ANON_KEY:-AUTO_GENERATE}" = "AUTO_GENERATE" ] || [ -z "${ANON_KEY:-}" ]; then
  ANON_KEY="$(generate_jwt anon "$JWT_SECRET")"
fi

if [ "${SERVICE_ROLE_KEY:-AUTO_GENERATE}" = "AUTO_GENERATE" ] || [ -z "${SERVICE_ROLE_KEY:-}" ]; then
  SERVICE_ROLE_KEY="$(generate_jwt service_role "$JWT_SECRET")"
fi

if [ "${SECRET_KEY_BASE:-AUTO_GENERATE}" = "AUTO_GENERATE" ] || [ -z "${SECRET_KEY_BASE:-}" ]; then
  SECRET_KEY_BASE="$(generate_hex 64)"
fi

if [ "${VAULT_ENC_KEY:-AUTO_GENERATE}" = "AUTO_GENERATE" ] || [ -z "${VAULT_ENC_KEY:-}" ]; then
  VAULT_ENC_KEY="$(generate_hex 16)"
fi

if [ "${QDRANT_API_KEY:-AUTO_GENERATE}" = "AUTO_GENERATE" ] || [ -z "${QDRANT_API_KEY:-}" ]; then
  QDRANT_API_KEY="$(generate_hex 32)"
fi

cat > "$LOCAL_ENV" <<EOF
SUPABASE_PUBLIC_URL=${SUPABASE_PUBLIC_URL}
SUPABASE_STUDIO_URL=${SUPABASE_STUDIO_URL}
SUPABASE_KONG_HTTP_PORT=${SUPABASE_KONG_HTTP_PORT}
SUPABASE_KONG_HTTPS_PORT=${SUPABASE_KONG_HTTPS_PORT}
SUPABASE_STUDIO_PORT=${SUPABASE_STUDIO_PORT}
SUPABASE_DB_PORT=${SUPABASE_DB_PORT}
SUPABASE_POOLER_PORT=${SUPABASE_POOLER_PORT}
DASHBOARD_USERNAME=${DASHBOARD_USERNAME}
DASHBOARD_PASSWORD=${DASHBOARD_PASSWORD}
POSTGRES_DB=${POSTGRES_DB}
POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
JWT_SECRET=${JWT_SECRET}
ANON_KEY=${ANON_KEY}
SERVICE_ROLE_KEY=${SERVICE_ROLE_KEY}
SECRET_KEY_BASE=${SECRET_KEY_BASE}
VAULT_ENC_KEY=${VAULT_ENC_KEY}
STUDIO_DEFAULT_ORGANIZATION=${STUDIO_DEFAULT_ORGANIZATION}
STUDIO_DEFAULT_PROJECT=${STUDIO_DEFAULT_PROJECT}
COLLECTOR_API_KEY=${COLLECTOR_API_KEY}
QDRANT_API_KEY=${QDRANT_API_KEY}
OLLAMA_MODEL=${OLLAMA_MODEL}
OLLAMA_EMBED_MODEL=${OLLAMA_EMBED_MODEL}
OLLAMA_PORT=${OLLAMA_PORT}
EOF
chmod 600 "$LOCAL_ENV"

echo "Fetching official Supabase self-hosting compose files..."
if [ ! -d "$SRC_DIR/.git" ]; then
  rm -rf "$SRC_DIR"
  git clone --depth 1 https://github.com/supabase/supabase.git "$SRC_DIR"
else
  git -C "$SRC_DIR" fetch --depth 1 origin master
  git -C "$SRC_DIR" reset --hard origin/master
fi

if [ ! -d "$DOCKER_DIR" ]; then
  echo "Could not find Supabase docker directory at $DOCKER_DIR" >&2
  exit 1
fi

rsync -a --delete \
  --exclude '/volumes/db/data/' \
  --exclude '/volumes/storage/' \
  --exclude '/volumes/functions/' \
  "$DOCKER_DIR"/ "$APP_DIR"/
cp "$APP_DIR/.env.example" "$APP_DIR/.env"

set_env() {
  local key="$1"
  local value="$2"

  python3 - "$APP_DIR/.env" "$key" "$value" <<'PY'
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

set_env POSTGRES_PASSWORD "$POSTGRES_PASSWORD"
set_env POSTGRES_DB "$POSTGRES_DB"
set_env JWT_SECRET "$JWT_SECRET"
set_env PGRST_JWT_SECRET "$JWT_SECRET"
set_env ANON_KEY "$ANON_KEY"
set_env SERVICE_ROLE_KEY "$SERVICE_ROLE_KEY"
set_env DASHBOARD_USERNAME "$DASHBOARD_USERNAME"
set_env DASHBOARD_PASSWORD "$DASHBOARD_PASSWORD"
set_env SECRET_KEY_BASE "$SECRET_KEY_BASE"
set_env VAULT_ENC_KEY "$VAULT_ENC_KEY"
set_env SITE_URL "$SUPABASE_PUBLIC_URL"
set_env API_EXTERNAL_URL "$SUPABASE_PUBLIC_URL"
set_env SUPABASE_PUBLIC_URL "$SUPABASE_PUBLIC_URL"
set_env STUDIO_DEFAULT_ORGANIZATION "$STUDIO_DEFAULT_ORGANIZATION"
set_env STUDIO_DEFAULT_PROJECT "$STUDIO_DEFAULT_PROJECT"
set_env KONG_HTTP_PORT "$SUPABASE_KONG_HTTP_PORT"
set_env KONG_HTTPS_PORT "$SUPABASE_KONG_HTTPS_PORT"
set_env STUDIO_PORT "$SUPABASE_STUDIO_PORT"
set_env POSTGRES_PORT "$SUPABASE_DB_PORT"
set_env POOLER_PROXY_PORT_TRANSACTION "$SUPABASE_POOLER_PORT"
set_env ENABLE_EMAIL_SIGNUP "true"
set_env ENABLE_ANONYMOUS_USERS "false"
set_env DISABLE_SIGNUP "false"
set_env ENABLE_EMAIL_AUTOCONFIRM "true"
set_env SMTP_ADMIN_EMAIL "admin@example.com"
set_env SMTP_HOST ""
set_env SMTP_PORT "587"
set_env SMTP_USER ""
set_env SMTP_PASS ""
set_env SMTP_SENDER_NAME "reduOS Local Supabase"
set_env LOGFLARE_PUBLIC_ACCESS_TOKEN "$(generate_hex 24)"
set_env LOGFLARE_PRIVATE_ACCESS_TOKEN "$(generate_hex 24)"
set_env POOLER_TENANT_ID "redu-os-local"

chmod 600 "$APP_DIR/.env"

sed -i \
  -e 's#image: supabase/#image: docker.io/supabase/#g' \
  -e 's#image: postgrest/#image: docker.io/postgrest/#g' \
  -e 's#image: kong/kong:#image: docker.io/kong/kong:#g' \
  -e 's#image: kong:#image: docker.io/kong/kong:#g' \
  -e 's#image: redis:#image: docker.io/library/redis:#g' \
  -e 's#image: postgres:#image: docker.io/library/postgres:#g' \
  -e 's#image: timberio/#image: docker.io/timberio/#g' \
  -e 's#image: darthsim/#image: docker.io/darthsim/#g' \
  "$APP_DIR/docker-compose.yml"

python3 - "$APP_DIR/docker-compose.yml" <<'PY'
from pathlib import Path
import sys

p = Path(sys.argv[1])
text = p.read_text()
text = text.replace(
    "PGRST_JWT_SECRET: ${JWT_JWKS:-${JWT_SECRET}}",
    "PGRST_JWT_SECRET: ${JWT_SECRET}",
)
p.write_text(text)
PY

python3 - "$APP_DIR/docker-compose.yml" <<'PY'
from pathlib import Path
import sys

p = Path(sys.argv[1])
text = p.read_text()

needle = """    depends_on:
      analytics:
        condition: service_healthy
    environment:
"""

replacement = """    depends_on:
      analytics:
        condition: service_healthy
    ports:
      - ${STUDIO_PORT}:3000/tcp
    environment:
"""

if "container_name: supabase-studio" in text and "      - ${STUDIO_PORT}:3000/tcp" not in text:
    text = text.replace(needle, replacement, 1)

p.write_text(text)
PY

python3 - "$APP_DIR/docker-compose.yml" <<'PY'
from pathlib import Path
import sys

p = Path(sys.argv[1])
lines = p.read_text().splitlines()
out = []
i = 0

while i < len(lines):
    if lines[i] == "  vector:":
        i += 1
        while i < len(lines):
            line = lines[i]
            if line.startswith("  ") and not line.startswith("    ") and line.strip():
                break
            i += 1
        continue
    out.append(lines[i])
    i += 1

p.write_text("\n".join(out) + "\n")
PY

cat > "$ROOT_DIR/.env" <<EOF
PORT=3005
NODE_ENV=production
COLLECTOR_API_KEY=${COLLECTOR_API_KEY}

SUPABASE_URL=${SUPABASE_PUBLIC_URL}
SUPABASE_SERVICE_ROLE_KEY=${SERVICE_ROLE_KEY}

QDRANT_ENABLED=false
QDRANT_URL=http://127.0.0.1:6333
QDRANT_API_KEY=${QDRANT_API_KEY}
QDRANT_COLLECTION=redu_os_events
QDRANT_FALLBACK_EMBEDDINGS=true

AI_ENABLED=true
DEBUG_AI_RAW=false
OLLAMA_URL=http://127.0.0.1:${OLLAMA_PORT}
OLLAMA_PORT=${OLLAMA_PORT}
OLLAMA_MODEL=${OLLAMA_MODEL}
OLLAMA_EMBED_MODEL=${OLLAMA_EMBED_MODEL}

AUTOMATION_WEBHOOK_URL=
AUTOMATION_WEBHOOK_API_KEY=

MAX_EVENT_MESSAGE_LENGTH=8000
EOF
chmod 600 "$ROOT_DIR/.env"

echo "Local Supabase files are ready in $APP_DIR"
echo "Collector env was written to $ROOT_DIR/.env"
