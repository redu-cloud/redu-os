import { spaStyles } from "./styles.js";
import { spaUtils } from "./utils.js";
import { spaOnboarding } from "./onboarding.js";
import { spaNav, spaRouter } from "./nav.js";
import { spaBind } from "./bind.js";
import { pgOverview } from "./pages/overview.js";
import { pgEvents } from "./pages/events.js";
import { pgInsights } from "./pages/insights.js";
import { pgActions } from "./pages/actions.js";
import { pgMemory } from "./pages/memory.js";
import { pgAgents } from "./pages/agents.js";
import { pgIntegrations } from "./pages/integrations.js";
import { pgAiConfig } from "./pages/ai-config.js";
import { pgNotifications } from "./pages/notifications.js";
import { pgFeedback } from "./pages/feedback.js";
import { pgSettings } from "./pages/settings.js";
import { pgLogs } from "./pages/logs.js";

export const dashboardHtml = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>reduOS</title>
  <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect width='32' height='32' rx='8' fill='%236366f1'/><text x='16' y='22' font-size='18' font-family='monospace' font-weight='bold' text-anchor='middle' fill='white'>r</text></svg>" />
  <!-- UMAMI_SCRIPT -->
  <!-- GLITCHTIP_SCRIPT -->
  <style>
${spaStyles}
  </style>
</head>
<body>
${spaNav}

  <script>
${spaUtils}

${spaOnboarding}

${spaRouter}

    /* ═══════════════════════════════════════════════════════
       OVERVIEW
    ═══════════════════════════════════════════════════════ */
    ${pgOverview}

    /* ═══════════════════════════════════════════════════════
       EVENTS
    ═══════════════════════════════════════════════════════ */
    ${pgEvents}

    /* ═══════════════════════════════════════════════════════
       INSIGHTS
    ═══════════════════════════════════════════════════════ */
    ${pgInsights}

    /* ═══════════════════════════════════════════════════════
       ACTIONS
    ═══════════════════════════════════════════════════════ */
    ${pgActions}

    /* ═══════════════════════════════════════════════════════
       MEMORY
    ═══════════════════════════════════════════════════════ */
    ${pgMemory}

    /* ═══════════════════════════════════════════════════════
       AGENTS
    ═══════════════════════════════════════════════════════ */
    ${pgAgents}

    /* ═══════════════════════════════════════════════════════
       INTEGRATIONS
    ═══════════════════════════════════════════════════════ */
    ${pgIntegrations}

    /* ═══════════════════════════════════════════════════════
       AI CONFIG
    ═══════════════════════════════════════════════════════ */
    ${pgAiConfig}

    /* ═══════════════════════════════════════════════════════
       NOTIFICATIONS
    ═══════════════════════════════════════════════════════ */
    ${pgNotifications}

    /* ═══════════════════════════════════════════════════════
       FEEDBACK
    ═══════════════════════════════════════════════════════ */
    ${pgFeedback}

    /* ═══════════════════════════════════════════════════════
       SETTINGS
    ═══════════════════════════════════════════════════════ */
    ${pgSettings}

    /* ═══════════════════════════════════════════════════════
       LOGS
    ═══════════════════════════════════════════════════════ */
    ${pgLogs}

${spaBind}
  </script>
</body>
</html>`;
