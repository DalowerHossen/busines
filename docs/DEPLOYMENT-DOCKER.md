<!-- docs/DEPLOYMENT-DOCKER.md -->

# Deploying with Docker

The `docker/` directory contains everything needed to build and run KD
SOLUTION IT in containers, for local development or as a base for a
self-hosted production deployment.

## Development stack

```bash
cp .env.example .env   # fill in development/sandbox values
docker compose -f docker/docker-compose.yml --env-file .env up --build
```

This starts:

- `app`: the Next.js dev server with hot reload (`docker/Dockerfile.dev`),
  published on `http://localhost:3000`.
- `nginx`: a plain HTTP reverse proxy (`docker/nginx/nginx.conf`), published
  on `http://localhost:8080`, useful for testing reverse-proxy behaviour
  locally before deploying to a VPS.

## Production image

Build the standalone production image directly:

```bash
docker build -f docker/Dockerfile -t kd-solution-it:latest .
docker run -p 3000:3000 --env-file .env kd-solution-it:latest
```

The image uses the Next.js "standalone" output (enabled only when
`DOCKER_BUILD=true`, set inside `docker/Dockerfile`), runs as a non-root
user, and exposes a healthcheck at `/api/health` (see
`docker/scripts/healthcheck.sh`). `docker/scripts/entrypoint.sh` validates
that required secrets are present before the server starts.

## Full production stack (app + Nginx + TLS)

```bash
# 1. Generate a certificate (self-signed for testing, or see the
#    Let's Encrypt section below for a real certificate).
./docker/nginx/ssl/generate-ssl.sh your-domain.com

# 2. Edit docker/nginx/nginx.prod.conf and replace example.com with your
#    real domain.

# 3. Start the stack.
docker compose -f docker/docker-compose.prod.yml --env-file .env up -d --build
```

### Let's Encrypt certificates

Once DNS for your domain points at the server and port 80 is reachable:

```bash
cd docker/nginx/ssl
./letsencrypt-renew.sh your-domain.com admin@your-domain.com
```

The `certbot` service defined in `docker-compose.prod.yml` then renews the
certificate automatically every 12 hours for as long as the stack runs.

## Database and file storage

This stack does not run a local database. Point `NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` at a
Supabase project (the managed cloud service, or a self-hosted instance using
the official `supabase/supabase` Docker stack run separately). Uploaded
files go to Google Drive regardless of where the database runs; configure
`GOOGLE_DRIVE_CLIENT_EMAIL`, `GOOGLE_DRIVE_PRIVATE_KEY`, and
`GOOGLE_DRIVE_ROOT_FOLDER_ID`.

## Backups

```bash
SUPABASE_DB_URL="postgres://..." ./docker/scripts/backup.sh ./backups
```

Restores:

```bash
SUPABASE_DB_URL="postgres://..." ./docker/scripts/restore.sh ./backups/kd-solution-it-20260101-020000.dump.gz
```

Schedule `backup.sh` with cron (or the `database-backup.yml` GitHub Actions
workflow for an independent off-site copy) and sync the output to external
storage; the script only keeps the most recent 30 local copies.

## Migrations

```bash
SUPABASE_DB_URL="postgres://..." ./docker/scripts/migrate.sh
```

## Updating

Pull the latest code, rebuild, and recreate the containers:

```bash
git pull
docker compose -f docker/docker-compose.prod.yml --env-file .env up -d --build
```
