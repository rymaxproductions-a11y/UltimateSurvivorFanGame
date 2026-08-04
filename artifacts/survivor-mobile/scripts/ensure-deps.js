#!/usr/bin/env node
/**
 * Pre-start dependency check for the mobile app.
 *
 * Verifies that the `expo` CLI binary is actually present in node_modules
 * before launching the dev server. It can go missing after dependency
 * changes or environment resets even though it's listed in package.json,
 * which previously caused the workflow to fail with the unhelpful
 * `Command "expo" not found`.
 *
 * If the binary is missing, we run `pnpm install` once to repair the
 * installation. If it's still missing afterwards, we exit with a clear
 * diagnostic message instead of failing silently.
 */
const { existsSync } = require('node:fs');
const { spawnSync } = require('node:child_process');
const path = require('node:path');

const pkgDir = path.resolve(__dirname, '..');

function expoBinExists() {
  // pnpm links workspace binaries into the package's own node_modules/.bin
  const candidates = [
    path.join(pkgDir, 'node_modules', '.bin', 'expo'),
    path.join(pkgDir, '..', '..', 'node_modules', '.bin', 'expo'),
  ];
  return candidates.some((p) => existsSync(p));
}

if (!expoBinExists()) {
  console.error(
    '[ensure-deps] The "expo" CLI binary is missing from node_modules/.bin - ' +
      'dependencies are not fully installed. Running "pnpm install" to repair...'
  );
  const result = spawnSync('pnpm', ['install'], {
    cwd: pkgDir,
    stdio: 'inherit',
  });
  if (result.status !== 0) {
    console.error(
      '[ensure-deps] ERROR: "pnpm install" failed (exit code ' +
        result.status +
        '). Fix the install errors above, then restart the workflow.'
    );
    process.exit(1);
  }
  if (!expoBinExists()) {
    console.error(
      '[ensure-deps] ERROR: "expo" binary is still missing after pnpm install. ' +
        'Try running "pnpm install" from the repo root, then restart the workflow.'
    );
    process.exit(1);
  }
  console.error('[ensure-deps] Dependencies repaired successfully.');
}
