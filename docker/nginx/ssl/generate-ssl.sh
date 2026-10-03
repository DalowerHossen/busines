#!/bin/sh
# docker/nginx/ssl/generate-ssl.sh
# Generates a self-signed certificate for local HTTPS testing of
# nginx.prod.conf. Never use the output of this script in production - use
# docker/nginx/ssl/letsencrypt-renew.sh (via the certbot service in
# docker-compose.prod.yml) for real certificates instead.

set -eu

DOMAIN="${1:-localhost}"
OUT_DIR="$(dirname "$0")/live/${DOMAIN}"

mkdir -p "${OUT_DIR}"

openssl req -x509 -nodes -newkey rsa:2048 \
  -days 365 \
  -keyout "${OUT_DIR}/privkey.pem" \
  -out "${OUT_DIR}/fullchain.pem" \
  -subj "/CN=${DOMAIN}/O=KD SOLUTION IT/C=US"

echo "Self-signed certificate written to ${OUT_DIR}"
echo "This certificate is for local development only."
