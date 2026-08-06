# Push Notification Credential Setup

## Status — CONFIGURED ✓

APNs credentials (Key ID `SBY28NMBSN`, Team `J2JTMZV5VX`) were uploaded to
EAS project `@rymax/survivor-guessing-game` (ID `03004af4-62c8-40b3-8fcf-b26830e9a3c5`).

A new production build was triggered on 2026-08-06:
https://expo.dev/accounts/rymax/projects/survivor-guessing-game/builds/f7a45429-3602-4763-a28b-517525c32a8b

## Why a new build was needed

The TestFlight build that registered the initial push tokens was built under
Replit's internal EAS project (`@replit-private-18b17663.../ultimate-survivor-fan-game`).
Push tokens are tied to the EAS project that was active at build time, so existing
tokens couldn't be fixed without a rebuild.

The new build runs under `@rymax/survivor-guessing-game` (which has APNs credentials),
so fresh tokens registered from this build will be deliverable.

## Steps to activate

1. **Wait for the EAS build to finish** (~20-40 min) — check progress at the link above
2. **Submit to TestFlight** (if not auto-submitted): run  
   `cd artifacts/survivor-mobile && EXPO_TOKEN=$EXPO_TOKEN npx eas-cli submit --platform ios --latest`
3. **Install the new build** on your test devices
4. **Re-enable push notifications** in the app (Profile → toggle push on, or uninstall and reinstall to trigger the opt-in prompt again)
5. **Verify a token was registered** by checking the `push_tokens` table in production

## Verify tokens work after install

After re-enabling push and confirming a token appears in the `push_tokens` table,
run this from the workspace shell:

```bash
# Replace with the new token from the push_tokens table
TOKEN="ExponentPushToken[...]"
curl -s -X POST https://exp.host/--/api/v2/push/send \
  -H "Content-Type: application/json" \
  -d "[{\"to\":\"$TOKEN\",\"title\":\"Test\",\"body\":\"Hello from server ✓\",\"sound\":\"default\"}]"
```

A working response:
```json
{"data":[{"status":"ok","id":"XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX"}]}
```

## Device checklist (complete after new build is installed)

- [ ] Opt-in prompt appears; permission granted; token registered in `push_tokens` table
- [ ] Chat message from another account arrives as lock-screen notification (sender name + message)
- [ ] Tapping notification opens Chat tab
- [ ] Admin broadcast from web admin panel arrives on device
- [ ] Toggling push off in Profile stops delivery
- [ ] Scheduled episode reminder fires (set a week's `air_date` to ~10 min from now to test)
