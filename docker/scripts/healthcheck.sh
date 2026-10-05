#!/bin/sh
# docker/scripts/healthcheck.sh
# Container healthcheck used by docker/Dockerfile and docker-compose. Hits
# the app's internal health endpoint (src/app/api/health/route.ts, added in
# a later phase) and exits non-zero on any failure so the orchestrator can
# restart an unhealthy container.

set -eu

PORT="${PORT:-3000}"

wget --quiet --tries=1 --spider "http://127.0.0.1:${PORT}/api/health" || exit 1
