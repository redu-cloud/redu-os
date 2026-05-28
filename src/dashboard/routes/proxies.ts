/**
 * Server-side proxies for external service forms.
 * CORS-open so any website can POST without exposing service credentials.
 *
 *   POST /api/zammad/contact      — create a Zammad support ticket
 *   POST /api/listmonk/subscribe  — subscribe an email to the beta list
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { FastifyInstance } from "fastify";
import {
  zammadUrl,
  zammadAdminEmail,
  zammadAdminPassword,
  listmonkUrl,
  listmonkAdminUsername,
  listmonkAdminPassword,
  listmonkListName,
} from "../config.js";

/** Read the UUID written by scripts/setup-listmonk.sh to .local/listmonk/list.env */
function readListmonkUuidFromFile(): string | null {
  try {
    const content = readFileSync(resolve("/app/.local/listmonk/list.env"), "utf8");
    const match   = content.match(/LISTMONK_LIST_UUID=([^\s]+)/);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

// ── Listmonk: find or create the beta list, cache UUID ───────────────────────
let _listmonkUuid: string | null = null;

async function getListmonkUuid(): Promise<string | null> {
  if (_listmonkUuid) return _listmonkUuid;
  if (!listmonkUrl) return null;

  // 1. Read from the file written by setup-listmonk.sh (most reliable source)
  const fromFile = readListmonkUuidFromFile();
  if (fromFile) {
    _listmonkUuid = fromFile;
    return _listmonkUuid;
  }

  // 2. Fall back: create the list via API (first-run or file not yet written)
  const creds   = Buffer.from(`${listmonkAdminUsername}:${listmonkAdminPassword}`).toString("base64");
  const headers = { Authorization: `Basic ${creds}`, "Content-Type": "application/json" };
  try {
    const createRes = await fetch(`${listmonkUrl}/api/lists`, {
      method: "POST",
      headers,
      body: JSON.stringify({ name: listmonkListName, type: "public", optin: "single", tags: [] }),
      signal: AbortSignal.timeout(8_000),
    });
    if (!createRes.ok) return null;
    const created = await createRes.json() as { data?: { uuid?: string } };
    _listmonkUuid = created.data?.uuid ?? null;
    return _listmonkUuid;
  } catch {
    return null;
  }
}

// ── Zammad: find or create customer, then create ticket ───────────────────────
async function zammadFindOrCreateCustomer(
  email: string,
  name: string,
  creds: string
): Promise<number | null> {
  const headers = { Authorization: `Basic ${creds}`, "Content-Type": "application/json" };

  // 1. Search for existing user
  try {
    const searchRes = await fetch(
      `${zammadUrl}/api/v1/users/search?query=${encodeURIComponent(email)}`,
      { headers, signal: AbortSignal.timeout(8_000) }
    );
    if (searchRes.ok) {
      const users = await searchRes.json() as Array<{ id: number; email: string }>;
      const found = users.find(u => u.email?.toLowerCase() === email.toLowerCase());
      if (found) return found.id;
    }
  } catch { /* fall through to create */ }

  // 2. Not found — create customer
  const parts     = name.split(" ");
  const firstname = parts[0] ?? name;
  const lastname  = parts.slice(1).join(" ") || "-";
  try {
    const createRes = await fetch(`${zammadUrl}/api/v1/users`, {
      method: "POST",
      headers,
      body: JSON.stringify({ email, firstname, lastname, roles: ["Customer"] }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!createRes.ok) return null;
    const user = await createRes.json() as { id?: number };
    return user.id ?? null;
  } catch {
    return null;
  }
}

export function register(app: FastifyInstance): void {

  // ── Zammad contact form ───────────────────────────────────────────────────
  app.options("/api/zammad/contact", async (_req, reply) =>
    reply.headers(CORS).code(204).send()
  );

  app.post("/api/zammad/contact", async (request, reply) => {
    reply.headers(CORS);
    const { name = "", email, subject, message } = request.body as {
      name?: string; email?: string; subject?: string; message?: string;
    };
    if (!email?.trim() || !message?.trim()) {
      return reply.code(400).send({ ok: false, error: "email and message are required" });
    }
    if (!zammadUrl) {
      return reply.code(503).send({ ok: false, error: "Zammad not configured" });
    }

    const creds       = Buffer.from(`${zammadAdminEmail}:${zammadAdminPassword}`).toString("base64");
    const customerName = name.trim() || email.trim();
    const title        = subject?.trim() || `Message from ${email}`;
    const body         = name.trim()
      ? `From: ${name.trim()} <${email}>\n\n${message}`
      : message;

    // Find or create the Zammad customer
    const customerId = await zammadFindOrCreateCustomer(email.trim(), customerName, creds);
    if (!customerId) {
      return reply.code(502).send({ ok: false, error: "Could not find or create Zammad customer" });
    }

    const res = await fetch(`${zammadUrl}/api/v1/tickets`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Basic ${creds}` },
      body: JSON.stringify({
        title,
        group:       "Users",
        customer_id: customerId,
        article:     { subject: title, body, type: "web", internal: false },
      }),
      signal: AbortSignal.timeout(12_000),
    });

    if (!res.ok) {
      return reply.code(502).send({ ok: false, error: `Zammad returned ${res.status}` });
    }
    const data = await res.json() as { id?: number; number?: string };
    return { ok: true, ticket_id: data.id, ticket_number: data.number };
  });

  // ── Listmonk subscribe ────────────────────────────────────────────────────
  app.options("/api/listmonk/subscribe", async (_req, reply) =>
    reply.headers(CORS).code(204).send()
  );

  app.post("/api/listmonk/subscribe", async (request, reply) => {
    reply.headers(CORS);
    const { name, email } = request.body as { name?: string; email?: string };
    if (!email?.trim()) {
      return reply.code(400).send({ ok: false, error: "email is required" });
    }
    if (!listmonkUrl) {
      return reply.code(503).send({ ok: false, error: "Listmonk not configured" });
    }

    const uuid = await getListmonkUuid();
    if (!uuid) {
      return reply.code(503).send({ ok: false, error: "Could not find or create Listmonk list" });
    }

    const res = await fetch(`${listmonkUrl}/api/public/subscription`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email:       email.trim(),
        name:        name?.trim() || email.trim(),
        list_uuids:  [uuid],
      }),
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      return reply.code(502).send({ ok: false, error: `Listmonk returned ${res.status}` });
    }
    return { ok: true };
  });
}
