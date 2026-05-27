import type { FastifyInstance } from "fastify";
import { authEnabled, supabaseUrl, supabaseAnonKey } from "../config.js";
import { setSessionCookie, clearSessionCookie } from "../auth.js";

export function register(
  app: FastifyInstance,
  loginHtml: string,
  umamiScriptTag: () => string
): void {
  app.get("/login", async (_request, reply) => {
    if (!authEnabled) {
      reply.redirect("/");
      return;
    }

    reply.type("text/html");
    return loginHtml.replace("<!-- UMAMI_SCRIPT -->", umamiScriptTag());
  });

  app.post("/api/auth/login", async (request, reply) => {
    const body = request.body as { email?: string; password?: string };
    const email = body.email?.trim();
    const password = body.password ?? "";

    if (!email || !password) {
      reply.status(400);
      return { ok: false, error: "Email and password are required." };
    }

    const response = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: supabaseAnonKey
      },
      body: JSON.stringify({ email, password })
    });

    const result = await response.json() as { access_token?: string; error_description?: string; msg?: string };
    if (!response.ok || !result.access_token) {
      reply.status(401);
      return {
        ok: false,
        error: result.error_description || result.msg || "Invalid email or password."
      };
    }

    setSessionCookie(reply, result.access_token);
    return { ok: true };
  });

  app.post("/api/auth/logout", async (_request, reply) => {
    clearSessionCookie(reply);
    return { ok: true };
  });
}
