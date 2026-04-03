# Tayyar Demo Accounts

These accounts are intended for QA, role testing, and smoke checks on the seeded local stack.

## Default Password

- Password for email login: `Tayyar@123`

## Back-Office Accounts

- Admin: `admin@tayyar.app`
- Merchant owner: `owner@merchant.com`
- Supervisor: `supervisor@tayyar.app`
- Branch manager: `branch.manager@tayyar.app`

## Hero Account

- Hero email: `hero@tayyar.app`
- Hero phone for OTP login: `+201000000004`

## Hero OTP in Local Testing

- In non-production mode, `POST /v1/auth/otp/request` returns a `devCode`.
- The hero app login screen also shows the test code in local/dev mode after requesting OTP.
- In production, the code is not returned and must be delivered by the configured OTP transport.

## Recommended QA Flow

1. Login as admin and verify `/admin/users`, `/admin/heroes`, `/admin/zones`, and `/admin/map`.
2. Login as merchant owner and verify `/merchant/orders/new`, `/merchant/customers`, and `/merchant/branches`.
3. Login as supervisor and verify `/supervisor/map` and `/supervisor/alerts`.
4. Login as branch manager and verify `/branch/orders`.
5. Login as hero with OTP and verify the hero mission list and order map.

## Resetting the Demo Dataset

- Seed command: run the Prisma seed configured in [E:\Anti Gravity\Tayyar\packages\db\package.json](E:\Anti Gravity\Tayyar\packages\db\package.json)
- Demo seed source: [E:\Anti Gravity\Tayyar\packages\db\prisma\demo-seed.ts](E:\Anti Gravity\Tayyar\packages\db\prisma\demo-seed.ts)
