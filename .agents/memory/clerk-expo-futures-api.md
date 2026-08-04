---
name: Clerk Expo custom flows (Core v3 futures)
description: Compatibility lesson for writing custom auth UIs with @clerk/expo v4.
---

Rule: custom mobile auth screens must use Clerk's Core v3 "futures" API surface; v2 patterns (e.g. `signIn.create({strategy: ...})` driving the whole flow) fail at runtime with @clerk/expo v4.

**Why:** prior-knowledge Clerk API shapes are v2; the clerk-auth skill references cover email/password and OAuth but not every flow (e.g. password reset).

**How to apply:** for any flow not covered by the skill references, confirm the method surface from the installed @clerk/shared type declarations before writing code — never guess from memory.
