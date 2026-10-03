#!/bin/sh
# docker/scripts/migrate.sh
# Applies pending Supabase SQL migrations from supabase/migrations against
# the target database. Used by self-hosted deployments that do not run
# `supabase db push` directly. Requires the Supabase CLI to be installed on
# the host or available via `npx supabase`.
#
# Usage: SUPABASE_DB_URL=postgres://... ./migrate.sh

set -eu

if [ -z "${SUPABASE_DB_URL:-}" ]; then
  echo "Error: SUPABASE_DB_URL environment variable is required." >&2
  exit 1
fi

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"

if [ ! -d "${REPO_ROOT}/supabase/migrations" ]; then
  echo "Error: ${REPO_ROOT}/supabase/migrations not found." >&2
  echo "Run this script after the database phase has added migrations." >&2
  exit 1
fi

cd "${REPO_ROOT}"
npx --yes supabase db push --db-url "${SUPABASE_DB_URL}"

echo "Migrations applied successfully."
