import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);

test('v1 elicitation consumers and additive note contracts typecheck together', () => {
  const result = spawnSync(process.execPath, [
    require.resolve('typescript/bin/tsc'),
    '--noEmit', '--strict', '--module', 'NodeNext',
    '--moduleResolution', 'NodeNext', '--target', 'ES2022',
    fileURLToPath(new URL('./fixtures/elicitation.ts', import.meta.url)),
  ], { encoding: 'utf8', windowsHide: true, timeout: 60_000 });
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stdout + result.stderr);
});
