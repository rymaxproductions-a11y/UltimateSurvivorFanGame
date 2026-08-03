---
name: pnpm override compatibility
description: How to safely override vulnerable transitive deps in this pnpm workspace
---

Rule: never globally override a transitive dep that has multiple incompatible major versions in the tree. Scope overrides with version-qualified parent selectors, e.g. `"minimatch@3>brace-expansion": "^2.1.4"` and `"minimatch@10>brace-expansion": "^5.0.9"`.

**Why:** A global `brace-expansion: ^5` override broke minimatch@3 at runtime (`TypeError: expand is not a function`) — v5's CommonJS export shape differs from v1/v2. Code review rejected the change.

**How to apply:** pnpm 10 supports `parent@major>dep` selectors in `pnpm.overrides`, but NOT 3+ level path selectors (`a>b>c` fails with ERR_PNPM_INVALID_SELECTOR). After overriding, smoke-test each affected major version via `node_modules/.pnpm/<pkg>@<ver>/...` requires, and start the Expo workflow (its Metro bundle exercises legacy glob/minimatch paths).
