---
name: Post-merge setup timeout
description: Runtime guidance for the automatic dependency, schema, and backfill reconciliation after task merges.
---

The post-merge setup window must include enough buffer for dependency installation, schema synchronization, and idempotent data backfills together; the default 20-second window can be too tight even when every command succeeds.

**Why:** A merged tribe-membership change completed its schema push and backfill just beyond the default timeout, causing a false setup failure.

**How to apply:** When post-merge logs show all commands completing but the wrapper times out, increase the configured timeout rather than changing a healthy setup script. Re-run the setup to verify both setup and workflow reconciliation.