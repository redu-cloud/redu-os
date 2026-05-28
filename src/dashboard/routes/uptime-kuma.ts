import type { FastifyInstance } from "fastify";
import { io } from "socket.io-client";
import { uptimeKumaUrl, uptimeKumaAdminUsername, uptimeKumaAdminPassword, collectorUrl, collectorApiKey } from "../config.js";

type LoginCb  = { ok: boolean; token?: string; msg?: string };
type AddCb    = { ok: boolean; msg?: string; monitorID?: number };
type NotifCb  = { ok: boolean; msg?: string; id?: number };

interface UKNotification { id: number; name: string; config: string; isDefault: boolean }

const NOTIF_NAME = "reduOS Collector";

function withKuma<T>(fn: (socket: ReturnType<typeof io>) => Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const socket = io(uptimeKumaUrl, { transports: ["websocket"], timeout: 8_000 });
    let done = false;
    const finish = (cb: () => void) => { if (done) return; done = true; socket.disconnect(); cb(); };
    const timer = setTimeout(() => finish(() => reject(new Error("Timeout connecting to Uptime Kuma"))), 20_000);

    socket.on("connect_error", (err) => finish(() => { clearTimeout(timer); reject(new Error(`Could not reach Uptime Kuma: ${err.message}`)); }));
    socket.on("connect", () => {
      fn(socket)
        .then(v => finish(() => { clearTimeout(timer); resolve(v); }))
        .catch(e => finish(() => { clearTimeout(timer); reject(e); }));
    });
  });
}

async function kumaLogin(socket: ReturnType<typeof io>): Promise<void> {
  return new Promise((resolve, reject) => {
    socket.emit("login", { username: uptimeKumaAdminUsername, password: uptimeKumaAdminPassword, token: "" },
      (r: LoginCb) => {
        if (r.ok) resolve();
        else reject(new Error(r.msg || "Authentication failed"));
      }
    );
  });
}

// Pre-registers the notificationList listener BEFORE login to avoid the race
// condition where the event fires before the handler is attached.
function captureNotifList(socket: ReturnType<typeof io>): Promise<UKNotification[]> {
  return new Promise<UKNotification[]>((resolve) => {
    socket.once("notificationList", (list: UKNotification[] | Record<string, UKNotification>) => {
      resolve(Array.isArray(list) ? list : Object.values(list));
    });
    setTimeout(() => resolve([]), 8_000);
  });
}

// Finds an existing "reduOS Collector" webhook notification, or creates one.
async function resolveNotificationId(
  socket: ReturnType<typeof io>,
  notifListPromise: Promise<UKNotification[]>
): Promise<number | null> {
  const notifList = await notifListPromise;

  const existing = notifList.find(n => n.name === NOTIF_NAME);
  if (existing) return existing.id;

  // Create a webhook notification pointing to the collector
  return new Promise<number | null>((resolve) => {
    socket.emit("addNotification", {
      name: NOTIF_NAME,
      type: "webhook",
      isDefault: false,
      applyExisting: false,
      webhookURL: `${collectorUrl}/v1/events/uptime-kuma`,
      webhookContentType: "json",
      webhookAdditionalHeaders: JSON.stringify({ "X-API-Key": collectorApiKey }),
    }, null,
    (r: NotifCb) => resolve(r?.ok && r.id ? r.id : null));
    setTimeout(() => resolve(null), 5_000);
  });
}

export function register(app: FastifyInstance): void {
  app.get("/api/uptime-kuma/monitors", async (_, reply) => {
    if (!uptimeKumaUrl) { reply.status(503); return { ok: false, error: "Uptime Kuma not configured" }; }
    try {
      const monitors = await withKuma(async (socket) => {
        await kumaLogin(socket);
        return new Promise<unknown[]>((resolve) => {
          socket.once("monitorList", (list: Record<string, unknown>) => resolve(Object.values(list)));
        });
      });
      return { ok: true, monitors };
    } catch (e) {
      reply.status(502);
      return { ok: false, error: (e as Error).message };
    }
  });

  app.post("/api/uptime-kuma/monitors", async (request, reply) => {
    if (!uptimeKumaUrl) { reply.status(503); return { ok: false, error: "Uptime Kuma not configured" }; }
    const { name, url, interval } = request.body as { name?: string; url?: string; interval?: number };
    if (!name || !url) { reply.status(400); return { ok: false, error: "name and url are required" }; }

    try {
      const result = await withKuma(async (socket) => {
        // Register notificationList listener BEFORE login so we don't miss the event
        const notifListPromise = captureNotifList(socket);
        await kumaLogin(socket);

        const notifId = await resolveNotificationId(socket, notifListPromise);

        return new Promise<{ monitorID: number; notifId: number | null }>((resolve, reject) => {
          socket.emit("add", {
            type: "http",
            name,
            url,
            interval: interval ?? 60,
            retryInterval: interval ?? 60,
            maxretries: 1,
            active: 1,
            notificationIDList: notifId ? { [notifId]: true } : {},
            accepted_statuscodes: ["200-299"],
          }, (r: AddCb) => {
            if (r.ok) resolve({ monitorID: r.monitorID ?? 0, notifId });
            else reject(new Error(r.msg || "Failed to add monitor"));
          });
        });
      });
      return { ok: true, ...result };
    } catch (e) {
      reply.status(502);
      return { ok: false, error: (e as Error).message };
    }
  });
}
