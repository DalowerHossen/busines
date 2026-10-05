#!/bin/sh
# docker/scripts/entrypoint.sh
# Container entrypoint for the production image. Fails fast with a clear
# error if a required runtime secret is missing, instead of starting a
# broken server. Mirrors the server-only variables documented in
# .env.example and docs/ENVIRONMENT-VARIABLES.md.

set -eu

REQUIRED_VARS="NEXT_PUBLIC_SUPABASE_URL NEXT_PUBLIC_SUPABASE_ANON_KEY SUPABASE_SERVICE_ROLE_KEY ENCRYPTION_KEY"

MISSING=""
for VAR_NAME in ${REQUIRED_VARS}; do
  eval "VALUE=\${${VAR_NAME}:-}"
  if [ -z "${VALUE}" ]; then
    MISSING="${MISSING} ${VAR_NAME}"
  fi
done

if [ -n "${MISSING}" ]; then
  echo "Error: missing required environment variable(s):${MISSING}" >&2
  echo "Copy .env.example to .env and fill in real values before starting." >&2
  exit 1
fi

exec node server.js
