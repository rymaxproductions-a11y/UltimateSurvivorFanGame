---
name: Cross-platform consent prompts
description: Why score/data-sharing consent should use an in-app modal instead of nested React Native alerts.
---

Use a shared in-app modal for consent that must behave consistently across iOS, Android, and React Native Web. Do not open a second multi-button system alert from the callback of a first confirmation alert.

**Why:** React Native Web can suppress or auto-handle the nested alert, allowing the original action to continue without presenting the required consent choices. Native platforms and web previews then behave differently at exactly the point App Review checks.

**How to apply:** Make explicit accept/decline controls part of app UI, gate the network mutation on the returned decision, persist acceptance per signed-in user, and use a synchronous ref as the lock while acceptance is being saved.