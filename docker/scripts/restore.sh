#!/bin/sh
# docker/scripts/restore.sh
# Restores a database dump produced by docker/scripts/backup.sh. Intended
# for disaster recovery drills and self-hosted deployments. This only
# restores Supabase Postgres text/relational data; files stored in Google
# Drive are unaffected and do not need restoring since Drive is the
# system of record for binaries.
#
# Usage: SUPABASE_DB_URL=postgres://... ./restore.sh path/to/backup.dump.gz

set -eu

BACKUP_FILE="${1:?Usage: restore.sh <backup-file.dump.gz> }"

if [ -z "${SUPABASE_DB_URL:-}" ]; then
  echo "Error: SUPABASE_DB_URL environment variable is required." >&2
  exit 1
fi

echo "WARNING: this will overwrite data in the target database."
echo "Target: ${SUPABASE_DB_URL}"
printf 'Type "restore" to continue: '
read -r CONFIRMATION

if [ "${CONFIRMATION}" != "restore" ]; then
  echo "Aborted."
  exit 1
fi

TMP_FILE="$(mktemp)"
gunzip -c "${BACKUP_FILE}" > "${TMP_FILE}"

pg_restore --clean --if-exists --no-owner --no-privileges \
  --dbname="${SUPABASE_DB_URL}" "${TMP_FILE}"

rm -f "${TMP_FILE}"

echo "Restore complete from ${BACKUP_FILE}"
