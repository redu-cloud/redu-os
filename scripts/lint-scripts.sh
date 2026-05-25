#!/usr/bin/env bash
# Validate shell scripts. Uses shellcheck when installed, otherwise falls back
# to bash syntax checks so contributors still get a useful local command.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

cd "$ROOT_DIR"

bash -n scripts/*.sh

if command -v shellcheck >/dev/null 2>&1; then
  shellcheck scripts/*.sh
else
  echo "shellcheck is not installed; completed bash -n syntax checks only."
fi
