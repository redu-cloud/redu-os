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
