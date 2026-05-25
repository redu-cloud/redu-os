# Uptime Kuma Monitoring

Uptime Kuma is the first optional app module for the modular reduOS stack. It gives the small local tier a real monitoring UI for Collector, Supabase, Qdrant, Ollama, Dashboard, Activepieces, and any external apps you want to watch.

## Start It

```bash
npm run modular:uptime:up
npm run modular:uptime:status
```

`modular:uptime:up` starts MariaDB, starts Uptime Kuma, creates the owner account, and prints the login.

Open:

```text
http://127.0.0.1:3001
```

Default local login:

```text
username: admin
password: ChangeMeStrong123
```

You can override these before the first run:

```env
UPTIME_KUMA_ADMIN_USERNAME=admin
UPTIME_KUMA_ADMIN_PASSWORD=change-this-password
```

Runtime data is stored in:

```text
.local/uptime-kuma
```

## Suggested Local Monitors

Create HTTP monitors for:

```text
Collector        http://host.containers.internal:3005/health
Dashboard        http://host.containers.internal:3006
Supabase API     http://host.containers.internal:8000/rest/v1/
Qdrant           http://host.containers.internal:6333/collections
Ollama           http://host.containers.internal:11435/api/tags
Activepieces     http://host.containers.internal:8080
```

If a target requires headers, add them in the monitor settings. Qdrant may require:

```text
api-key: your-qdrant-api-key
```

Supabase REST may require:

```text
apikey: your-supabase-anon-key
```

## Send A reduOS Test Event

The collector already understands Uptime Kuma-style webhook payloads:

```bash
npm run demo:uptime
```

This sends a monitor-down event through Collector, Supabase, Qdrant memory, local DeepSeek analysis, and configured Activepieces webhooks.

## Logs And Stop

```bash
npm run modular:uptime:logs
npm run logs:uptime
npm run uptime:setup
npm run modular:uptime:down
```

## Production Notes

- Put Uptime Kuma behind HTTPS before exposing it publicly.
- Use a strong owner password.
- Keep database storage on persistent disk.
- Prefer private networking for internal monitors.
- Configure Discord, email, or another notification channel in Uptime Kuma.
