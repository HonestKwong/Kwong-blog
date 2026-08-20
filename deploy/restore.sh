#!/usr/bin/env bash
set -euo pipefail
DATA_DIR="${DATA_DIR:-/app/data}"
SOURCE="${1:-}"
if [[ -z "$SOURCE" || ! -f "$SOURCE" ]]; then
  echo "Usage: $0 <backup-file>" >&2
  exit 1
fi
mkdir -p "$DATA_DIR"
cp "$SOURCE" "$DATA_DIR/prod.db"
echo "Restored $SOURCE -> $DATA_DIR/prod.db"
