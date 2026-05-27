import { umamiPublicUrl, umamiApiUrl, umamiAdminUsername, umamiAdminPassword } from "./config.js";

/** Website ID — populated by provisionUmamiWebsite() or pre-set via UMAMI_WEBSITE_ID env var. */
export let umamiWebsiteId = process.env.UMAMI_WEBSITE_ID ?? "";

/** Returns the inline <script> tag to embed in HTML, or "" when Umami is not configured. */
export function umamiScriptTag(): string {
  if (!umamiPublicUrl || !umamiWebsiteId) return "";
  return `<script async defer src="${umamiPublicUrl}/script.js" data-website-id="${umamiWebsiteId}"></script>`;
}

/**
 * Creates the "reduOS-Dashboard" website in Umami and stores its ID.
 * Idempotent — skips creation if the website already exists.
 * Called once after the server starts; failures are logged but never thrown.
 */
export async function provisionUmamiWebsite(): Promise<void> {
  if (!umamiApiUrl || !umamiAdminPassword) return;
  if (umamiWebsiteId) {
    console.log(`[umami] tracking ready — website ${umamiWebsiteId}`);
    return;
  }
  try {
    const loginRes = await fetch(`${umamiApiUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: umamiAdminUsername, password: umamiAdminPassword }),
      signal: AbortSignal.timeout(5000)
    });
    if (!loginRes.ok) { console.log("[umami] login failed — skipping tracking setup"); return; }
    const { token } = await loginRes.json() as { token: string };

    // Check if "reduOS-Dashboard" already exists
    const listRes = await fetch(`${umamiApiUrl}/api/websites?search=reduOS-Dashboard`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(5000)
    });
    const listData = await listRes.json() as { data?: Array<{ id: string; name: string }> };
    const existing = listData.data?.find(w => w.name === "reduOS-Dashboard");

    if (existing) {
      umamiWebsiteId = existing.id;
      console.log(`[umami] using existing website — ${umamiWebsiteId}`);
      return;
    }

    // Create it
    const createRes = await fetch(`${umamiApiUrl}/api/websites`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name: "reduOS-Dashboard", domain: "redu-os.local", shareId: null }),
      signal: AbortSignal.timeout(5000)
    });
    if (!createRes.ok) { console.log(`[umami] website creation failed (${createRes.status})`); return; }
    const created = await createRes.json() as { id: string };
    umamiWebsiteId = created.id;
    console.log(`[umami] website created — ${umamiWebsiteId}`);
  } catch (err) {
    console.log(`[umami] provisioning skipped — ${err instanceof Error ? err.message : err}`);
  }
}
