#!/usr/bin/env node
import http from "node:http";

const port = Number(process.env.AUTOMATION_MOCK_PORT ?? 3010);
const expectedApiKey = process.env.AUTOMATION_WEBHOOK_API_KEY ?? "local-demo-key";

const server = http.createServer(async (request, response) => {
  if (request.method === "GET" && request.url === "/health") {
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ ok: true, service: "redu-os-automation-mock" }));
    return;
  }

  if (request.method !== "POST" || request.url !== "/webhook/reduos") {
    response.writeHead(404, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ ok: false, error: "not_found" }));
    return;
  }

  const apiKey = request.headers["x-api-key"];
  if (expectedApiKey && apiKey !== expectedApiKey) {
    response.writeHead(401, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ ok: false, error: "invalid_api_key" }));
    return;
  }

  let rawBody = "";
  for await (const chunk of request) {
    rawBody += chunk;
  }

  let payload;
  try {
    payload = JSON.parse(rawBody || "{}");
  } catch {
    response.writeHead(400, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ ok: false, error: "invalid_json" }));
    return;
  }

  const event = payload.event ?? {};
  const insight = payload.insight ?? {};
  const receivedAt = new Date().toISOString();

  console.log(JSON.stringify({
    received_at: receivedAt,
    event_id: event.id,
    event_type: event.type,
    source: event.source,
    severity: event.severity,
    insight_category: insight.category,
    insight_priority: insight.priority,
    recommended_action: insight.recommended_action
  }));

  response.writeHead(200, { "Content-Type": "application/json" });
  response.end(JSON.stringify({
    ok: true,
    received_at: receivedAt,
    action: {
      type: "mock_automation_received",
      event_id: event.id,
      recommended_action: insight.recommended_action
    }
  }));
});

server.listen(port, "0.0.0.0", () => {
  console.log(`reduOS automation mock listening on http://127.0.0.1:${port}`);
  console.log(`webhook: http://127.0.0.1:${port}/webhook/reduos`);
});
