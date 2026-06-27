# Carrier Ops Dashboard

Operational dashboard for the HappyRobot Logistics inbound carrier-sales agent.
Next.js 16 (App Router) app that reads the Twin `calls` table natively via the
Twin REST gateway and writes ops actions (flag / carrier tag) back to Twin — no
second database.

Built to be imported as a **HappyRobot App** (Create App → Import from existing repo).

## Environment variables
- `NEXT_PUBLIC_TWIN_GATEWAY` — injected by the platform on deploy
- `NEXT_PUBLIC_ORG_ID` — injected by the platform on deploy
- `DASHBOARD_PASSWORD` — set this in the App settings (login gate)

## Local dev
```
npm install
npm run dev
```
