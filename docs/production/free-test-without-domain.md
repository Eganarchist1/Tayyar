# Tayyar Free Testing Without a Domain

This is the easiest way to put Tayyar online for testing before buying a domain.

## What You Need

- one free VM
- one public IP

Recommended:
- Oracle Cloud Always Free VM: [Oracle Always Free](https://docs.oracle.com/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm)

## What You Do Not Need Yet

- no domain
- no SSL
- no SMTP
- no WhatsApp

For the first public testing round, keep:
- `OTP_DELIVERY_MODE=CONSOLE`
- WhatsApp disabled
- SMTP disabled

## Included Files

- public test compose stack: [E:\Anti Gravity\Tayyar\infra\docker-compose.public-test.yml](E:\Anti Gravity\Tayyar\infra\docker-compose.public-test.yml)
- env generator: [E:\Anti Gravity\Tayyar\scripts\deploy\prepare-public-test-env.ps1](E:\Anti Gravity\Tayyar\scripts\deploy\prepare-public-test-env.ps1)

## Easiest Flow

Run this locally once:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/deploy/prepare-public-test-env.ps1 `
  -ServerIp YOUR_SERVER_IP
```

That writes:
- `infra/.env.public-test`
- `apps/api/.env.production`
- `apps/web/.env.production`
- `apps/hero-app/.env.production`

Then on the VM:

```bash
cd /srv/tayyar
cp infra/.env.public-test infra/.env
docker compose -f infra/docker-compose.public-test.yml up -d
cd packages/db
npm run db:push
```

## Test URLs

- Web: `http://YOUR_SERVER_IP:3000`
- API readiness: `http://YOUR_SERVER_IP:3001/health/ready`

## Limits

- HTTP only
- not suitable for real public production
- not suitable for final WhatsApp webhook setup
- good enough for private testing and internal QA

## Next Step Later

When you buy a domain:
- switch to [E:\Anti Gravity\Tayyar\infra\docker-compose.free-first.yml](E:\Anti Gravity\Tayyar\infra\docker-compose.free-first.yml)
- use [E:\Anti Gravity\Tayyar\infra\Caddyfile](E:\Anti Gravity\Tayyar\infra\Caddyfile)
- enable SSL and public subdomains
