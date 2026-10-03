#!/bin/sh
# docker/nginx/ssl/letsencrypt-renew.sh
# Issues or renews a Let's Encrypt certificate for a self-hosted deployment
# using the certbot service already defined in docker-compose.prod.yml.
# Run this once manually to obtain the first certificate; the certbot
# service then auto-renews every 12 hours for as long as the stack is up.
#
# Usage: ./letsencrypt-renew.sh example.com admin@example.com

set -eu

DOMAIN="${1:?Usage: letsencrypt-renew.sh <domain> <email>}"
EMAIL="${2:?Usage: letsencrypt-renew.sh <domain> <email>}"

docker compose -f ../../docker-compose.prod.yml run --rm certbot \
  certonly --webroot -w /var/www/certbot \
  -d "${DOMAIN}" -d "www.${DOMAIN}" \
  --email "${EMAIL}" --agree-tos --no-eff-email

docker compose -f ../../docker-compose.prod.yml restart nginx

echo "Certificate issued for ${DOMAIN} and Nginx reloaded."
