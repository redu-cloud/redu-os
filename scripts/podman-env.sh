#!/usr/bin/env bash

# VS Code installed as a Snap rewrites XDG_DATA_HOME to
# ~/snap/code/<revision>/.local/share. Rootless Podman then looks for its
# storage database there and can fail with "database configuration mismatch".
if [ -n "${SNAP_REAL_HOME:-}" ] && [[ "${XDG_DATA_HOME:-}" == "$HOME/snap/code/"* ]]; then
  export HOME="$SNAP_REAL_HOME"
fi

if [[ "${XDG_DATA_HOME:-}" == "$HOME/snap/code/"* ]] || [[ "${XDG_DATA_HOME:-}" == *"/snap/code/"* ]]; then
  export XDG_DATA_HOME="$HOME/.local/share"
fi

if [[ "${XDG_CONFIG_HOME:-}" == "$HOME/snap/code/"* ]] || [[ "${XDG_CONFIG_HOME:-}" == *"/snap/code/"* ]]; then
  export XDG_CONFIG_HOME="$HOME/.config"
fi

if [ -n "${XDG_DATA_DIRS_VSCODE_SNAP_ORIG:-}" ]; then
  export XDG_DATA_DIRS="$XDG_DATA_DIRS_VSCODE_SNAP_ORIG"
fi

export PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:${PATH}"
