#!/usr/bin/env bash
# Run GlitchTip migrations and create local admin/org/project.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${ROOT_DIR}/.env"

# shellcheck disable=SC1091
source "${ROOT_DIR}/scripts/podman-env.sh"

if [ ! -f "$ENV_FILE" ]; then
  echo "Missing .env. Run npm run modular:glitchtip:up first." >&2
  exit 1
fi

"${ROOT_DIR}/scripts/glitchtip-env.sh" >/dev/null

set -a
# shellcheck disable=SC1091
source "$ENV_FILE"
set +a

if ! podman container exists redu-os-glitchtip 2>/dev/null; then
  echo "GlitchTip container is not present. Run npm run modular:glitchtip:up first." >&2
  exit 1
fi

echo "Waiting for GlitchTip Postgres..."
for attempt in $(seq 1 90); do
  if podman exec redu-os-glitchtip-postgres pg_isready \
    -U "${GLITCHTIP_POSTGRES_USERNAME:-glitchtip}" \
    -d "${GLITCHTIP_POSTGRES_DATABASE:-glitchtip}" >/dev/null 2>&1; then
    break
  fi

  if [ "$attempt" = "90" ]; then
    echo "GlitchTip Postgres did not become ready in time." >&2
    exit 1
  fi

  sleep 2
done

echo "Running GlitchTip migrations..."
for attempt in $(seq 1 18); do
  if podman exec redu-os-glitchtip python manage.py migrate --noinput; then
    break
  fi

  if [ "$attempt" = "18" ]; then
    echo "GlitchTip migrations failed." >&2
    exit 1
  fi

  echo "Migration failed or app not ready; retrying in 5s (${attempt}/18)..."
  sleep 5
done

echo "Creating or verifying GlitchTip admin user..."
podman exec -i \
  -e GLITCHTIP_ADMIN_EMAIL="${GLITCHTIP_ADMIN_EMAIL:-admin@example.com}" \
  -e GLITCHTIP_ADMIN_USERNAME="${GLITCHTIP_ADMIN_USERNAME:-admin}" \
  -e GLITCHTIP_ADMIN_PASSWORD="${GLITCHTIP_ADMIN_PASSWORD:-ChangeMeStrong123!}" \
  redu-os-glitchtip \
  python manage.py shell <<'PY'
import os
from django.contrib.auth import get_user_model

User = get_user_model()

email = os.environ["GLITCHTIP_ADMIN_EMAIL"]
username = os.environ.get("GLITCHTIP_ADMIN_USERNAME", "admin")
password = os.environ["GLITCHTIP_ADMIN_PASSWORD"]
user_field_names = {field.name for field in User._meta.fields}

user = User.objects.filter(email=email).first()
if user:
    user.is_staff = True
    user.is_superuser = True
    user.set_password(password)
    if "username" in user_field_names:
        user.username = username
    user.save()
    print(f"Updated admin user: {email}")
else:
    kwargs = {"email": email, "password": password}
    if "username" in user_field_names:
        kwargs["username"] = username
    User.objects.create_superuser(**kwargs)
    print(f"Created admin user: {email}")
PY

echo "Creating or verifying GlitchTip organization, team, and project..."
podman exec -i \
  -e GLITCHTIP_ADMIN_EMAIL="${GLITCHTIP_ADMIN_EMAIL:-admin@example.com}" \
  -e GLITCHTIP_ORG_NAME="${GLITCHTIP_ORG_NAME:-reduOS}" \
  -e GLITCHTIP_TEAM_NAME="${GLITCHTIP_TEAM_NAME:-Default-Team}" \
  -e GLITCHTIP_PROJECT_NAME="${GLITCHTIP_PROJECT_NAME:-AI-OS-Demo}" \
  redu-os-glitchtip \
  python manage.py shell <<'PY'
import os
from django.apps import apps
from django.contrib.auth import get_user_model
from django.utils.text import slugify

User = get_user_model()

email = os.environ["GLITCHTIP_ADMIN_EMAIL"]
org_name = os.environ.get("GLITCHTIP_ORG_NAME", "reduOS")
team_name = os.environ.get("GLITCHTIP_TEAM_NAME", "Default-Team")
project_name = os.environ.get("GLITCHTIP_PROJECT_NAME", "AI-OS-Demo")

user = User.objects.get(email=email)

Organization = apps.get_model("organizations_ext", "Organization")
OrganizationUser = apps.get_model("organizations_ext", "OrganizationUser")
OrganizationOwner = apps.get_model("organizations_ext", "OrganizationOwner")
Team = apps.get_model("teams", "Team")
Project = apps.get_model("projects", "Project")

org_slug = slugify(org_name)
team_slug = slugify(team_name)
project_slug = slugify(project_name)

def fields(model):
    return {f.name for f in model._meta.fields}

def get_role_value():
    try:
        role_field = OrganizationUser._meta.get_field("role")
        choices = list(role_field.choices or [])
        values = [value for value, _label in choices if isinstance(value, int)]
        if values:
            return max(values)
    except Exception:
        pass
    return 100

org_fields = fields(Organization)
org_lookup = {"slug": org_slug} if "slug" in org_fields else {"name": org_name}
org = Organization.objects.filter(**org_lookup).first()
if not org:
    data = {}
    if "name" in org_fields:
        data["name"] = org_name
    if "slug" in org_fields:
        data["slug"] = org_slug
    org = Organization.objects.create(**data)
    print("Created organization:", org)
else:
    print("Organization exists:", org)

ou_fields = fields(OrganizationUser)
ou_lookup = {}
if "organization" in ou_fields:
    ou_lookup["organization"] = org
if "user" in ou_fields:
    ou_lookup["user"] = user
org_user = OrganizationUser.objects.filter(**ou_lookup).first()
if not org_user:
    data = dict(ou_lookup)
    if "role" in ou_fields:
        data["role"] = get_role_value()
    org_user = OrganizationUser.objects.create(**data)
    print("Created organization user:", org_user)
else:
    if "role" in ou_fields:
        org_user.role = get_role_value()
        org_user.save()
    print("Organization user exists/updated:", org_user)

oo_fields = fields(OrganizationOwner)
oo_lookup = {}
if "organization" in oo_fields:
    oo_lookup["organization"] = org
if "organization_user" in oo_fields:
    oo_lookup["organization_user"] = org_user
if oo_lookup and not OrganizationOwner.objects.filter(**oo_lookup).exists():
    OrganizationOwner.objects.create(**oo_lookup)
    print("Created organization owner")

team_fields = fields(Team)
team_lookup = {"slug": team_slug} if "slug" in team_fields else {"name": team_name}
team_data = {}
if "name" in team_fields:
    team_data["name"] = team_name
if "slug" in team_fields:
    team_data["slug"] = team_slug
if "organization" in team_fields:
    team_lookup["organization"] = org
    team_data["organization"] = org
team = Team.objects.filter(**team_lookup).first()
if not team:
    team = Team.objects.create(**team_data)
    print("Created team:", team)
else:
    print("Team exists:", team)

project_fields = fields(Project)
project_lookup = {"slug": project_slug} if "slug" in project_fields else {"name": project_name}
project_data = {}
if "name" in project_fields:
    project_data["name"] = project_name
if "slug" in project_fields:
    project_data["slug"] = project_slug
if "organization" in project_fields:
    project_lookup["organization"] = org
    project_data["organization"] = org
if "team" in project_fields:
    project_data["team"] = team
if "platform" in project_fields:
    project_data["platform"] = "python"
project = Project.objects.filter(**project_lookup).first()
if not project:
    project = Project.objects.create(**project_data)
    print("Created project:", project)
else:
    print("Project exists:", project)

rel = getattr(team, "projects", None)
if rel and hasattr(rel, "add"):
    rel.add(project)
    print("Added project to team")
PY

echo "Waiting for GlitchTip web..."
for attempt in $(seq 1 90); do
  if curl -fsS "${GLITCHTIP_URL:-http://127.0.0.1:8001}" >/dev/null 2>&1; then
    break
  fi

  if [ "$attempt" = "90" ]; then
    echo "GlitchTip web did not become ready in time." >&2
    exit 1
  fi

  sleep 2
done

echo "GlitchTip is ready:"
echo "  URL: ${GLITCHTIP_URL:-http://127.0.0.1:8001}"
echo "  Email: ${GLITCHTIP_ADMIN_EMAIL:-admin@example.com}"
echo "  Password: ${GLITCHTIP_ADMIN_PASSWORD:-ChangeMeStrong123!}"
echo "  Organization: ${GLITCHTIP_ORG_NAME:-reduOS}"
echo "  Team: ${GLITCHTIP_TEAM_NAME:-Default-Team}"
echo "  Project: ${GLITCHTIP_PROJECT_NAME:-AI-OS-Demo}"
