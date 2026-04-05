#!/bin/bash
set -e

BACKUP_DIR="${BACKUP_DIR:-./backups}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
DATABASE_URL="${DATABASE_URL:-postgresql://postgres:postgres@localhost:5432/nexusos_dev}"

echo "Creating database backup..."

mkdir -p "$BACKUP_DIR"

BACKUP_FILE="$BACKUP_DIR/nexusos_backup_$TIMESTAMP.sql"

if command -v pg_dump &> /dev/null; then
    pg_dump "$DATABASE_URL" > "$BACKUP_FILE"
    echo "Backup saved to: $BACKUP_FILE"
    
    gzip "$BACKUP_FILE"
    echo "Backup compressed to: ${BACKUP_FILE}.gz"
else
    echo "pg_dump not found. Please install PostgreSQL client."
    exit 1
fi

echo "Backup completed successfully!"