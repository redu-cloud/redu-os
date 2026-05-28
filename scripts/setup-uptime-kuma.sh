#!/usr/bin/env bash
# Create or verify the local Uptime Kuma owner account.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${ROOT_DIR}/.env"
SUPABASE_ENV="${ROOT_DIR}/.local/supabase-local.env"

# shellcheck disable=SC1091
source "${ROOT_DIR}/scripts/podman-env.sh"

if [ ! -f "$ENV_FILE" ]; then
  echo "Missing .env. Run npm run modular:uptime:up first." >&2
  exit 1
fi

"${ROOT_DIR}/scripts/uptime-env.sh" >/dev/null

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
if [ -f "$SUPABASE_ENV" ]; then
  # shellcheck disable=SC1090
  source "$SUPABASE_ENV"
fi
set +a

KUMA_URL="${UPTIME_KUMA_INTERNAL_URL:-http://127.0.0.1:3001}"
KUMA_ADMIN_USERNAME="${UPTIME_KUMA_ADMIN_USERNAME:-admin}"
KUMA_ADMIN_PASSWORD="${UPTIME_KUMA_ADMIN_PASSWORD:-ChangeMeStrong123}"
KUMA_CREATE_MONITORS="${UPTIME_KUMA_CREATE_MONITORS:-true}"

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
    -e KUMA_CREATE_MONITORS="$KUMA_CREATE_MONITORS" \
    -e COLLECTOR_PORT="${PORT:-3005}" \
    -e DASHBOARD_PORT="${DASHBOARD_PORT:-3006}" \
    -e SUPABASE_KONG_HTTP_PORT="${SUPABASE_KONG_HTTP_PORT:-8000}" \
    -e SUPABASE_STUDIO_PORT="${SUPABASE_STUDIO_PORT:-3000}" \
    -e QDRANT_REST_PORT="${QDRANT_REST_PORT:-6333}" \
    -e OLLAMA_PORT="${OLLAMA_PORT:-11435}" \
    -e LITELLM_PORT="${LITELLM_PORT:-4000}" \
    -e LANGGRAPH_PORT="${LANGGRAPH_PORT:-3010}" \
    -e ACTIVEPIECES_PORT="${ACTIVEPIECES_PORT:-8080}" \
    -e UMAMI_PORT="${UMAMI_PORT:-3002}" \
    -e GLITCHTIP_PORT="${GLITCHTIP_PORT:-8001}" \
    -e LISTMONK_PORT="${LISTMONK_PORT:-9000}" \
    -e ZAMMAD_PORT="${ZAMMAD_PORT:-8081}" \
    -e LANGFUSE_PORT="${LANGFUSE_PORT:-3007}" \
    -e ANON_KEY="${ANON_KEY:-}" \
    -e QDRANT_API_KEY="${QDRANT_API_KEY:-}" \
    -e LANGGRAPH_API_KEY="${LANGGRAPH_API_KEY:-}" \
    -e LITELLM_MASTER_KEY="${LITELLM_MASTER_KEY:-}" \
    -e COLLECTOR_API_KEY="${COLLECTOR_API_KEY:-}" \
    redu-os-uptime-kuma \
    node <<'NODE'
const { io } = require("socket.io-client");

const url = process.env.KUMA_URL || "http://127.0.0.1:3001";
const username = process.env.KUMA_ADMIN_USERNAME || "admin";
const password = process.env.KUMA_ADMIN_PASSWORD || "ChangeMeStrong123";
const createMonitors = (process.env.KUMA_CREATE_MONITORS || "true") !== "false";

const monitorDefaults = {
  type: "http",
  parent: null,
  method: "GET",
  protocol: null,
  location: "world",
  ipFamily: null,
  interval: 60,
  retryInterval: 60,
  resendInterval: 0,
  maxretries: 0,
  retryOnlyOnStatusCodeFailure: false,
  notificationIDList: {},
  ignoreTls: false,
  upsideDown: false,
  expiryNotification: false,
  domainExpiryNotification: true,
  maxredirects: 10,
  accepted_statuscodes: ["200-299"],
  saveResponse: false,
  saveErrorResponse: true,
  responseMaxLength: 1024,
  dns_resolve_type: "A",
  dns_resolve_server: "",
  docker_container: "",
  docker_host: null,
  proxyId: null,
  basic_auth_user: "",
  basic_auth_pass: "",
  mqttUsername: "",
  mqttPassword: "",
  mqttTopic: "",
  mqttWebsocketPath: "",
  mqttSuccessMessage: "",
  mqttCheckType: "keyword",
  authMethod: null,
  oauth_auth_method: "client_secret_basic",
  httpBodyEncoding: "json",
  kafkaProducerBrokers: [],
  kafkaProducerSaslOptions: { mechanism: "None" },
  cacheBust: false,
  kafkaProducerSsl: false,
  kafkaProducerAllowAutoTopicCreation: false,
  gamedigGivenPortOnly: true,
  remote_browser: null,
  screenshot_delay: 0,
  rabbitmqNodes: [],
  rabbitmqUsername: "",
  rabbitmqPassword: "",
  conditions: [],
  system_service_name: ""
};

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

function waitForEvent(socket, event) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Timed out waiting for ${event}`));
    }, 60000);

    socket.once(event, (data) => {
      clearTimeout(timer);
      resolve(data);
    });
  });
}

async function getMonitorList(socket) {
  const listPromise = waitForEvent(socket, "monitorList");
  const response = await emitAsync(socket, "getMonitorList");
  if (!response || response.ok !== true) {
    throw new Error(`Could not get monitor list: ${response && response.msg ? response.msg : JSON.stringify(response)}`);
  }
  return await listPromise;
}

function defaultMonitors() {
  const host = "host.containers.internal";
  const monitors = [
    {
      name: "reduOS Collector",
      url: `http://${host}:${process.env.COLLECTOR_PORT || "3005"}/health`
    },
    {
      name: "reduOS Dashboard",
      url: `http://${host}:${process.env.DASHBOARD_PORT || "3006"}`
    },
    {
      name: "Supabase API",
      url: `http://${host}:${process.env.SUPABASE_KONG_HTTP_PORT || "8000"}/rest/v1/`,
      headers: process.env.ANON_KEY ? { apikey: process.env.ANON_KEY } : undefined
    },
    {
      name: "Supabase Studio",
      url: `http://${host}:${process.env.SUPABASE_STUDIO_PORT || "3000"}`
    },
    {
      name: "Qdrant",
      url: `http://${host}:${process.env.QDRANT_REST_PORT || "6333"}/collections`,
      headers: process.env.QDRANT_API_KEY ? { "api-key": process.env.QDRANT_API_KEY } : undefined
    },
    {
      name: "Ollama",
      url: `http://${host}:${process.env.OLLAMA_PORT || "11435"}/api/tags`
    },
    {
      name: "LiteLLM",
      url: `http://${host}:${process.env.LITELLM_PORT || "4000"}/health`,
      headers: process.env.LITELLM_MASTER_KEY ? { Authorization: `Bearer ${process.env.LITELLM_MASTER_KEY}` } : undefined
    },
    {
      name: "LangGraph",
      url: `http://${host}:${process.env.LANGGRAPH_PORT || "3010"}/health`,
      headers: process.env.LANGGRAPH_API_KEY ? { "x-api-key": process.env.LANGGRAPH_API_KEY } : undefined
    },
    {
      name: "Activepieces",
      url: `http://${host}:${process.env.ACTIVEPIECES_PORT || "8080"}`
    },
    {
      name: "Umami",
      url: `http://${host}:${process.env.UMAMI_PORT || "3002"}/api/heartbeat`
    },
    {
      name: "GlitchTip",
      url: `http://${host}:${process.env.GLITCHTIP_PORT || "8001"}/api/0/`
    },
    {
      name: "Listmonk",
      url: `http://${host}:${process.env.LISTMONK_PORT || "9000"}/`
    },
    {
      name: "Zammad",
      url: `http://${host}:${process.env.ZAMMAD_PORT || "8081"}`
    },
    {
      name: "Langfuse",
      url: `http://${host}:${process.env.LANGFUSE_PORT || "3007"}/api/public/health`
    }
  ];

  return monitors.map((monitor) => ({
    ...monitorDefaults,
    name: monitor.name,
    url: monitor.url,
    headers: monitor.headers ? JSON.stringify(monitor.headers, null, 2) : ""
  }));
}

async function ensureWebhookNotification(socket, notificationList) {
  const collectorPort = process.env.COLLECTOR_PORT || "3005";
  const webhookUrl = `http://host.containers.internal:${collectorPort}/v1/events/uptime-kuma`;
  const notifName = "reduOS Collector";

  const existingList = Object.values(notificationList || {});
  const found = existingList.find((n) => n.name === notifName);
  if (found) {
    console.log(`Notification already exists: ${notifName} (id=${found.id})`);
    return found.id;
  }

  const apiKey = process.env.COLLECTOR_API_KEY || "";
  const headers = apiKey ? JSON.stringify({ "X-API-Key": apiKey }) : "{}";

  const response = await emitAsync(socket, "addNotification", {
    name: notifName,
    type: "webhook",
    isDefault: true,
    applyExisting: true,
    webhookURL: webhookUrl,
    webhookContentType: "json",
    webhookAdditionalHeaders: headers
  }, null);

  if (!response || response.ok !== true) {
    throw new Error(`Could not create notification: ${response && response.msg ? response.msg : JSON.stringify(response)}`);
  }

  console.log(`Created webhook notification: ${notifName} → ${webhookUrl}`);
  return response.id;
}

async function ensureMonitors(socket, notificationList) {
  if (!createMonitors) {
    console.log("Uptime Kuma default monitor creation is disabled.");
    return;
  }

  const notifId = await ensureWebhookNotification(socket, notificationList);

  const existing = await getMonitorList(socket);
  const existingNames = new Set(Object.values(existing || {}).map((monitor) => monitor.name));
  let created = 0;
  let skipped = 0;

  for (const monitor of defaultMonitors()) {
    if (existingNames.has(monitor.name)) {
      console.log(`Monitor already exists: ${monitor.name}`);
      skipped++;
      continue;
    }

    const monitorWithNotif = {
      ...monitor,
      notificationIDList: notifId ? { [notifId]: true } : {}
    };

    const response = await emitAsync(socket, "add", monitorWithNotif);
    if (!response || response.ok !== true) {
      throw new Error(`Could not create monitor ${monitor.name}: ${response && response.msg ? response.msg : JSON.stringify(response)}`);
    }

    console.log(`Created monitor: ${monitor.name}`);
    created++;
  }

  console.log(`Uptime Kuma monitors ready. Created ${created}, skipped ${skipped}.`);
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
    // Fresh install: no existing notifications
    await ensureMonitors(socket, {});
    socket.close();
    return;
  }

  // Capture notificationList emitted automatically during login broadcast
  const notificationListPromise = waitForEvent(socket, "notificationList");

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

  const notificationList = await notificationListPromise;

  console.log("Uptime Kuma owner account is ready.");
  await ensureMonitors(socket, notificationList);
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
