#!/bin/bash
set -e

if [ -z "$1" ]; then
    echo "Usage: $0 <migration-name>"
    echo "Available migrations:"
    ls -1 packages/db/prisma/migrations/ 2>/dev/null || echo "No migrations found"
    exit 1
fi

MIGRATION="$1"
DB_URL="${DATABASE_URL:-postgresql://postgres:postgres@localhost:5432/nexusos_dev}"

echo "Rolling back migration: $MIGRATION"

if command -v psql &> /dev/null; then
    psql "$DB_URL" -c "SELECT prisma_migrations.revert('$MIGRATION');" || true
else
    echo "psql not found. Please install PostgreSQL client."
    exit 1
fi

echo "Rollback completed!"