import type { FastifyInstance } from "fastify";
import { podmanRequest, parseLogStream } from "../podman.js";

export function register(app: FastifyInstance): void {
  app.get("/api/containers", async (_request, reply) => {
    try {
      const buf = await podmanRequest("/v4.0.0/libpod/containers/json?all=true");
      const raw = JSON.parse(buf.toString()) as Array<{
        Names: string[];
        State: string;
        Image: string;
        Ports?: Array<{ hostPort: number; containerPort: number; protocol: string }> | null;
        StartedAt: number;
      }>;
      const PROJECT_PREFIXES = ["redu-os-", "supabase-", "realtime-", "zammad_"];
      const projectContainers = raw.filter((c) => {
        const name = (c.Names[0] ?? "").replace(/^\//, "");
        return PROJECT_PREFIXES.some((p) => name.startsWith(p));
      });

      return {
        ok: true,
        items: projectContainers.map((c) => ({
          name: (c.Names[0] ?? "").replace(/^\//, ""),
          state: c.State,
          image: c.Image.split("/").pop() ?? c.Image,
          ports: (c.Ports ?? [])
            .filter((p) => p.hostPort)
            .map((p) => `${p.hostPort}:${p.containerPort}`)
            .join(", "),
          started: c.StartedAt
        }))
      };
    } catch {
      reply.status(503);
      return { ok: false, error: "Podman socket unavailable", items: [] };
    }
  });

  app.get("/api/containers/:name/logs", async (request, reply) => {
    const { name } = request.params as { name: string };
    const { tail = "200" } = request.query as { tail?: string };
    const tailN = Math.min(Math.max(1, Number(tail) || 200), 2000);
    try {
      const buf = await podmanRequest(
        `/v4.0.0/libpod/containers/${encodeURIComponent(name)}/logs?stdout=true&stderr=true&tail=${tailN}&timestamps=false`
      );
      return { ok: true, lines: parseLogStream(buf) };
    } catch {
      reply.status(503);
      return { ok: false, error: "Podman socket unavailable or container not found", lines: [] };
    }
  });
}
