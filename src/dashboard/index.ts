import Fastify from "fastify";
import { port, langfuseTracingEnabled } from "./config.js";
import { initGlitchTip, glitchtipScriptTag } from "./glitchtip.js";
import { registerAuthHook } from "./auth.js";

// Initialise error reporting before anything else so startup errors are captured too
initGlitchTip();
import { provisionUmamiWebsite, umamiScriptTag } from "./umami.js";
import { register as registerAuthRoutes } from "./routes/auth.js";
import { register as registerCoreRoutes } from "./routes/core.js";
import { register as registerEventsRoutes } from "./routes/events.js";
import { register as registerInsightsRoutes } from "./routes/insights.js";
import { register as registerActionsRoutes } from "./routes/actions.js";
import { register as registerFeedbackRoutes } from "./routes/feedback.js";
import { register as registerMemoryRoutes } from "./routes/memory.js";
import { register as registerLanggraphRoutes } from "./routes/langgraph.js";
import { register as registerContainersRoutes } from "./routes/containers.js";
import { register as registerSettingsRoutes } from "./routes/settings.js";
import { register as registerNotificationsRoutes } from "./routes/notifications.js";
import { register as registerOnboardingRoutes } from "./routes/onboarding.js";
import { register as registerTrackRoutes } from "./routes/track.js";
import { register as registerResetRoutes } from "./routes/reset.js";
import { register as registerProxiesRoutes } from "./routes/proxies.js";
import { dashboardHtml } from "./html/spa/index.js";
import { loginHtml } from "./html/login.js";

const app = Fastify({ logger: true });

registerAuthHook(app);
registerAuthRoutes(app, loginHtml, umamiScriptTag);
registerCoreRoutes(app);
registerEventsRoutes(app);
registerInsightsRoutes(app);
registerActionsRoutes(app);
registerFeedbackRoutes(app);
registerMemoryRoutes(app);
registerLanggraphRoutes(app);
registerContainersRoutes(app);
registerSettingsRoutes(app);
registerNotificationsRoutes(app);
registerOnboardingRoutes(app);
registerTrackRoutes(app);
registerResetRoutes(app);
registerProxiesRoutes(app);

app.get("/", async (_request, reply) => {
  reply.type("text/html");
  return dashboardHtml
    .replace("<!-- UMAMI_SCRIPT -->", umamiScriptTag())
    .replace("<!-- GLITCHTIP_SCRIPT -->", glitchtipScriptTag());
});

await app.listen({ host: "0.0.0.0", port });
console.log(`reduOS dashboard listening on http://127.0.0.1:${port}`);

// Provision Umami tracking website asynchronously — does not block startup
provisionUmamiWebsite().catch(() => {});
if (langfuseTracingEnabled) {
  console.log("[langfuse] dashboard agent tracing enabled");
}
