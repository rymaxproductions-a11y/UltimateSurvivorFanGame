---
name: EXPO_UNAUTHORIZED recurring fix
description: What to do when Expo Go shows "You need to be authenticated with Expo for this route."
---
The mobile app in Expo Go sometimes shows `{"code":"EXPO_UNAUTHORIZED"}` when loading.

**Why:** The Expo dev server's session/manifest signing goes stale over long-running sessions in the Replit proxy environment. `EXPO_TOKEN` itself is valid (`expo whoami` succeeds), so it's not a login problem.

**How to apply:** Restart the `artifacts/survivor-mobile: expo` workflow, then verify with `curl -H "expo-platform: ios" https://$REPLIT_EXPO_DEV_DOMAIN` — a 200 with a JSON manifest means it's fixed. The user then reopens/rescans in Expo Go.
