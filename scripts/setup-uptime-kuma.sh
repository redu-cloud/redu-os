#!/usr/bin/env bash
# Create or verify the local Uptime Kuma owner account.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${ROOT_DIR}/.env"

# shellcheck disable=SC1091
source "${ROOT_DIR}/scripts/podman-env.sh"

if [ ! -f "$ENV_FILE" ]; then
  echo "Missing .env. Run npm run modular:uptime:up first." >&2
  exit 1
fi

"${ROOT_DIR}/scripts/uptime-env.sh" >/dev/null

set -a
# shellcheck disable=SC1091
source "$ENV_FILE"
set +a

KUMA_URL="${UPTIME_KUMA_INTERNAL_URL:-http://127.0.0.1:3001}"
KUMA_ADMIN_USERNAME="${UPTIME_KUMA_ADMIN_USERNAME:-admin}"
KUMA_ADMIN_PASSWORD="${UPTIME_KUMA_ADMIN_PASSWORD:-ChangeMeStrong123}"

if ! podman container exists redu-os-uptime-kuma 2>/dev/null; then
  echo "Uptime Kuma container is not present. Run npm run modular:uptime:up first." >&2
  exit 1
fi

echo "Waiting for Uptime Kuma..."
for attempt in $(seq 1 60); do
  if curl -fsS "${UPTIME_KUMA_URL:-http://127.0.0.1:3001}" >/dev/null 2>&1; then
    break
  fi

  if [ "$attempt" = "60" ]; then
    echo "Uptime Kuma did not become ready in time." >&2
    exit 1
  fi

  sleep 2
done

echo "Creating or verifying Uptime Kuma owner account..."

run_setup() {
  podman exec -i \
    -e KUMA_URL="$KUMA_URL" \
    -e KUMA_ADMIN_USERNAME="$KUMA_ADMIN_USERNAME" \
    -e KUMA_ADMIN_PASSWORD="$KUMA_ADMIN_PASSWORD" \
    redu-os-uptime-kuma \
    node <<'NODE'
const { io } = require("socket.io-client");

const url = process.env.KUMA_URL || "http://127.0.0.1:3001";
const username = process.env.KUMA_ADMIN_USERNAME || "admin";
const password = process.env.KUMA_ADMIN_PASSWORD || "ChangeMeStrong123";

function emitAsync(socket, event, ...args) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Timed out waiting for ${event}`));
    }, 60000);

    socket.emit(event, ...args, (response) => {
      clearTimeout(timer);
      resolve(response);
    });
  });
}

async function main() {
  const socket = io(url, {
    transports: ["websocket"],
    reconnection: false,
    timeout: 60000
  });

  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Timed out connecting to Uptime Kuma")), 60000);
    socket.once("connect", () => {
      clearTimeout(timer);
      resolve();
    });
    socket.once("connect_error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
  });

  const needSetup = await emitAsync(socket, "needSetup");

  if (needSetup) {
    const setup = await emitAsync(socket, "setup", username, password);
    if (!setup || setup.ok !== true) {
      throw new Error(`Uptime Kuma setup failed: ${setup && setup.msg ? setup.msg : JSON.stringify(setup)}`);
    }
    console.log("Uptime Kuma owner account created.");
    socket.close();
    return;
  }

  const login = await emitAsync(socket, "login", {
    username,
    password,
    token: ""
  });

  if (!login || login.ok !== true) {
    throw new Error(
      "Uptime Kuma is already initialized, but the configured credentials did not sign in. " +
      "Use the existing owner account or reset .local/uptime-kuma if this is a disposable local stack."
    );
  }

  console.log("Uptime Kuma owner account is ready.");
  socket.close();
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
NODE
}

for attempt in $(seq 1 6); do
  if run_setup; then
    break
  fi

  if [ "$attempt" = "6" ]; then
    echo "Could not create or verify Uptime Kuma owner account." >&2
    exit 1
  fi

  echo "Uptime Kuma setup API was not ready; retrying in 5s (${attempt}/6)..."
  sleep 5
done

echo "Uptime Kuma login:"
echo "  URL: ${UPTIME_KUMA_URL:-http://127.0.0.1:3001}"
echo "  Username: ${KUMA_ADMIN_USERNAME}"
echo "  Password: ${KUMA_ADMIN_PASSWORD}"
