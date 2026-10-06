# SYNC — Deploy (Hostinger VPS)

## D1. Server pick

- Recommended: Hostinger **KVM 2** (2 vCPU, 8 GB RAM, 100 GB NVMe, 8 TB bandwidth). Runs PostgreSQL + Redis + 3 Node apps with headroom.
- Minimum: KVM 1 (1 vCPU, 4 GB): works with 1 instance per app, `maxmemory 384mb`, TURN disabled. Not recommended once chat traffic grows.
- OS: Ubuntu 24.04 LTS. Datacenter: nearest to main audience (India: Mumbai if offered, else Singapore/EU).
- Verify current plan specs on hostinger.com before purchase.

Expected RAM (KVM 2): nginx 20 MB, sync-api 2 x 150 MB, sync-rt 2 x 150 MB, sync-web 250 MB, PostgreSQL 400-800 MB, Redis 100 MB - 1 GB, coturn 30 MB. About 2.5 GB baseline.

## D2. DNS

- `example.com` A → VPS IPv4. **No AAAA** (keeps space-by-IP consistent, see F1).
- `www` CNAME → root (nginx 301 to root).
- `admin` A → VPS IPv4.
- `turn` A → VPS IPv4 (only if TURN enabled).

## D3. Base setup (script `deploy/setup.sh`)

1. Non-root sudo user, SSH key only, disable password + root login.
2. `ufw`: allow 22, 80, 443; TURN: 3478 tcp/udp, 5349 tcp, 49160-49200 udp. Postgres 5432 and Redis 6379 stay closed.
3. `fail2ban` for sshd.
4. Node 24 LTS via NodeSource or `fnm`; `corepack enable` → pnpm.
5. PostgreSQL 17+ from PGDG apt repo: create role `sync_app`, db `sync`, `listen_addresses=localhost`. Tuning (KVM 2): `shared_buffers=1GB`, `effective_cache_size=3GB`, `work_mem=8MB`, `maintenance_work_mem=128MB`, `max_connections=60`, `wal_compression=on`, `random_page_cost=1.1`.
6. Redis 7+ (apt) or Valkey 8: `/etc/redis/redis.conf` → `bind 127.0.0.1`, `requirepass`, `save ""`, `appendonly no`, `maxmemory 1gb`, `maxmemory-policy volatile-lru`, `tcp-keepalive 60`; systemd enabled.
7. `pm2` global + `pm2 startup` + `pm2-logrotate`.
8. nginx + certbot (`--nginx`) for root, www, admin, turn.
9. Dirs: `/var/sync/{app,media,backups}` owned by app user.
10. Unattended security upgrades.

Local dev only: `deploy/dev/docker-compose.yml` runs postgres + redis (production uses native packages, no Docker, to save RAM).

## D4. Build + release (`deploy/release.sh`)

```
git pull --ff-only
pnpm install --frozen-lockfile
pnpm -r build
pg_dump pre-release backup
pnpm --filter backend db:migrate
pm2 reload deploy/ecosystem.config.cjs --update-env
rsync -a --delete admin/dist/ /var/sync/app/admin/
health check (/api/health pg+redis true, ws handshake on :4001) -> rollback to previous release on failure
```
Zero-downtime: PM2 cluster reload rolls instances one by one; sockets reconnect to sibling instance; chat slots held by grace and resume.

## D5. PM2 (`deploy/ecosystem.config.cjs`)

- `sync-api`: `backend/dist/api.js`, cluster, 2 instances (1 on KVM 1), `PORT=4000`, `max_memory_restart: 300M`.
- `sync-rt`: `backend/dist/rt.js`, cluster, 2 instances (1 on KVM 1), `PORT=4001`, websocket-only so no sticky sessions, `max_memory_restart: 400M`, `kill_timeout 8000` (flush text, free chat slots).
- `sync-web`: `frontend/.output/server/index.mjs`, cluster 1-2, `PORT=3000 HOST=127.0.0.1`, `max_memory_restart: 500M`.

## D6. Nginx (`deploy/nginx/sync.conf`)

- HTTP→HTTPS, HTTP/2, gzip + brotli (if module), `client_max_body_size 12m`.
- `upstream sync_api { server 127.0.0.1:4000; keepalive 32; }`, `upstream sync_rt { server 127.0.0.1:4001; }`, `upstream sync_web { server 127.0.0.1:3000; keepalive 32; }`.
- `location /api/` → sync_api.
- `location /socket.io/` → sync_rt with `proxy_http_version 1.1`, `Upgrade`/`Connection` headers, `proxy_read_timeout 75s`, `proxy_buffering off`.
- `location /media/` → alias `/var/sync/media/`, `expires 30d`, `add_header Cache-Control "public, immutable"`.
- `location /_nuxt/` → sync_web with long cache.
- `location /_revalidate` → deny all external (internal only).
- default → sync_web.
- `set_real_ip_from 127.0.0.1; real_ip_header X-Forwarded-For`; pass `X-Forwarded-For`.
- Access log format without client IP (`log_format noip`).
- `admin.example.com` → root `/var/sync/app/admin`, `try_files $uri /index.html`, `/api/` proxied to sync_api.
- Security headers duplicated for static admin.

## D7. coturn (optional, `TURN_ENABLED=true`)

`/etc/turnserver.conf`: `use-auth-secret`, `static-auth-secret=<TURN_SECRET>`, `realm=example.com`, `listening-port=3478`, `tls-listening-port=5349`, cert from certbot, `min-port=49160 max-port=49200`, `no-cli`, `no-multicast-peers`, `denied-peer-ip` private ranges, `total-quota=100`, `user-quota=12`, `max-bps=12500000` (100 Mbit per session cap). No logging of peers beyond errors.

## D8. Backups

- Daily cron 03:30: `pg_dump -Fc sync` → `/var/sync/backups/sync-$(date +%F).dump`, keep 14 days.
- Redis is NOT backed up (ephemeral by design).
- Media dir rsync weekly.
- Optional offsite: rclone to client-owned bucket.
- Restore steps in runbook (T35): `pg_restore --clean`.

## D9. Monitoring

- `/api/health` (pg ping, redis ping, uptime, memory) → UptimeRobot free.
- `redis-cli info memory` + `INFO stats` evicted_keys > 0 alert in runbook.
- `pm2 monit` / logs rotated 10 MB x 7.
