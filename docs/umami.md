# Umami Analytics

Umami is the optional product analytics module for the modular reduOS stack. It complements Uptime Kuma: Kuma tells you whether the stack is alive, Umami tells you whether people are using it.

## Start It

```bash
npm run modular:umami:up
npm run modular:umami:status
```

`modular:umami:up` starts PostgreSQL, starts Umami, verifies the admin login, creates the demo website, and prints the tracking snippet.

Open:

```text
http://127.0.0.1:3002
```

Default local login:

```text
username: admin
password: ChangeMeStrong123
```

You can override these before the first run:

```env
UMAMI_ADMIN_USERNAME=admin
UMAMI_ADMIN_PASSWORD=change-this-password
UMAMI_WEBSITE_NAME=reduOS-Demo
UMAMI_WEBSITE_DOMAIN=redu-os.local
```

Runtime data is stored in:

```text
.local/umami
```

## Tracking Snippet

The setup command prints a snippet like:

```html
<script defer src="http://127.0.0.1:3002/script.js" data-website-id="..."></script>
```

Add that to a site or app page to collect analytics in Umami.

## AI Loop Integration

When the dashboard is running, it automatically polls Umami every 30 seconds and forwards new custom events into the reduOS AI loop. No extra code is required on your website — the Umami script tag is enough.

### What gets forwarded

Only custom events (`umami.track()` calls, `eventType === 2`) are forwarded. Automatic pageviews are excluded to avoid noise.

### Installation

Add the snippet to any page:

```html
<script async defer
  src="http://127.0.0.1:3002/script.js"
  data-website-id="YOUR_WEBSITE_ID"
></script>
```

Then track events normally:

```javascript
umami.track('signup',   { plan: 'pro' });
umami.track('purchase', { amount: 49, plan: 'pro' });
umami.track('contact-form', { status: 'submitted' });
```

### What happens

```
umami.track('purchase', { amount: 49 })
        │
        ▼
   Umami stores it in its Postgres DB
        │
        ▼  (up to 30 s later)
   Dashboard poller picks it up
        │
        ▼
   POST /v1/events  { source: "umami", type: "purchase", severity: "high" }
        │
        ▼
   Supabase  →  Qdrant embed  →  similar-event recall  →  LLM insight
        │
        ▼
   Activepieces automation  →  Discord / Slack / Telegram notification
```

### Severity mapping

| Event name contains | Severity |
|---|---|
| `purchase`, `payment`, `checkout`, `upgrade`, `revenue` | `high` |
| `signup`, `register`, `subscribe`, `plan`, `contact`, `lead`, `trial` | `medium` |
| anything else | `info` |

### Deduplication

The poller tracks forwarded event IDs in memory. An event is never forwarded twice within the same dashboard session, even with the 10-second overlap window used to handle clock skew.

### Viewing results

Events forwarded from Umami appear in the dashboard Events page with `source: umami`. AI insights and automation actions are generated the same way as any other event.

## Send A reduOS Test Event

The collector already understands Umami-style analytics payloads:

```bash
npm run demo:umami
```

This sends an analytics event through Collector, Supabase, Qdrant memory, local DeepSeek analysis, and configured Activepieces webhooks.

## Logs And Stop

```bash
npm run modular:umami:logs
npm run logs:umami
npm run umami:setup
npm run modular:umami:down
```

## Production Notes

- Put Umami behind HTTPS before exposing it publicly.
- Use a strong admin password.
- Keep PostgreSQL storage on persistent disk.
- Set a real website domain before using the tracking snippet in production.
- Configure backups for `.local/umami/postgres` or your production database.
