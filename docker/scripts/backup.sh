#!/bin/sh
# docker/scripts/backup.sh
# Logical database backup for self-hosted deployments. Dumps the Supabase
# Postgres database (text/relational data only - uploaded files live in
# Google Drive and are not included here) to a timestamped, compressed
# file. Pair this with an off-site copy step (rclone, rsync, or a cloud
# storage CLI) in a cron job; this script only produces the local artifact.
#
# Usage: SUPABASE_DB_URL=postgres://... ./backup.sh [output-directory]

set -eu

OUTPUT_DIR="${1:-./backups}"
TIMESTAMP="$(date -u +%Y%m%d-%H%M%S)"
OUTPUT_FILE="${OUTPUT_DIR}/kd-solution-it-${TIMESTAMP}.dump"

if [ -z "${SUPABASE_DB_URL:-}" ]; then
  echo "Error: SUPABASE_DB_URL environment variable is required." >&2
  exit 1
fi

mkdir -p "${OUTPUT_DIR}"

pg_dump "${SUPABASE_DB_URL}" \
  --no-owner --no-privileges --format=custom \
  --file="${OUTPUT_FILE}"

gzip "${OUTPUT_FILE}"

echo "Backup written to ${OUTPUT_FILE}.gz"

# Retain the last 30 local backups only; older copies should already be
# synced off-site before this cleanup runs.
find "${OUTPUT_DIR}" -name 'kd-solution-it-*.dump.gz' -type f \
  -printf '%T@ %p\n' | sort -rn | awk 'NR>30{print $2}' | xargs -r rm -f
