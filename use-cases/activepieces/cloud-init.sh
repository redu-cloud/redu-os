#cloud-config
package_update: true
package_upgrade: true

packages:
  - podman
  - podman-compose
  - uidmap
  - curl
  - jq
  - openssl
  - python3

write_files:
  - path: /root/activepieces-demo.env
    permissions: "0600"
    content: |
      # Public URL for users. Leave empty to auto-detect public IP and use http://IP:8080
      AP_PUBLIC_URL=""

      # Activepieces first admin user
      AP_OWNER_EMAIL=admin@example.com
      AP_OWNER_FIRST_NAME=John
      AP_OWNER_LAST_NAME=Doe
      AP_OWNER_PASSWORD=ChangeMeStrong123

      # App secrets. Leave AUTO_GENERATE for cloud-init.
      AP_ENCRYPTION_KEY=AUTO_GENERATE
      AP_JWT_SECRET=AUTO_GENERATE

      # PostgreSQL
      AP_POSTGRES_DATABASE=activepieces
      AP_POSTGRES_USERNAME=activepieces
      AP_POSTGRES_PASSWORD=AUTO_GENERATE

      # Redis
      AP_REDIS_PASSWORD=AUTO_GENERATE

      # Demo workflow
      FLOW_NAME="Startup Feedback AI"
      EVENT_API_KEY=AUTO_GENERATE

      # Optional Discord webhook.
      # If left as placeholder, Discord step is skipped safely.
      DISCORD_WEBHOOK_URL=YOUR_DISCORD_WEBHOOK_URL_HERE

      # Optional AI bridge.
      # If AI_ENABLED=false or URL/key are placeholders, workflow returns mock AI output safely.
      AI_ENABLED=true
      AI_BRIDGE_URL=http://10.1.0.224:3001/api/generate
      AI_BRIDGE_API_KEY=YOUR_API_KEY_HERE

  - path: /etc/containers/registries.conf
    permissions: "0644"
    content: |
      unqualified-search-registries = ["docker.io"]

      [[registry]]
      prefix = "docker.io"
      location = "docker.io"

  - path: /usr/local/bin/activepieces_bootstrap.sh
    permissions: "0755"
    content: |
      #!/usr/bin/env bash
      set -euo pipefail

      LOG_FILE="/var/log/activepieces-bootstrap.log"
      exec > >(tee -a "$LOG_FILE") 2>&1

      echo "========================================"
      echo " redu.cloud Activepieces bootstrap"
      echo " Started: $(date -Is)"
      echo "========================================"

      source /root/activepieces-demo.env

      APP_DIR="/opt/activepieces"
      LOCAL_URL="http://127.0.0.1:8080"

      mkdir -p "$APP_DIR"
      cd "$APP_DIR"

      if [ -z "${AP_PUBLIC_URL:-}" ]; then
        PUBLIC_IP="$(curl -fsS --max-time 10 https://api.ipify.org || true)"
        if [ -z "$PUBLIC_IP" ]; then
          PUBLIC_IP="$(hostname -I | awk '{print $1}')"
        fi
        AP_PUBLIC_URL="http://${PUBLIC_IP}:8080"
      fi

      if [ "${AP_ENCRYPTION_KEY:-AUTO_GENERATE}" = "AUTO_GENERATE" ]; then
        AP_ENCRYPTION_KEY="$(openssl rand -hex 16)"
      fi

      if [ "${AP_JWT_SECRET:-AUTO_GENERATE}" = "AUTO_GENERATE" ]; then
        AP_JWT_SECRET="$(openssl rand -hex 32)"
      fi

      if [ "${AP_POSTGRES_PASSWORD:-AUTO_GENERATE}" = "AUTO_GENERATE" ]; then
        AP_POSTGRES_PASSWORD="$(openssl rand -hex 24)"
      fi

      if [ "${AP_REDIS_PASSWORD:-AUTO_GENERATE}" = "AUTO_GENERATE" ]; then
        AP_REDIS_PASSWORD="$(openssl rand -hex 24)"
      fi

      if [ "${EVENT_API_KEY:-AUTO_GENERATE}" = "AUTO_GENERATE" ]; then
        EVENT_API_KEY="$(openssl rand -hex 24)"
      fi

      echo "Writing normalized /root/activepieces-demo.env..."

      cat > /root/activepieces-demo.env <<EOF
      AP_PUBLIC_URL="${AP_PUBLIC_URL}"

      AP_OWNER_EMAIL=${AP_OWNER_EMAIL}
      AP_OWNER_FIRST_NAME=${AP_OWNER_FIRST_NAME}
      AP_OWNER_LAST_NAME=${AP_OWNER_LAST_NAME}
      AP_OWNER_PASSWORD=${AP_OWNER_PASSWORD}

      AP_ENCRYPTION_KEY=${AP_ENCRYPTION_KEY}
      AP_JWT_SECRET=${AP_JWT_SECRET}

      AP_POSTGRES_DATABASE=${AP_POSTGRES_DATABASE}
      AP_POSTGRES_USERNAME=${AP_POSTGRES_USERNAME}
      AP_POSTGRES_PASSWORD=${AP_POSTGRES_PASSWORD}

      AP_REDIS_PASSWORD=${AP_REDIS_PASSWORD}

      FLOW_NAME="${FLOW_NAME}"
      EVENT_API_KEY=${EVENT_API_KEY}

      DISCORD_WEBHOOK_URL=${DISCORD_WEBHOOK_URL}

      AI_ENABLED=${AI_ENABLED}
      AI_BRIDGE_URL=${AI_BRIDGE_URL}
      AI_BRIDGE_API_KEY=${AI_BRIDGE_API_KEY}
      EOF

      chmod 600 /root/activepieces-demo.env

      echo "Writing /opt/activepieces/.env..."

      cat > /opt/activepieces/.env <<EOF
      AP_ENVIRONMENT=prod

      # Important:
      # These must be internal from inside the container.
      # If set to public IP, engine payload upload can timeout due NAT/hairpin.
      AP_FRONTEND_URL=http://127.0.0.1:80
      AP_WEBHOOK_URL=http://127.0.0.1:80

      AP_DB_TYPE=POSTGRES
      AP_POSTGRES_HOST=activepieces-postgres
      AP_POSTGRES_PORT=5432
      AP_POSTGRES_DATABASE=${AP_POSTGRES_DATABASE}
      AP_POSTGRES_USERNAME=${AP_POSTGRES_USERNAME}
      AP_POSTGRES_PASSWORD=${AP_POSTGRES_PASSWORD}
      AP_POSTGRES_USE_SSL=false

      AP_REDIS_TYPE=STANDALONE
      AP_REDIS_HOST=activepieces-redis
      AP_REDIS_PORT=6379
      AP_REDIS_USER=default
      AP_REDIS_PASSWORD=${AP_REDIS_PASSWORD}
      AP_REDIS_DB=0
      AP_REDIS_USE_SSL=false

      AP_ENCRYPTION_KEY=${AP_ENCRYPTION_KEY}
      AP_JWT_SECRET=${AP_JWT_SECRET}

      AP_TELEMETRY_ENABLED=false
      AP_TEMPLATES_SOURCE_URL=https://cloud.activepieces.com/api/v1/templates

      AP_TRIGGER_DEFAULT_POLL_INTERVAL=5
      AP_WEBHOOK_TIMEOUT_SECONDS=300
      AP_FLOW_TIMEOUT_SECONDS=600
      AP_MAX_WEBHOOK_PAYLOAD_SIZE_MB=25
      EOF

      chmod 600 /opt/activepieces/.env

      echo "Writing podman-compose.yml..."

      cat > /opt/activepieces/podman-compose.yml <<'EOF'
      version: "3.8"

      services:
        activepieces-postgres:
          image: docker.io/postgres:16-alpine
          container_name: activepieces-postgres
          restart: unless-stopped
          environment:
            POSTGRES_DB: ${AP_POSTGRES_DATABASE}
            POSTGRES_USER: ${AP_POSTGRES_USERNAME}
            POSTGRES_PASSWORD: ${AP_POSTGRES_PASSWORD}
          volumes:
            - activepieces_postgres_data:/var/lib/postgresql/data
          healthcheck:
            test: ["CMD-SHELL", "pg_isready -U ${AP_POSTGRES_USERNAME} -d ${AP_POSTGRES_DATABASE}"]
            interval: 10s
            timeout: 5s
            retries: 30

        activepieces-redis:
          image: docker.io/redis:7-alpine
          container_name: activepieces-redis
          restart: unless-stopped
          command:
            - redis-server
            - --appendonly
            - "yes"
            - --requirepass
            - ${AP_REDIS_PASSWORD}
          volumes:
            - activepieces_redis_data:/data
          healthcheck:
            test: ["CMD", "redis-cli", "-a", "${AP_REDIS_PASSWORD}", "ping"]
            interval: 10s
            timeout: 5s
            retries: 30

        activepieces:
          image: docker.io/activepieces/activepieces:latest
          container_name: activepieces
          restart: unless-stopped
          depends_on:
            - activepieces-postgres
            - activepieces-redis
          ports:
            - "8080:80"
          env_file:
            - /opt/activepieces/.env
          volumes:
            - activepieces_app_data:/root/.activepieces

      volumes:
        activepieces_postgres_data:
        activepieces_redis_data:
        activepieces_app_data:
      EOF

      echo "Cleaning old containers..."
      podman rm -f activepieces activepieces-postgres activepieces-redis 2>/dev/null || true

      echo "Freeing port 8080 if needed..."
      fuser -k 8080/tcp 2>/dev/null || true

      echo "Pulling images..."
      cd /opt/activepieces

      for i in $(seq 1 5); do
        podman-compose --env-file /opt/activepieces/.env pull && break
        echo "Pull failed, retrying in 30s..."
        sleep 30
      done

      echo "Starting Activepieces..."
      podman-compose --env-file /opt/activepieces/.env up -d

      echo "Creating systemd service..."

      cat > /etc/systemd/system/activepieces.service <<EOF
      [Unit]
      Description=Activepieces automation stack
      Requires=network-online.target
      After=network-online.target

      [Service]
      Type=oneshot
      RemainAfterExit=yes
      WorkingDirectory=/opt/activepieces
      ExecStart=/usr/bin/podman-compose --env-file /opt/activepieces/.env up -d
      ExecStop=/usr/bin/podman-compose --env-file /opt/activepieces/.env down
      TimeoutStartSec=0

      [Install]
      WantedBy=multi-user.target
      EOF

      systemctl daemon-reload
      systemctl enable activepieces.service

      echo "Waiting for Activepieces health..."
      for i in $(seq 1 120); do
        if curl -fsS "http://127.0.0.1:8080/api/v1/health" >/dev/null 2>&1; then
          echo "Activepieces is healthy."
          break
        fi

        echo "Waiting for Activepieces... attempt $i/120"
        sleep 5
      done

      echo "Waiting a bit more for migrations..."
      sleep 25

      echo "Testing internal container URL..."
      podman exec activepieces sh -lc 'curl -fsS http://127.0.0.1:80/api/v1/health >/dev/null'

      echo "Creating/signing in owner user..."

      SIGNUP_PAYLOAD="$(jq -n \
        --arg email "$AP_OWNER_EMAIL" \
        --arg password "$AP_OWNER_PASSWORD" \
        --arg firstName "$AP_OWNER_FIRST_NAME" \
        --arg lastName "$AP_OWNER_LAST_NAME" \
        '{
          email: $email,
          password: $password,
          firstName: $firstName,
          lastName: $lastName,
          trackEvents: false,
          newsLetter: false
        }')"

      SIGNUP_RESPONSE="$(curl -sS -X POST "$LOCAL_URL/api/v1/authentication/sign-up" \
        -H "Content-Type: application/json" \
        -d "$SIGNUP_PAYLOAD" || true)"

      echo "$SIGNUP_RESPONSE" > /root/activepieces-signup-response.json

      TOKEN="$(echo "$SIGNUP_RESPONSE" | jq -r '.token // empty' 2>/dev/null || true)"
      PROJECT_ID="$(echo "$SIGNUP_RESPONSE" | jq -r '.projectId // empty' 2>/dev/null || true)"

      if [ -z "$TOKEN" ] || [ -z "$PROJECT_ID" ]; then
        echo "Signup did not return token/projectId. Trying sign-in..."

        SIGNIN_RESPONSE="$(curl -sS -X POST "$LOCAL_URL/api/v1/authentication/sign-in" \
          -H "Content-Type: application/json" \
          -d "{
            \"email\": \"${AP_OWNER_EMAIL}\",
            \"password\": \"${AP_OWNER_PASSWORD}\"
          }")"

        echo "$SIGNIN_RESPONSE" > /root/activepieces-signin-response.json

        TOKEN="$(echo "$SIGNIN_RESPONSE" | jq -r '.token // empty')"
        PROJECT_ID="$(echo "$SIGNIN_RESPONSE" | jq -r '.projectId // empty')"
      fi

      if [ -z "$TOKEN" ] || [ -z "$PROJECT_ID" ]; then
        echo "Could not authenticate to Activepieces."
        echo "Signup response:"
        cat /root/activepieces-signup-response.json || true
        echo "Signin response:"
        cat /root/activepieces-signin-response.json || true
        exit 1
      fi

      echo "$TOKEN" > /root/activepieces-owner-token.txt
      chmod 600 /root/activepieces-owner-token.txt

      echo "$PROJECT_ID" > /root/activepieces-project-id.txt

      echo "PROJECT_ID=$PROJECT_ID"

      echo "Detecting webhook piece version..."
      WEBHOOK_VERSION="$(curl -fsS https://registry.npmjs.org/@activepieces%2Fpiece-webhook/latest | jq -r .version || true)"
      if [ -z "$WEBHOOK_VERSION" ] || [ "$WEBHOOK_VERSION" = "null" ]; then
        WEBHOOK_VERSION="0.1.33"
      fi
      echo "WEBHOOK_VERSION=$WEBHOOK_VERSION"

      echo "Creating Activepieces flow..."

      CREATE_FLOW_RESPONSE="$(curl -sS -X POST "$LOCAL_URL/api/v1/flows" \
        -H "Authorization: Bearer $TOKEN" \
        -H "Content-Type: application/json" \
        -d "$(jq -n \
          --arg displayName "$FLOW_NAME" \
          --arg projectId "$PROJECT_ID" \
          '{
            displayName: $displayName,
            projectId: $projectId,
            metadata: {}
          }')")"

      echo "$CREATE_FLOW_RESPONSE" > /root/activepieces-create-flow-response.json

      FLOW_ID="$(echo "$CREATE_FLOW_RESPONSE" | jq -r '.id // empty')"

      if [ -z "$FLOW_ID" ]; then
        echo "Could not create flow."
        cat /root/activepieces-create-flow-response.json
        exit 1
      fi

      echo "$FLOW_ID" > /root/activepieces-startup-feedback-flow-id.txt
      echo "FLOW_ID=$FLOW_ID"

      ap_operation() {
        local file="$1"
        local out="$2"

        RESPONSE="$(curl -sS -w "\nHTTP_STATUS:%{http_code}\n" \
          -X POST "$LOCAL_URL/api/v1/flows/$FLOW_ID" \
          -H "Authorization: Bearer $TOKEN" \
          -H "Content-Type: application/json" \
          --data-binary @"$file")"

        echo "$RESPONSE" > "$out"

        HTTP_STATUS="$(echo "$RESPONSE" | awk -F: '/HTTP_STATUS/ {print $2}' | tr -d ' ')"
        BODY="$(echo "$RESPONSE" | sed '/HTTP_STATUS:/d')"

        echo "Operation $file -> HTTP $HTTP_STATUS"

        if [ "$HTTP_STATUS" != "200" ] && [ "$HTTP_STATUS" != "201" ]; then
          echo "$BODY" | jq . 2>/dev/null || echo "$BODY"
          exit 1
        fi
      }

      echo "Adding webhook trigger..."

      jq -n \
        --arg pieceVersion "$WEBHOOK_VERSION" \
        '{
          type: "UPDATE_TRIGGER",
          request: {
            name: "trigger",
            valid: true,
            displayName: "Catch Feedback Webhook",
            type: "PIECE_TRIGGER",
            settings: {
              pieceName: "@activepieces/piece-webhook",
              pieceVersion: $pieceVersion,
              triggerName: "catch_webhook",
              input: {
                authType: "none"
              },
              propertySettings: {}
            }
          }
        }' > /root/ap-op-01-trigger.json

      ap_operation /root/ap-op-01-trigger.json /root/ap-op-01-trigger-response.txt

      echo "Adding Validate Feedback code step..."

      cat > /root/validate-feedback-code.js <<EOF_CODE
      exports.code = async (inputs) => {
        const EVENT_API_KEY = '${EVENT_API_KEY}';

        const payload = inputs.trigger_payload || {};
        const headers = payload.headers || {};
        const body = payload.body || payload;

        const providedKey =
          headers['x-api-key'] ||
          headers['X-API-Key'] ||
          headers['X-API-KEY'];

        if (providedKey !== EVENT_API_KEY) {
          return {
            ok: false,
            error: 'Invalid API key',
            status: 401
          };
        }

        const message = body.message || body.feedback || body.text || '';
        const user = body.user || body.name || 'unknown';
        const email = body.email || '';
        const source = body.source || 'api';
        const type = body.type || 'startup_feedback';

        return {
          ok: true,
          type,
          source,
          user,
          email,
          message,
          ai_prompt:
            'You are an AI product feedback analyst for a startup team. ' +
            'Categorize this feedback into exactly one of: Bug Report, Feature Request, General Feedback, Sales Signal, Churn Risk. ' +
            'Return compact JSON only with keys: category, priority, sentiment, summary, recommended_action. ' +
            'Priority must be Low, Medium, or High. ' +
            'Sentiment must be Negative, Neutral, or Positive. ' +
            'Feedback: ' + message
        };
      };
      EOF_CODE

      VALIDATE_CODE="$(cat /root/validate-feedback-code.js)"

      jq -n \
        --arg code "$VALIDATE_CODE" \
        '{
          type: "ADD_ACTION",
          request: {
            parentStep: "trigger",
            action: {
              name: "validate_feedback",
              valid: true,
              displayName: "Validate Feedback",
              type: "CODE",
              settings: {
                sourceCode: {
                  packageJson: "{}",
                  code: $code
                },
                input: {
                  trigger_payload: "{{trigger}}"
                },
                errorHandlingOptions: {
                  retryOnFailure: { value: false },
                  continueOnFailure: { value: false }
                }
              }
            }
          }
        }' > /root/ap-op-02-validate.json

      ap_operation /root/ap-op-02-validate.json /root/ap-op-02-validate-response.txt

      echo "Adding Call AI Bridge code step..."

      cat > /root/call-ai-bridge-code.js <<EOF_CODE
      exports.code = async (inputs) => {
        const AI_BRIDGE_URL = '${AI_BRIDGE_URL}';
        const AI_BRIDGE_API_KEY = '${AI_BRIDGE_API_KEY}';
        const AI_ENABLED = '${AI_ENABLED}';

        const feedback = inputs.feedback;

        if (!feedback || !feedback.ok) {
          return feedback || {
            ok: false,
            error: 'Missing feedback input'
          };
        }

        const aiNotConfigured =
          AI_ENABLED !== 'true' ||
          !AI_BRIDGE_URL ||
          AI_BRIDGE_URL === 'YOUR_AI_BRIDGE_URL_HERE' ||
          !AI_BRIDGE_API_KEY ||
          AI_BRIDGE_API_KEY === 'YOUR_API_KEY_HERE';

        if (aiNotConfigured) {
          return {
            ...feedback,
            ai_raw: JSON.stringify({
              category: 'General Feedback',
              priority: 'Medium',
              sentiment: 'Neutral',
              summary: feedback.message,
              recommended_action: 'Review this feedback manually. AI bridge is not configured.'
            })
          };
        }

        try {
          const response = await fetch(AI_BRIDGE_URL, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-API-Key': AI_BRIDGE_API_KEY
            },
            body: JSON.stringify({
              prompt: feedback.ai_prompt
            })
          });

          const text = await response.text();

          return {
            ...feedback,
            ai_status: response.status,
            ai_raw: text
          };
        } catch (error) {
          return {
            ...feedback,
            ai_status: 0,
            ai_raw: JSON.stringify({
              category: 'General Feedback',
              priority: 'Medium',
              sentiment: 'Neutral',
              summary: feedback.message,
              recommended_action: 'AI bridge call failed. Review feedback manually.',
              error: String(error && error.message ? error.message : error)
            })
          };
        }
      };
      EOF_CODE

      AI_CODE="$(cat /root/call-ai-bridge-code.js)"

      jq -n \
        --arg code "$AI_CODE" \
        '{
          type: "ADD_ACTION",
          request: {
            parentStep: "validate_feedback",
            action: {
              name: "call_ai_bridge",
              valid: true,
              displayName: "Call AI Bridge",
              type: "CODE",
              settings: {
                sourceCode: {
                  packageJson: "{}",
                  code: $code
                },
                input: {
                  feedback: "{{validate_feedback}}"
                },
                errorHandlingOptions: {
                  retryOnFailure: { value: false },
                  continueOnFailure: { value: false }
                }
              }
            }
          }
        }' > /root/ap-op-03-ai.json

      ap_operation /root/ap-op-03-ai.json /root/ap-op-03-ai-response.txt

      echo "Adding Parse AI Result code step..."

      cat > /root/parse-ai-result-code.js <<'EOF_CODE'
      exports.code = async (inputs) => {
        const feedback = inputs.feedback;

        if (!feedback || !feedback.ok) {
          return feedback || {
            ok: false,
            error: 'Missing AI feedback input'
          };
        }

        const aiRaw =
          feedback.ai_raw ||
          feedback.response ||
          feedback.message ||
          JSON.stringify(feedback);

        let parsed = null;

        try {
          const match = String(aiRaw).match(/\{[\s\S]*\}/);
          parsed = match ? JSON.parse(match[0]) : null;
        } catch (e) {
          parsed = null;
        }

        const category = parsed?.category || 'General Feedback';
        const priority = parsed?.priority || 'Medium';
        const sentiment = parsed?.sentiment || 'Neutral';
        const summary = parsed?.summary || String(aiRaw).slice(0, 500);
        const recommended_action =
          parsed?.recommended_action ||
          'Review this feedback and decide whether it should become a product task.';

        const discord_content =
          '🧠 **New startup feedback analyzed by AI**\n\n' +
          '**Category:** ' + category + '\n' +
          '**Priority:** ' + priority + '\n' +
          '**Sentiment:** ' + sentiment + '\n' +
          '**User:** ' + feedback.user + (feedback.email ? ' <' + feedback.email + '>' : '') + '\n' +
          '**Source:** ' + feedback.source + '\n\n' +
          '**AI Summary:** ' + summary + '\n\n' +
          '**Recommended Action:** ' + recommended_action + '\n\n' +
          '**Original Feedback:** ' + feedback.message;

        return {
          ok: true,
          type: feedback.type,
          source: feedback.source,
          user: feedback.user,
          email: feedback.email,
          message: feedback.message,
          category,
          priority,
          sentiment,
          summary,
          recommended_action,
          discord_content,
          ai_status: feedback.ai_status || null,
          ai_raw: aiRaw
        };
      };
      EOF_CODE

      PARSE_CODE="$(cat /root/parse-ai-result-code.js)"

      jq -n \
        --arg code "$PARSE_CODE" \
        '{
          type: "ADD_ACTION",
          request: {
            parentStep: "call_ai_bridge",
            action: {
              name: "parse_ai_result",
              valid: true,
              displayName: "Parse AI Result",
              type: "CODE",
              settings: {
                sourceCode: {
                  packageJson: "{}",
                  code: $code
                },
                input: {
                  feedback: "{{call_ai_bridge}}"
                },
                errorHandlingOptions: {
                  retryOnFailure: { value: false },
                  continueOnFailure: { value: false }
                }
              }
            }
          }
        }' > /root/ap-op-04-parse.json

      ap_operation /root/ap-op-04-parse.json /root/ap-op-04-parse-response.txt

      echo "Adding Send Discord Notification code step..."

      cat > /root/send-discord-code.js <<EOF_CODE
      exports.code = async (inputs) => {
        const DISCORD_WEBHOOK_URL = '${DISCORD_WEBHOOK_URL}';

        const result = inputs.result;

        if (!result || !result.ok) {
          return result || {
            ok: false,
            error: 'Missing parse result input'
          };
        }

        if (!DISCORD_WEBHOOK_URL || DISCORD_WEBHOOK_URL === 'YOUR_DISCORD_WEBHOOK_URL_HERE') {
          return {
            ...result,
            discord_sent: false,
            discord_skipped_reason: 'Discord webhook URL not configured'
          };
        }

        try {
          const response = await fetch(DISCORD_WEBHOOK_URL, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              content: result.discord_content
            })
          });

          const text = await response.text();

          return {
            ...result,
            discord_sent: response.ok,
            discord_status: response.status,
            discord_response: text
          };
        } catch (error) {
          return {
            ...result,
            discord_sent: false,
            discord_status: 0,
            discord_response: String(error && error.message ? error.message : error)
          };
        }
      };
      EOF_CODE

      DISCORD_CODE="$(cat /root/send-discord-code.js)"

      jq -n \
        --arg code "$DISCORD_CODE" \
        '{
          type: "ADD_ACTION",
          request: {
            parentStep: "parse_ai_result",
            action: {
              name: "send_discord_notification",
              valid: true,
              displayName: "Send Discord Notification",
              type: "CODE",
              settings: {
                sourceCode: {
                  packageJson: "{}",
                  code: $code
                },
                input: {
                  result: "{{parse_ai_result}}"
                },
                errorHandlingOptions: {
                  retryOnFailure: { value: false },
                  continueOnFailure: { value: true }
                }
              }
            }
          }
        }' > /root/ap-op-05-discord.json

      ap_operation /root/ap-op-05-discord.json /root/ap-op-05-discord-response.txt

      echo "Locking and publishing flow..."

      cat > /root/ap-op-06-lock-and-publish.json <<'EOF'
      {
        "type": "LOCK_AND_PUBLISH",
        "request": {}
      }
      EOF

      ap_operation /root/ap-op-06-lock-and-publish.json /root/ap-op-06-lock-and-publish-response.txt

      echo "Writing helper scripts..."

      cat > /root/activepieces-get-webhook-url.sh <<'EOF'
      #!/usr/bin/env bash
      set -euo pipefail

      source /root/activepieces-demo.env

      LOCAL_URL="http://127.0.0.1:8080"

      SIGNIN_RESPONSE="$(curl -sS -X POST "$LOCAL_URL/api/v1/authentication/sign-in" \
        -H "Content-Type: application/json" \
        -d "{
          \"email\": \"${AP_OWNER_EMAIL}\",
          \"password\": \"${AP_OWNER_PASSWORD}\"
        }")"

      TOKEN="$(echo "$SIGNIN_RESPONSE" | jq -r '.token')"
      PROJECT_ID="$(echo "$SIGNIN_RESPONSE" | jq -r '.projectId')"

      FLOW_ID="$(curl -sS "$LOCAL_URL/api/v1/flows?projectId=$PROJECT_ID" \
        -H "Authorization: Bearer $TOKEN" \
        | jq -r --arg name "$FLOW_NAME" '
            .data[]
            | select(.version.displayName == $name or .displayName == $name)
            | .id
          ' | head -n1)"

      if [ -z "$FLOW_ID" ]; then
        echo "Could not find flow: $FLOW_NAME"
        exit 1
      fi

      echo "PROJECT_ID=$PROJECT_ID"
      echo "FLOW_ID=$FLOW_ID"
      echo "WEBHOOK_URL=${AP_PUBLIC_URL}/api/v1/webhooks/${FLOW_ID}"
      EOF

      chmod +x /root/activepieces-get-webhook-url.sh

      cat > /root/activepieces-test-webhook.sh <<'EOF'
      #!/usr/bin/env bash
      set -euo pipefail

      source /root/activepieces-demo.env

      WEBHOOK_URL="$(/root/activepieces-get-webhook-url.sh | awk -F= '/WEBHOOK_URL/ {print $2}')"

      curl -i -X POST "$WEBHOOK_URL" \
        -H "Content-Type: application/json" \
        -H "X-API-Key: ${EVENT_API_KEY}" \
        -d '{
          "type": "startup_feedback",
          "source": "redu-cloud-template",
          "user": "Milos",
          "email": "founder@example.com",
          "message": "A beta user tried to deploy the template but got confused by the API key step and left before finishing."
        }'
      EOF

      chmod +x /root/activepieces-test-webhook.sh

      cat > /root/activepieces-status.sh <<'EOF'
      #!/usr/bin/env bash
      set -euo pipefail

      echo "Containers:"
      podman ps -a --filter name=activepieces

      echo
      echo "Health:"
      curl -fsS http://127.0.0.1:8080/api/v1/health || true

      echo
      echo "Webhook URL:"
      /root/activepieces-get-webhook-url.sh || true

      echo
      echo "Recent logs:"
      podman logs --tail=120 activepieces || true
      EOF

      chmod +x /root/activepieces-status.sh

      cat > /root/ACTIVEPIECES_README.txt <<EOF
      redu.cloud Activepieces AI Feedback template

      UI:
        ${AP_PUBLIC_URL}

      Admin:
        Email:    ${AP_OWNER_EMAIL}
        Password: ${AP_OWNER_PASSWORD}

      Event API key:
        ${EVENT_API_KEY}

      Get webhook URL:
        /root/activepieces-get-webhook-url.sh

      Test webhook:
        /root/activepieces-test-webhook.sh

      Status:
        /root/activepieces-status.sh

      App directory:
        /opt/activepieces

      Env files:
        /root/activepieces-demo.env
        /opt/activepieces/.env

      Logs:
        /var/log/activepieces-bootstrap.log

      Flow:
        ${FLOW_NAME}

      Flow ID:
        ${FLOW_ID}

      Webhook URL:
        ${AP_PUBLIC_URL}/api/v1/webhooks/${FLOW_ID}

      Important:
        AP_FRONTEND_URL and AP_WEBHOOK_URL are intentionally internal:
          http://127.0.0.1:80

        Public access still uses:
          ${AP_PUBLIC_URL}

      Security:
        If you pasted a Discord webhook in logs/chat during testing, rotate it.
      EOF

      echo "========================================"
      echo " Activepieces deployment finished"
      echo " UI: ${AP_PUBLIC_URL}"
      echo " Flow ID: ${FLOW_ID}"
      echo " Webhook: ${AP_PUBLIC_URL}/api/v1/webhooks/${FLOW_ID}"
      echo " README: /root/ACTIVEPIECES_README.txt"
      echo " Logs: ${LOG_FILE}"
      echo "========================================"

runcmd:
  - [ bash, -lc, "/usr/local/bin/activepieces_bootstrap.sh > /var/log/activepieces-bootstrap-runcmd.log 2>&1" ]
