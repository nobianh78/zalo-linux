#!/bin/bash
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export ELECTRON_DISABLE_SANDBOX=1

# Locate Electron binary
if [ -x "$DIR/../../node_modules/electron/dist/electron" ]; then
    ELECTRON_BIN="$DIR/../../node_modules/electron/dist/electron"
elif command -v electron >/dev/null 2>&1; then
    ELECTRON_BIN="electron"
else
    ELECTRON_BIN="node"
fi

if [ "$ELECTRON_BIN" = "node" ]; then
    exec node "$DIR/call_daemon.js" "$1" "$2"
else
    exec "$ELECTRON_BIN" --no-sandbox --user-data-dir=/tmp/zalo_call_window_data "$DIR/call_daemon.js" "$1" "$2"
fi
