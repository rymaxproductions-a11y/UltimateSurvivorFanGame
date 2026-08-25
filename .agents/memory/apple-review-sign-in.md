---
name: Apple review sign-in
description: iOS testing behavior for the dedicated Apple reviewer password path.
---

The dedicated Apple review login works in Expo Go when the exact full review email is entered manually. iOS autofill or any email mismatch falls through to the normal Clerk sign-in path and reports that the account cannot be found.

**Why:** The dedicated review route is intentionally restricted to one exact email, rather than weakening ordinary account authentication.

**How to apply:** During iOS release verification, clear the email field and manually paste the supplied full reviewer email before entering its password. A Clerk “couldn't find your account” result indicates the exact-review route was not selected, not that the reviewer account failed to authenticate.