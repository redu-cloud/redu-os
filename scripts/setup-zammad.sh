#!/usr/bin/env bash
# Create or update the local Zammad admin account.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${ROOT_DIR}/.env"

# shellcheck disable=SC1091
source "${ROOT_DIR}/scripts/podman-env.sh"

if [ ! -f "$ENV_FILE" ]; then
  echo "Missing .env. Run npm run modular:zammad:up first." >&2
  exit 1
fi

"${ROOT_DIR}/scripts/zammad-env.sh" >/dev/null

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

ZAMMAD_URL="${ZAMMAD_URL:-http://127.0.0.1:8081}"
ZAMMAD_ADMIN_EMAIL="${ZAMMAD_ADMIN_EMAIL:-admin@example.com}"
ZAMMAD_ADMIN_PASSWORD="${ZAMMAD_ADMIN_PASSWORD:-ChangeMeStrong123}"
ZAMMAD_ADMIN_FIRSTNAME="${ZAMMAD_ADMIN_FIRSTNAME:-Local}"
ZAMMAD_ADMIN_LASTNAME="${ZAMMAD_ADMIN_LASTNAME:-Admin}"
ZAMMAD_ORGANIZATION="${ZAMMAD_ORGANIZATION:-reduOS-Support}"
ZAMMAD_FQDN="${ZAMMAD_FQDN:-localhost}"
ZAMMAD_HTTP_TYPE="${ZAMMAD_HTTP_TYPE:-http}"

rails_container() {
  podman ps --format '{{.Names}}' | grep -E '^zammad_zammad-railsserver_1$' | head -n1
}

container="$(rails_container || true)"
if [ -z "$container" ]; then
  echo "Zammad Rails container is not running yet. Run npm run modular:zammad:up first." >&2
  exit 1
fi

echo "Waiting for Zammad Rails..."
for attempt in $(seq 1 120); do
  if podman exec "$container" bash -lc 'cd /opt/zammad && bundle exec rails runner "puts :ready"' >/dev/null 2>&1; then
    break
  fi

  if [ "$attempt" = "120" ]; then
    echo "Zammad Rails did not become ready in time." >&2
    exit 1
  fi

  sleep 10
done

echo "Creating or verifying Zammad admin user..."
podman exec -i \
  -e ZAMMAD_ADMIN_EMAIL="$ZAMMAD_ADMIN_EMAIL" \
  -e ZAMMAD_ADMIN_PASSWORD="$ZAMMAD_ADMIN_PASSWORD" \
  -e ZAMMAD_ADMIN_FIRSTNAME="$ZAMMAD_ADMIN_FIRSTNAME" \
  -e ZAMMAD_ADMIN_LASTNAME="$ZAMMAD_ADMIN_LASTNAME" \
  -e ZAMMAD_ORGANIZATION="$ZAMMAD_ORGANIZATION" \
  -e ZAMMAD_FQDN="$ZAMMAD_FQDN" \
  -e ZAMMAD_HTTP_TYPE="$ZAMMAD_HTTP_TYPE" \
  "$container" \
  bash -lc 'cat >/tmp/reduos-zammad-setup.rb && cd /opt/zammad && bundle exec rails runner /tmp/reduos-zammad-setup.rb' <<'RUBY'
admin_role = Role.find_by(name: 'Admin')
agent_role = Role.find_by(name: 'Agent')

group = Group.find_by(name: 'Users') || Group.create!(
  name: 'Users',
  active: true,
  created_by_id: 1,
  updated_by_id: 1
)

email = ENV.fetch('ZAMMAD_ADMIN_EMAIL')

user = User.find_by(email: email) || User.new
user.firstname = ENV.fetch('ZAMMAD_ADMIN_FIRSTNAME', 'Local')
user.lastname = ENV.fetch('ZAMMAD_ADMIN_LASTNAME', 'Admin')
user.email = email
user.login = email
user.password = ENV.fetch('ZAMMAD_ADMIN_PASSWORD')
user.active = true
user.created_by_id = 1
user.updated_by_id = 1
user.role_ids = [admin_role&.id, agent_role&.id].compact
user.group_ids = [group.id]
user.save!

Setting.set('system_init_done', true)
Setting.set('fqdn', ENV.fetch('ZAMMAD_FQDN', 'localhost'))
Setting.set('http_type', ENV.fetch('ZAMMAD_HTTP_TYPE', 'http'))
Setting.set('organization', ENV.fetch('ZAMMAD_ORGANIZATION', 'reduOS Support'))

puts "Admin ready: #{email}"
RUBY

echo "Waiting for Zammad web..."
for attempt in $(seq 1 90); do
  if curl -fsS "$ZAMMAD_URL" >/dev/null 2>&1; then
    break
  fi

  if [ "$attempt" = "90" ]; then
    echo "Zammad web did not become ready in time." >&2
    exit 1
  fi

  sleep 5
done

echo "Zammad is ready:"
echo "  URL: ${ZAMMAD_URL}"
echo "  Email: ${ZAMMAD_ADMIN_EMAIL}"
echo "  Password: ${ZAMMAD_ADMIN_PASSWORD}"
echo "  Organization: ${ZAMMAD_ORGANIZATION}"
