#!/usr/bin/env bash

cat <<'EOF'
============================================================
Listmonk on redu.cloud — Video Flow
============================================================

Title:
Build a Startup Beta Waitlist with Listmonk API on redu.cloud

1. Problem
   Startups need waitlists and newsletters:
   - collect beta users
   - send product updates
   - own their audience
   - avoid relying only on external SaaS tools

2. Final result preview
   Show:
   - Listmonk dashboard
   - "Beta users" list
   - API user
   - subscriber added through API
   - first campaign draft

3. Create redu.cloud VM
   - Ubuntu image
   - paste cloud-init
   - open TCP port 9000
   - launch instance

4. Wait for cloud-init

   cloud-init status
   sudo tail -n 100 /var/log/listmonk-bootstrap.log

5. Check containers

   sudo podman ps
   sudo podman logs listmonk --tail 50
   sudo podman logs listmonk-db --tail 50

6. Open Listmonk

   http://YOUR_VM_PUBLIC_IP:9000

7. Create list

   Name:
   Beta users

   Use:
   Startup waitlist / early access list

8. Create API user

   Name:
   landing-page-api

   Save:
   - API username
   - API token

9. Set local test variables

   export LISTMONK_URL="http://YOUR_VM_PUBLIC_IP:9000"
   export LISTMONK_API_USER="landing-page-api"
   export LISTMONK_API_TOKEN="PASTE_TOKEN_HERE"
   export LISTMONK_LIST_ID="1"

10. Add subscriber through API

   curl -X POST "$LISTMONK_URL/api/subscribers" \
     -u "$LISTMONK_API_USER:$LISTMONK_API_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "email": "alice@example.com",
       "name": "Alice Demo",
       "status": "enabled",
       "lists": [1],
       "attribs": {
         "source": "redu.cloud video demo",
         "use_case": "beta waitlist"
       }
     }'

11. Show practical architecture

   Visitor
     ↓
   Startup landing page
     ↓
   /api/waitlist backend endpoint
     ↓
   Listmonk API user
     ↓
   "Beta users" list
     ↓
   Campaigns / product updates

12. Production notes

   - Do not expose API token in frontend JavaScript.
   - Use backend endpoint for signups.
   - Add SMTP before sending real emails.
   - Add domain + HTTPS.
   - Restrict admin access.
   - Back up PostgreSQL.
   - Use strong passwords and tokens.

13. End

   Show where users can find:
   - blog post
   - docs guide
   - cloud-init template
   - API examples

============================================================
EOF
