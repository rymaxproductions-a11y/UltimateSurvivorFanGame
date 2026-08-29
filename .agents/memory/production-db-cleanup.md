---
name: Production database cleanup
description: Constraint and safety rule for destructive data resets around launch.
---

The agent-side database interface permits writes to development but exposes production as read-only.

**Why:** Production mutations need an explicit supported path and stronger protection than an autonomous SQL callback, especially for irreversible launch cleanup.

**How to apply:** Inventory both environments first, perform confirmed development cleanup through the database tool, and use the production database pane or a deliberately authenticated admin workflow for the production reset. Never claim production was changed from a read-only query.