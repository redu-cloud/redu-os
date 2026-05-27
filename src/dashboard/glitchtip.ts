import * as Sentry from "@sentry/node";
import { glitchtipDsn } from "./config.js";

/**
 * Initialise the Sentry/GlitchTip SDK for the dashboard server process.
 *
 * GlitchTip is fully Sentry-SDK compatible — we point the DSN at our local
 * GlitchTip instance so all unhandled exceptions and manual `captureException`
 * calls are collected there.
 *
 * Call this ONCE at the very top of index.ts, before Fastify is created.
 */
export function initGlitchTip(): void {
  if (!glitchtipDsn) return;

  Sentry.init({
    dsn: glitchtipDsn,
    environment: process.env.NODE_ENV ?? "development",
    release: process.env.npm_package_version ?? "unknown",
    // Don't sample everything in prod — 0.2 = 20% of transactions
    tracesSampleRate: 0.2,
    // Disable default integrations that don't fit a headless Fastify server
    integrations: [],
  });

  console.log("[glitchtip] error reporting enabled →", glitchtipDsn.replace(/\/\/[^@]+@/, "//***@"));
}

/**
 * Capture an error manually — used in route handlers or background workers
 * where you want to explicitly report to GlitchTip.
 */
export function captureError(err: unknown, context?: Record<string, unknown>): void {
  if (!glitchtipDsn) return;
  Sentry.withScope(scope => {
    if (context) scope.setExtras(context);
    Sentry.captureException(err);
  });
}

/**
 * Returns a <script> block that loads the Sentry browser SDK from CDN and
 * initialises it pointing at GlitchTip, or "" when GLITCHTIP_DSN is not set.
 *
 * Uses the raw DSN from .env (127.0.0.1) — this is the browser-accessible URL,
 * not the container-internal one.
 */
export function glitchtipScriptTag(): string {
  const dsn = process.env.GLITCHTIP_DSN ?? "";
  if (!dsn) return "";
  return `<script
  src="https://browser.sentry-cdn.com/8.53.0/bundle.min.js"
  crossorigin="anonymous"
  onload="Sentry&&Sentry.init({dsn:'${dsn}',environment:'${process.env.NODE_ENV ?? "production"}',tracesSampleRate:0.1})"
></script>`;
}
