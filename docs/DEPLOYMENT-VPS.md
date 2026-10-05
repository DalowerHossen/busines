<!-- docs/DEPLOYMENT-VPS.md -->

# Deploying to a bare VPS (no Docker)

KD SOLUTION IT also runs directly on any Linux VPS with Node.js installed,
without containers. This is a supported but less common path; prefer
`docs/DEPLOYMENT-DOCKER.md` when containers are available.

## 1. Server prerequisites

- Ubuntu 22.04 LTS or similar.
- Node.js matching `.nvmrc` (install via `nvm` to keep versions pinned).
- Nginx, for TLS termination and reverse proxying.
- A process manager: `pm2` is recommended.

```bash
curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
nvm install
npm install -g pm2
sudo apt-get update && sudo apt-get install -y nginx certbot python3-certbot-nginx
```

## 2. Get the code and build

```bash
git clone <repository-url> /var/www/kd-solution-it
cd /var/www/kd-solution-it
npm ci --no-audit --no-fund
cp .env.example .env   # fill in real production values
npm run build
```

## 3. Run with pm2

```bash
pm2 start npm --name "kd-solution-it" -- run start
pm2 save
pm2 startup
```

`npm run start` binds to `0.0.0.0:3000` as configured in `package.json`.

## 4. Configure Nginx

Use `docker/nginx/nginx.prod.conf` as a reference configuration; the same
rules (TLS, security headers, tokenised-link `no-referrer`/`noindex`
headers, and rate limiting) apply whether Nginx runs in a container or
directly on the host. Copy it to `/etc/nginx/sites-available/kd-solution-it`,
replace `example.com` with your real domain and `proxy_pass http://app:3000`
with `proxy_pass http://127.0.0.1:3000`, then enable it:

```bash
sudo ln -s /etc/nginx/sites-available/kd-solution-it /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

## 5. TLS with Let's Encrypt

```bash
sudo certbot --nginx -d your-domain.com -d www.your-domain.com
```

Certbot's systemd timer renews the certificate automatically.

## 6. Database, storage, and backups

Same as the Docker path: point the Supabase environment variables at a
managed or self-hosted Supabase project, and the Google Drive variables at
your service account. Run `docker/scripts/backup.sh`,
`docker/scripts/restore.sh`, and `docker/scripts/migrate.sh` directly on the
VPS (they only require `pg_dump`/`pg_restore`/the Supabase CLI, not Docker
itself) and schedule backups with cron:

```bash
crontab -e
# Daily at 02:00
0 2 * * * cd /var/www/kd-solution-it && SUPABASE_DB_URL="postgres://..." ./docker/scripts/backup.sh ./backups >> /var/log/kd-solution-it-backup.log 2>&1
```

## 7. Updating

```bash
cd /var/www/kd-solution-it
git pull
npm ci --no-audit --no-fund
npm run build
pm2 restart kd-solution-it
```
