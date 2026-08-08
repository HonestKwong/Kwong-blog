#!/usr/bin/env bash
set -euo pipefail
DB_PATH="${DB_PATH:-/app/data/prod.db}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/kwong}"
RETENTION_DAYS="${RETENTION_DAYS:-7}"
mkdir -p "$BACKUP_DIR"
stamp="$(date -u +%Y%m%dT%H%M%SZ)"
target="$BACKUP_DIR/prod-$stamp.db"
sqlite3 "$DB_PATH" ".backup '$target'"
find "$BACKUP_DIR" -type f -name 'prod-*.db' -mtime +"$RETENTION_DAYS" -delete
echo "$target"
