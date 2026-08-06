---
name: EXPO_UNAUTHORIZED — two distinct causes
description: How to diagnose "You need to be authenticated with Expo for this route." in dev vs. App Store publishing.
---
The error `{"code":"EXPO_UNAUTHORIZED"}` has appeared in two unrelated places:

1. **Expo Go / dev preview** — stale dev-server session. Fix: restart the `artifacts/survivor-mobile: expo` workflow; verify `curl -H "expo-platform: ios" https://$REPLIT_EXPO_DEV_DOMAIN` returns a 200 JSON manifest.

2. **Replit's App Store Publishing flow** — the workspace `EXPO_TOKEN` is valid (verify with `expo whoami` / `npx eas-cli whoami` and `eas build:list`, which have succeeded even while publishing failed). The failure is in the Replit publishing pipeline's own Expo session, which the agent cannot fix — it's a platform-side issue. The user resolved it before via Replit support; direct them there again and note the recurrence.

**How to apply:** Always ask/determine WHERE the error appears before acting — the dev-restart fix does nothing for the publishing case.
