import { createHmac, timingSafeEqual } from "node:crypto";
import type { FastifyInstance } from "fastify";
import {
  authEnabled,
  sessionSecret,
  cookieName,
  supabaseUrl,
  supabaseAnonKey
} from "./config.js";

export function base64Url(value: string) {
  return Buffer.from(value).toString("base64url");
}

function fromBase64Url(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

export function sign(value: string) {
  return createHmac("sha256", sessionSecret).update(value).digest("base64url");
}

export function signedCookie(value: string) {
  const encoded = base64Url(value);
  return `${encoded}.${sign(encoded)}`;
}

export function verifySignedCookie(value: string | undefined) {
  if (!value) return null;
  const [encoded, signature] = value.split(".");
  if (!encoded || !signature) return null;

  const expected = sign(encoded);
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (actualBuffer.length !== expectedBuffer.length) return null;
  if (!timingSafeEqual(actualBuffer, expectedBuffer)) return null;

  try {
    return fromBase64Url(encoded);
  } catch {
    return null;
  }
}

export function parseCookies(cookieHeader: string | undefined) {
  const cookies: Record<string, string> = {};
  for (const part of (cookieHeader ?? "").split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key) cookies[key] = decodeURIComponent(rest.join("="));
  }
  return cookies;
}

export async function currentUser(cookieHeader: string | undefined) {
  if (!authEnabled) return { email: "auth-disabled" };

  const token = verifySignedCookie(parseCookies(cookieHeader)[cookieName]);
  if (!token || !supabaseAnonKey) return null;

  try {
    const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: {
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${token}`
      }
    });

    if (!response.ok) return null;
    return await response.json() as { email?: string };
  } catch {
    return null;
  }
}

export function setSessionCookie(reply: { header: (name: string, value: string) => unknown }, accessToken: string) {
  const secure = process.env.DASHBOARD_COOKIE_SECURE === "true" ? "; Secure" : "";
  reply.header(
    "Set-Cookie",
    `${cookieName}=${encodeURIComponent(signedCookie(accessToken))}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800${secure}`
  );
}

export function clearSessionCookie(reply: { header: (name: string, value: string) => unknown }) {
  reply.header("Set-Cookie", `${cookieName}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
}

export function registerAuthHook(app: FastifyInstance): void {
  app.addHook("preHandler", async (request, reply) => {
    const path = request.url.split("?")[0];
    const publicPaths = new Set(["/login", "/api/auth/login", "/api/auth/logout", "/api/track", "/api/zammad/contact", "/api/listmonk/subscribe"]);
    if (publicPaths.has(path)) return;

    const user = await currentUser(request.headers.cookie);
    if (user) {
      return;
    }

    if (path.startsWith("/api/")) {
      return reply.status(401).send({ ok: false, error: "authentication_required" });
    }

    return reply.redirect("/login");
  });
}
