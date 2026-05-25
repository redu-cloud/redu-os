# Security

## Local Demo Defaults

This repository includes local-only defaults so the stack can be tested quickly. Values such as these are not production credentials:

```text
COLLECTOR_API_KEY=change-me-please
DASHBOARD_AUTH_EMAIL=admin@example.com
DASHBOARD_AUTH_PASSWORD=ChangeMeStrong123!
AP_OWNER_PASSWORD=ChangeMeStrong123
```

For any shared, public, or internet-facing deployment:

```text
Generate fresh secrets.
Use HTTPS.
Restrict service ports with a firewall or private network.
Rotate webhook URLs that were pasted into chat, logs, screenshots, or issue trackers.
Do not commit .env, .local/, generated Supabase files, or runtime data.
```

## Dashboard

The local dashboard uses Supabase Auth and a signed HTTP-only session cookie. It is meant for local demos and trusted development networks. For production-style use, put it behind HTTPS and change:

```text
DASHBOARD_AUTH_EMAIL
DASHBOARD_AUTH_PASSWORD
DASHBOARD_SESSION_SECRET
```

Set `DASHBOARD_COOKIE_SECURE=true` when serving over HTTPS.

## Webhooks

Activepieces and Discord webhook URLs should be treated as secrets. If a webhook URL is exposed, rotate it in the provider UI and update `.env`.

## Reporting

If you find a vulnerability, please open a private report or contact the maintainer directly rather than creating a public issue with exploit details.
