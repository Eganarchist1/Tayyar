# Tayyar Release QA Matrix

Use this matrix before external testing or production deployment.

## Role Matrix

### Admin

- login
- dashboard
- orders manual assignment
- orders re-dispatch
- heroes add/edit/assign/pause
- branches map edit
- zones create/edit
- reports export
- alerts visibility

### Merchant Owner

- login
- dashboard
- new order with saved address
- new order with typed address + pin confirm
- branches add/edit on map
- customers list/detail
- invoices and wallet refresh

### Supervisor

- login
- live map
- alerts
- orders monitor / reassignment follow-up
- hero visibility by zone

### Branch Manager

- login
- branch orders
- branch-level operational visibility

### Hero

- password or OTP login
- online/offline toggle
- active mission loading
- mission status progression
- OTP handoff
- queued sync after network failure
- wallet filter and sync state

## Locale Matrix

- Arabic RTL
- English LTR

Check on each launch-critical route:
- text language
- numeric formatting
- layout mirroring
- table alignment
- modal/drawer direction
- map side panel direction

## Theme Matrix

- Midnight default
- Fajr alternate

Check:
- contrast
- readable cards
- readable inputs
- notification panel layering
- map overlays and chips

## Viewport Matrix

- mobile narrow
- tablet
- laptop
- desktop wide

Check:
- sidebar scroll
- top bar actions
- dense tables
- drawers/modals
- map panels

## Connectivity Matrix

- healthy online state
- API unavailable
- Redis unavailable
- rapid refresh during reconnect
- hero mobile offline then sync

Check:
- visible loading state
- visible error state
- queued mobile actions
- readiness endpoint behavior

## Final Acceptance

- `npm run build` passes for API and web
- hero app TypeScript passes
- hero web export passes
- `npm run smoke:launch-core` passes
- `/health/ready` returns `ready`
- critical web routes return `200`
- no blocking console/runtime errors on launch-critical screens
