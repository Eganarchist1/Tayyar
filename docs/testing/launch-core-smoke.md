# Launch Core Smoke

Run this before QA rounds, staging pushes, or production-prep reviews.

## Command

```bash
npm run smoke:launch-core
```

## Optional Environment Overrides

```bash
API_BASE_URL=http://127.0.0.1:3001
WEB_BASE_URL=http://127.0.0.1:3000
DEMO_PASSWORD=Tayyar@123
```

## What It Verifies

- API health is live.
- Web login screen is reachable.
- Email/password login works for:
  - admin
  - merchant owner
  - supervisor
  - branch manager
- Hero OTP request and verify work in local/dev mode.
- Account activation, password reset, and password change work.
- Authenticated API checks work for:
  - admin
  - merchant
  - supervisor
- Critical web routes return `200`.

## Script Location

- Smoke script: [E:\Anti Gravity\Tayyar\scripts\smoke\launch-core.mjs](E:\Anti Gravity\Tayyar\scripts\smoke\launch-core.mjs)

## Follow-Up Manual Checks

After the script passes, manually confirm:

1. Merchant order creation with map pin confirmation.
2. Admin hero edit and branch assignment.
3. Admin branch edit with map pin adjustment.
4. Zone creation by clicking the map.
5. Supervisor live map markers and zone overlays.
6. Hero mission page map rendering.
