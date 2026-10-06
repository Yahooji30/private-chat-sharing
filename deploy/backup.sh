#!/usr/bin/env bash
# Daily PostgreSQL backup, keeps 14 days. Cron: 17 3 * * * /var/sync/app/deploy/backup.sh
set -euo pipefail
DIR="${BACKUP_DIR:-/var/sync/backups}"
mkdir -p "$DIR"
pg_dump --no-owner --format=custom --file "$DIR/sync-$(date +%F).dump" "${DATABASE_URL:?DATABASE_URL is required}"
find "$DIR" -name 'sync-*.dump' -mtime +14 -delete
