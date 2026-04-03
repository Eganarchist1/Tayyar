# Tayyar Free-First Deployment

This is the recommended free-first production-prep shape for Tayyar.

## Goal

Run the platform with free or near-free infrastructure while keeping the stack operationally realistic:

- web app
- API
- PostgreSQL
- Redis
- maps
- hero mobile test builds

## Recommended Hosting Shape

### Primary Option

- Oracle Cloud Always Free VM
- Ubuntu LTS
- Docker + Docker Compose
- Coolify for deployment control and SSL

### Services to Host

- Next.js web app
- Fastify API
- PostgreSQL
- Redis
- Caddy reverse proxy / SSL

## Included Deployment Artifacts

- free-first compose stack: [E:\Anti Gravity\Tayyar\infra\docker-compose.free-first.yml](E:\Anti Gravity\Tayyar\infra\docker-compose.free-first.yml)
- Caddy config: [E:\Anti Gravity\Tayyar\infra\Caddyfile](E:\Anti Gravity\Tayyar\infra\Caddyfile)
- web Dockerfile: [E:\Anti Gravity\Tayyar\apps\web\Dockerfile](E:\Anti Gravity\Tayyar\apps\web\Dockerfile)
- API Dockerfile: [E:\Anti Gravity\Tayyar\apps\api\Dockerfile](E:\Anti Gravity\Tayyar\apps\api\Dockerfile)

## Current Free-First Reality

- Web and API hosting can be self-hosted for free on a VM.
- Android testing can stay free-first.
- iOS public App Store distribution is not free.
- Official WhatsApp Cloud API can be integrated, but message volume may stop being free at scale.
- Current web maps use free OpenStreetMap raster tiles through MapLibre in the app. For higher-volume production, move tiles behind your own cache or tile service.

## Required Environment Variables

### API

- `DATABASE_URL`
- `JWT_SECRET`
- `REDIS_URL`
- `ALLOW_DEV_AUTH=false`
- `WHATSAPP_API_TOKEN`
- `WHATSAPP_PHONE_NUMBER_ID`
- `WHATSAPP_WEBHOOK_VERIFY_TOKEN`
- `WHATSAPP_APP_SECRET`
- `MAPBOX_ACCESS_TOKEN` if you keep Mapbox-backed geocoding

Source: [E:\Anti Gravity\Tayyar\apps\api\src\config.ts](E:\Anti Gravity\Tayyar\apps\api\src\config.ts)

### Ready-Made Env Templates

- API template: [E:\Anti Gravity\Tayyar\apps\api\.env.example](E:\Anti Gravity\Tayyar\apps\api\.env.example)
- Web template: [E:\Anti Gravity\Tayyar\apps\web\.env.example](E:\Anti Gravity\Tayyar\apps\web\.env.example)
- Hero template: [E:\Anti Gravity\Tayyar\apps\hero-app\.env.example](E:\Anti Gravity\Tayyar\apps\hero-app\.env.example)
- Compose template: [E:\Anti Gravity\Tayyar\infra\.env.free-first.example](E:\Anti Gravity\Tayyar\infra\.env.free-first.example)

### Domain / SSL Variables

- `APP_DOMAIN`
- `API_DOMAIN`
- `ACME_EMAIL`

### Web

- `NEXT_PUBLIC_API_URL`

### Hero App

- `EXPO_PUBLIC_API_URL`

## Deployment Steps

1. Provision the VM.
2. Install Docker and Docker Compose.
3. Clone the repo to the VM.
4. Set production environment variables.
5. Point DNS records for `APP_DOMAIN` and `API_DOMAIN` to the VM public IP.
6. Start Postgres and Redis.
7. Run Prisma push or migrations.
8. Start API, web, and Caddy.
9. Wait for Caddy to obtain SSL certificates.
10. Run the smoke script before exposing the stack to testers.

## Recommended First Online Bring-Up

### Easiest Setup Path

If you do not want to prepare multiple env files manually, use:

- [E:\Anti Gravity\Tayyar\scripts\deploy\prepare-production-env.ps1](E:\Anti Gravity\Tayyar\scripts\deploy\prepare-production-env.ps1)

Example:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/deploy/prepare-production-env.ps1 `
  -AppDomain app.example.com `
  -ApiDomain api.example.com `
  -AcmeEmail ops@example.com
```

That script:
- generates a strong DB password if you do not provide one
- generates a strong JWT secret if you do not provide one
- writes:
  - `infra/.env.free-first`
  - `apps/api/.env.production`
  - `apps/web/.env.production`
  - `apps/hero-app/.env.production`

For the easiest first deployment, keep these disabled initially:
- SMTP
- WhatsApp
- Mapbox

That gives you the smallest setup surface for online testing.

From the VM:

```bash
cd /srv/tayyar/infra
cp .env.free-first.example .env
# edit .env with real secrets and real domains
docker compose -f docker-compose.free-first.yml pull
docker compose -f docker-compose.free-first.yml up -d
```

Then initialize the database:

```bash
cd /srv/tayyar/packages/db
npm run db:push
```

Then verify:

```bash
curl https://api.example.com/health/ready
curl -I https://app.example.com/login
```

## Runtime Health and Readiness

- Liveness:
  - `GET /health`
  - `GET /health/live`
- Readiness:
  - `GET /health/ready`

`/health/ready` now checks:
- database connectivity
- Redis connectivity
- worker-layer initialization
- returns `503` when the stack is not ready for live traffic

Use it for:
- container health checks
- reverse-proxy upstream checks
- rollout verification after deploy
- uptime monitoring

Every API response now includes `x-request-id` for production debugging and support correlation.

## Suggested Domain Layout

- `app.yourdomain.com` -> web
- `api.yourdomain.com` -> API
- `tiles.yourdomain.com` -> optional later if you self-host tiles

The provided compose file keeps API and web bound to localhost only and publishes public traffic through Caddy on `80/443`.

## Maps

### Current State

- Real interactive maps are live in the web app and hero app.
- Merchant order confirmation uses a draggable pin.
- Merchant branch creation uses a real map.
- Admin and supervisor map screens render actual markers and zones.

### Production-Free Recommendation

- Keep the current MapLibre front-end stack.
- Use free OSM tiles for low-volume testing.
- Add your own tile caching or self-hosted tile service before higher-scale rollout.

## WhatsApp

### Current State

- Official Cloud API path is wired at the backend.
- Webhook verification and request-state handling exist.
- OTP delivery can also use WhatsApp when `OTP_DELIVERY_MODE=WHATSAPP`.

### Production-Free Recommendation

- Use the official WhatsApp Cloud API for launch prep.
- Treat it as a usage-sensitive dependency, not a forever-free guarantee.

## Email and Account Recovery

- Password reset and account activation are now built into the platform.
- SMTP delivery is optional but supported through the API env file.
- If SMTP is not configured, local/dev still exposes recovery links for testing.

## Security Baseline Before Real Production

- disable `ALLOW_DEV_AUTH`
- replace demo passwords
- rotate all seeded demo accounts
- set strong `JWT_SECRET`
- restrict database and Redis ports to private access only
- keep only Caddy public on `80/443`
- keep backups for PostgreSQL volumes

## Backups

Minimum baseline:

- daily PostgreSQL dump
- persistent Docker volumes for Postgres, Redis, and Caddy
- off-VM copy of database backups

Example:

```bash
docker exec <postgres-container> pg_dump -U tayyar tayyar > tayyar-$(date +%F).sql
```

## QA Before Going Live

- Run [E:\Anti Gravity\Tayyar\scripts\smoke\launch-core.mjs](E:\Anti Gravity\Tayyar\scripts\smoke\launch-core.mjs)
- Verify the accounts in [E:\Anti Gravity\Tayyar\docs\testing\demo-accounts.md](E:\Anti Gravity\Tayyar\docs\testing\demo-accounts.md)
- Manually test merchant order creation, admin hero assignment, branch map editing, zones, and hero OTP login
- Check `GET /health/ready` before and after smoke execution
- Confirm Docker health checks go `healthy` for `postgres`, `redis`, `api`, and `web`

## Honest Limits

- This stack is free-first, not guaranteed free forever.
- Maps and WhatsApp can stay cheap or free for testing, but heavy production volume changes the cost picture.
- iOS public distribution is a paid channel.
