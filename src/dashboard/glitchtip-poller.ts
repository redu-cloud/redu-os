/**
 * Polls GlitchTip every 60 s for newly-resolved issues and forwards them to
 * the collector as `error.resolved` events. The collector then calls
 * autoFeedbackOnErrorResolved() to close the loop against the original
 * `error.created` event.
 *
 * GlitchTip has no outbound webhook for issue resolution, so polling is the
 * only option.
 */
import { glitchtipUrl, glitchtipApiToken, collectorUrl, collectorApiKey, jsonHeaders } from "./config.js";

const POLL_MS = 60_000;

const seenResolved = new Set<string>();
const MAX_SEEN = 1_000;

function addSeen(id: string) {
  if (seenResolved.size >= MAX_SEEN) {
    const iter = seenResolved.values();
    for (let i = 0; i < 100; i++) seenResolved.delete(iter.next().value!);
  }
  seenResolved.add(id);
}

type GlitchTipIssue = {
  id: string;
  title?: string;
  culprit?: string;
  lastSeen?: string;
  project?: { name?: string; slug?: string };
};

function authHeaders(): Record<string, string> {
  return { Authorization: `Bearer ${glitchtipApiToken}` };
}

async function getOrgs(): Promise<Array<{ id: string; slug: string }>> {
  try {
    const res = await fetch(`${glitchtipUrl}/api/0/organizations/`, {
      headers: authHeaders(),
      signal:  AbortSignal.timeout(5_000)
    });
    if (!res.ok) return [];
    const d = await res.json() as Array<{ id?: string; slug?: string }>;
    return (Array.isArray(d) ? d : []).filter(o => o.id && o.slug) as Array<{ id: string; slug: string }>;
  } catch { return []; }
}

async function forwardResolved(issueId: string, issue: GlitchTipIssue, orgSlug: string): Promise<void> {
  const project = issue.project?.name ?? issue.project?.slug ?? orgSlug;
  const title   = issue.title ?? "Resolved issue";

  await fetch(`${collectorUrl}/v1/events`, {
    method:  "POST",
    headers: jsonHeaders(collectorApiKey),
    body:    JSON.stringify({
      source:   "glitchtip",
      type:     "error.resolved",
      severity: "info",
      message:  `Resolved: ${title}`,
      metadata: {
        project,
        glitchtip_issue_id: issueId,
        culprit:    issue.culprit,
        last_seen:  issue.lastSeen,
        url:        `${glitchtipUrl}/${orgSlug}/issues/${issueId}/`
      }
    })
    // fire-and-forget — AI loop can take ~15s
  });
}

async function pollOrg(orgSlug: string): Promise<void> {
  try {
    const url = `${glitchtipUrl}/api/0/organizations/${orgSlug}/issues/?status=resolved&limit=25`;
    const res = await fetch(url, {
      headers: authHeaders(),
      signal:  AbortSignal.timeout(10_000)
    });
    if (!res.ok) return;

    const issues = await res.json() as GlitchTipIssue[];
    if (!Array.isArray(issues)) return;

    const newlyResolved = issues.filter(i => i.id && !seenResolved.has(i.id));
    for (const issue of newlyResolved) {
      addSeen(issue.id);
      forwardResolved(issue.id, issue, orgSlug).catch(() => {});
    }

    if (newlyResolved.length > 0) {
      console.log(`[glitchtip-poller] forwarded ${newlyResolved.length} resolved issue(s) from org "${orgSlug}"`);
    }
  } catch { /* transient — retry next poll */ }
}

async function poll(): Promise<void> {
  const orgs = await getOrgs();
  await Promise.all(orgs.map(o => pollOrg(o.slug)));
}

export function startGlitchTipPoller(): void {
  if (!glitchtipUrl || !glitchtipApiToken) {
    console.log("[glitchtip-poller] GlitchTip not configured (no GLITCHTIP_API_TOKEN) — skipping resolution relay");
    return;
  }
  console.log(`[glitchtip-poller] starting — polling every ${POLL_MS / 1000}s`);
  // Delay start to avoid hammering GlitchTip before it's fully up
  setTimeout(() => {
    poll().catch(() => {});
    setInterval(() => poll().catch(() => {}), POLL_MS);
  }, 20_000);
}
