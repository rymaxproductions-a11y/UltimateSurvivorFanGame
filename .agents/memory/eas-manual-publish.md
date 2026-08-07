---
name: Manual EAS build/submit outside Replit publishing
description: Requirements for building/submitting the iOS app via eas-cli when Replit's publishing flow is broken.
---
When building/submitting the mobile app directly with `eas-cli` (bypassing Replit's publishing flow):

- **Env vars are NOT injected automatically.** Replit's flow bakes in `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` and `EXPO_PUBLIC_CLERK_PROXY_URL` (prod: `https://ultimate-survivor-fan-game.replit.app/api/__clerk`). A build without them crashes on device at launch with the app's "Something went wrong" error boundary (Clerk init throws). These are now stored in the EAS project's `production` environment (`eas env:list --environment production` to verify).
- **Why:** build 12 (Aug 2026) shipped without them and crashed on every real device; simulator/dev worked because workspace env supplied them.
- **Non-interactive submit needs `ascAppId`** — set in `eas.json` submit.production.ios (value `6767841158`, discovered from prior EAS submissions via GraphQL).
- Run all eas-cli commands with `EXPO_TOKEN=$EXPO_TOKEN npx --yes eas-cli@latest ...`.
- Build numbering is manual (user pref in replit.md) — bump `ios.buildNumber` in app.json before each build.
