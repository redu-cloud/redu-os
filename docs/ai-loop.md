# How the AI Loop Works

Every event that enters reduOS — from any source — passes through the same pipeline. This document explains each step, what data moves where, and what makes an insight actionable.

## The Pipeline

```
Event source  →  Collector  →  Supabase  →  Qdrant memory
                                   ↓
                             AI analysis (LiteLLM / Ollama)
                                   ↓
                    Activepieces automation  +  Notifications
                                   ↓
                            Feedback & memory update
```

## Step by step

### 1. Event arrives at the Collector

The Collector (`POST /v1/events` or a source-specific endpoint like `/v1/glitchtip`) receives the raw webhook payload.

Each source has a **normalizer** (`src/normalizers.ts`) that extracts a consistent shape:

| Field | Example (GlitchTip) |
|---|---|
| `type` | `error.created` |
| `source` | `glitchtip` |
| `severity` | `high` |
| `message` | `TypeError: Cannot read properties of null` |
| `user_email` | `alice@example.com` |
| `metadata` | exception type, stack frame, URL, project, release, environment |

For GlitchTip specifically, the normalizer extracts the **top application stack frame** — the first non-`node_modules` frame closest to the throw site — so the AI can reference the exact file and line.

### 2. Stored in Supabase

The normalized event is saved to the `startup_events` table. This is the permanent record — everything else (insight, action, feedback) links back to it via `event_id`.

### 3. Embedded into Qdrant

The event message and key metadata are embedded into a vector and stored in Qdrant. This powers:
- **Semantic deduplication** — "have we seen something like this before?"
- **Similar context retrieval** — the AI sees the 3 most similar past events before generating its insight

If Qdrant is disabled (`QDRANT_ENABLED=false`), this step is skipped and the AI generates the insight without historical context.

### 4. AI analysis

The AI (`src/ollama.ts` → `analyzeEvent()`) receives the stored event plus similar past events. It returns:

```json
{
  "category": "Production Error",
  "priority": "High",
  "sentiment": "Negative",
  "summary": "TypeError in src/checkout/CartSummary.tsx line 84 — `items` is null when the cart is empty",
  "recommended_action": "Add a null guard before accessing `items.length` in CartSummary.tsx:84; reproduce by visiting /checkout with an empty cart"
}
```

The prompt is **source-specific**: for GlitchTip errors, the AI is explicitly instructed to name the file and line in `summary` and explain what was null/undefined in `recommended_action`. For Uptime Kuma, it focuses on which service to restart. For Zammad, it guides a support agent on next steps.

The `raw` GlitchTip payload is stripped from the prompt to reduce noise — only normalized, structured fields are sent to the model.

### 5. Activepieces automation

If an Activepieces webhook is configured, the AI insight is posted to it alongside the original event. This is where you wire up real actions:
- Open a GitHub issue
- Post to `#incidents` Slack channel with a link to GlitchTip
- Create a Linear task
- Page on-call if severity is `critical`

By default the included flow just logs the event. Customize it in the Activepieces UI at `http://127.0.0.1:8080`.

### 6. Notifications

Discord, Slack, and Telegram notifications fire for **every event**, independent of Activepieces. Configure them at `/#notifications` in the dashboard.

### 7. Feedback loop

When an Uptime Kuma monitor recovers, the collector automatically creates a `positive` feedback record linking the recovery to the earlier `down` event. Manual feedback can be submitted via `/#feedback`.

Feedback is stored in `ai_feedback` and is available as context in future AI calls — closing the loop so repeated patterns get recognized over time.

---

## GlitchTip specifics

GlitchTip fires its webhook **once per new issue** (not every occurrence). If the same exception fires again, GlitchTip deduplicates it — no second webhook fires. To re-test after fixing an error, either trigger a different exception or delete the issue in the GlitchTip UI first.

The webhook uses the **"General Slack-compatible webhook"** type because it's the only outbound type that works without custom HTTP headers. Authentication is via `?key=COLLECTOR_API_KEY` in the URL.

What the AI receives for a GlitchTip event, beyond the raw message:

| Metadata field | What it tells the AI |
|---|---|
| `exception_type` | `TypeError`, `ReferenceError`, custom class |
| `exception_value` | The full exception message |
| `stack_top.file` | Filename closest to the throw |
| `stack_top.line` | Line number |
| `stack_top.fn` | Function name |
| `stack_top.context` | The exact source line that threw |
| `url` / `transaction` | Which route or page was active |
| `environment` | `production` vs `staging` |
| `release` | App version at the time of the error |
| `tags` | Any custom tags you set in your SDK |

### Make insights more actionable

The more context your app sends via the Sentry SDK, the better the AI insight:

```javascript
Sentry.init({ dsn: "...", release: "1.4.2", environment: "production" });

// Tag your user on login
Sentry.setUser({ email: user.email });

// Add breadcrumbs before risky operations
Sentry.addBreadcrumb({ message: "Fetching cart", data: { userId } });
```

---

## What makes an insight useful vs. noise

| Useful | Noise |
|---|---|
| "TypeError in CartSummary.tsx:84 — items is null when cart is empty" | "An error occurred" |
| "Restart the Listmonk container; last restart was 3h ago" | "Check logs" |
| "3rd checkout error this hour — likely blocking conversions" | "High priority event" |

The difference is whether the insight names **where** and **what**, not just **that** something happened. The stack frame extraction and source-specific prompt instructions aim to close that gap. The practical ceiling is the quality of stack traces your app sends and whether the model can connect them to your business logic.
