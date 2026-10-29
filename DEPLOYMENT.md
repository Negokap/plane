# Deployment topology

This fork runs as **Setjoo Projects** at `https://projects.setjoo.com`,
split across two existing Setjoo boxes rather than Plane's default
all-in-one layout. If you're picking this up fresh, this is the file that
tells you where things actually live — `WHITELABEL.md` is branding-only,
`SETJOO_INTEGRATION.md` is OIDC-only, `CHAT_FEATURE.md` is the chat
feature only.

## The two boxes

- **`sj-app-prod-01`** — Plane's *application* layer: `web`, `admin`,
  `space`, `api`, `worker`, `beat-worker`, `migrator`, `live` (Hocuspocus),
  plus local Redis/Valkey, RabbitMQ, and MinIO (`pgsty/silo`, not
  `minio/minio` — see below). Checked out at `/opt/plane`, on branch
  `setjoo-oidc` via a `setjoo-fork` remote pointing at
  `github.com/Negokap/plane` (there's also an `origin` remote still
  pointing at upstream `makeplane/plane` — don't push there). nginx +
  certbot handle public TLS termination in front of this box's own Caddy
  proxy container.
- **`sj-db-prod-01`** — Plane's Postgres, under a dedicated `plane_app`
  role/database (not the bundled `plane-db` container from stock
  `docker-compose.yml`). `pg_hba.conf` is scoped to `sj-app-prod-01`'s
  WireGuard mesh IP (`10.10.0.2/32`) only — this mirrors the existing
  `mail_auth`/`netdata_monitor` least-privilege pattern already used on
  that box.

Neither box was provisioned for this — both were already part of the
Setjoo mesh (WireGuard, UFW, fail2ban, Netdata/rsyslog already wired),
and `sj-app-prod-01` was simply idle at the time.

## `docker-compose.yml` deviations from stock Plane

The committed `docker-compose.yml` in this repo is **not** stock Plane's —
it's already patched for this topology:

- **`plane-db` service removed entirely**, and `depends_on: plane-db`
  stripped from `api`/`worker`/`beat-worker`/`migrator` — Postgres lives
  on `sj-db-prod-01`, not in a local container. `DATABASE_URL` in
  `apps/api/.env` points there directly.
- **`plane-minio` image pinned to `docker.io/pgsty/silo:RELEASE.2026-09-16T00-00-00Z`**,
  not `minio/minio` — the official MinIO image now requires auth to pull;
  this is the same workaround Plane's own `preview` branch uses.
- **`proxy` service binds to `127.0.0.1` only** (`127.0.0.1:${LISTEN_HTTP_PORT}:80`
  etc.), not the wildcard — nginx on the host handles the actual public
  bind/TLS and reverse-proxies to this container. A wildcard bind here
  would conflict with nginx trying to also bind `:80`/`:443`.
- **`live` and `proxy` services both have `env_file` entries added** —
  stock Plane's compose file is missing these for at least one of them,
  which causes silent env-var-empty failures (Caddy config parse errors,
  wrong `PORT`) rather than a clear error.

If you ever diff this against a fresh `git clone` of upstream
`makeplane/plane`, these are the intentional differences — don't
"fix" them back to stock.

## Required environment files (keys only — see the live `.env` files on
`sj-app-prod-01` for actual values, never commit those)

**`/opt/plane/.env`** (root — consumed by `plane-mq`, `plane-minio`,
`proxy`):
`POSTGRES_HOST`, `POSTGRES_PORT`, `POSTGRES_DB`, `POSTGRES_USER`,
`POSTGRES_PASSWORD`, `PGDATA`, `REDIS_HOST`, `REDIS_PORT`,
`RABBITMQ_HOST`, `RABBITMQ_PORT`, `RABBITMQ_USER`, `RABBITMQ_PASSWORD`,
`RABBITMQ_VHOST`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`,
`AWS_REGION`, `MINIO_ENDPOINT_SSL`, `USE_MINIO`, `FILE_SIZE_LIMIT`,
`API_KEY_RATE_LIMIT`, `DOCKERIZED`, `LISTEN_HTTP_PORT`,
`LISTEN_HTTPS_PORT`, `SITE_ADDRESS`, `TRUSTED_PROXIES`, `CERT_ACME_CA`,
`CERT_ACME_DNS`, `CERT_EMAIL`

**`apps/api/.env`** (Django — `api`/`worker`/`beat-worker`/`migrator`):
all of the above DB/Redis/RabbitMQ/MinIO keys, plus `SECRET_KEY`,
`DEBUG`, `CORS_ALLOWED_ORIGINS`, `WEB_URL`, `APP_BASE_URL`/`APP_BASE_PATH`,
`ADMIN_BASE_URL`/`ADMIN_BASE_PATH`, `SPACE_BASE_URL`/`SPACE_BASE_PATH`,
`LIVE_BASE_URL`/`LIVE_BASE_PATH`, `LIVE_SERVER_SECRET_KEY`,
`GUNICORN_WORKERS`, `HARD_DELETE_AFTER_DAYS`, `SIGNED_URL_EXPIRATION`,
`REDIS_URL`, `REDIS_SSL_CA_CERTS`, `REDIS_SSL_CERT_REQS`, `OTLP_ENDPOINT`
(set to an inert address — telemetry is disabled, see `WHITELABEL.md`),
and the Setjoo-specific additions: `IS_SETJOO_ENABLED=1`,
`SETJOO_CLIENT_ID=setjoo-projects`,
`SETJOO_IDENTITY_ISSUER=https://auth.setjoo.com` (must be the **public**
issuer URL, not the WireGuard mesh IP — see `SETJOO_INTEGRATION.md`'s
"Real bugs found and fixed" #3 for why).

**`apps/live/.env`** (Hocuspocus):
`PORT` (must be `3000` to match the Caddyfile's hardcoded `live:3000`
route — the `.env.example` default of `3100` will silently break this),
`API_BASE_URL`, `WEB_BASE_URL`, `LIVE_BASE_URL`/`LIVE_BASE_PATH`,
`LIVE_SERVER_SECRET_KEY` (must match `apps/api/.env`'s value),
`REDIS_HOST`, `REDIS_PORT`, `REDIS_URL`.

None of these files are committed (standard `.gitignore`'d Plane
convention) — they exist only on `sj-app-prod-01`. There is no secrets
manager integration for this deployment yet; if that changes, update this
section.

## Standing up a fresh checkout

1. `git clone` this repo, checkout `setjoo-oidc`.
2. Create the three `.env` files above with real values (ask whoever has
   access to `sj-app-prod-01`, or provision a fresh Postgres role / OIDC
   client if this is a genuinely new environment, not a redeploy).
3. `docker compose build --no-cache` — always `--no-cache` for this repo;
   a plain rebuild has silently kept stale baked-in values before (see
   `SETJOO_INTEGRATION.md`). After building, grep the extracted built JS
   for an expected string before trusting the image, not just its
   timestamp.
4. `docker compose run --rm migrator`
5. `docker compose up -d`
6. If this is a new public domain: install nginx + certbot on the host
   (not bundled in this compose file), point it at the `proxy` container's
   `127.0.0.1` bind, issue a cert, and make sure `X-Forwarded-Proto` is
   force-set to `https` on every Caddyfile route (`apps/proxy/Caddyfile.ce`)
   — Caddy does not forward nginx's own header here, see
   `SETJOO_INTEGRATION.md` bug #4.
