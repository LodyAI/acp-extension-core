import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SessionUsageAccumulator, sumModelUsage } from '../dist/usage.js';

const row = (inputTokens, costUSD) => ({
  inputTokens,
  outputTokens: 10,
  cacheReadInputTokens: 20,
  ...(costUSD === undefined ? {} : { costUSD }),
});

await test('empty and unknown rows do not claim free usage', () => {
  assert.equal(sumModelUsage({}).costUSD, undefined);
  assert.equal(sumModelUsage({ a: row(10, 0), b: row(20) }).costUSD, undefined);
  assert.equal(sumModelUsage({ a: row(0, 0) }).costUSD, 0);
});

await test('cumulative snapshots and delta account each operation once across models', () => {
  const ledger = new SessionUsageAccumulator();
  const first = ledger.update('s', '1', { a: row(100, 0.1) });
  first.modelUsage.a.inputTokens = 999;
  assert.equal(ledger.update('s', '1', { a: row(100, 0.1) }), undefined);
  const next = ledger.update('s', '2', { a: row(200, 0.2), b: row(50, 0.3) });
  assert.equal(next.modelUsage.a.inputTokens, 300);
  assert.equal(next.modelUsage.b.inputTokens, 50);
  assert.equal(next.delta.usage.inputTokens, 250);
  assert.ok(Math.abs(next.modelUsage.a.costUSD - 0.3) < 1e-12);
});

await test('incomplete-first can be corrected; unknown cost is never zero', () => {
  const ledger = new SessionUsageAccumulator();
  ledger.update('s', '1', { a: row(100) });
  const corrected = ledger.update('s', '1', { a: row(150, 0.2) });
  assert.equal(corrected.modelUsage.a.inputTokens, 150);
  assert.equal(corrected.delta.usage.inputTokens, 50);
  assert.equal(corrected.modelUsage.a.costUSD, 0.2);
  assert.equal(corrected.delta.usage.costUSD, undefined);
  assert.equal(ledger.update('s', '1', { a: row(50) }), undefined);
  const unknown = ledger.update('s', '2', { a: row(20) });
  assert.equal(unknown.modelUsage.a.costUSD, undefined);
});

test('each accumulator lifetime is its own never-reused usage scope', () => {
  const before = new SessionUsageAccumulator();
  const first = before.update('s', '1', { a: row(5000) });
  // A restarted process builds a new accumulator whose totals start from zero.
  const after = new SessionUsageAccumulator();
  const restarted = after.update('s', '1', { a: row(40) });
  assert.equal(restarted.modelUsage.a.inputTokens, 40);
  assert.equal(first._meta.lody.usageScopeId, before.usageScopeId);
  assert.equal(restarted._meta.lody.usageScopeId, after.usageScopeId);
  assert.notEqual(before.usageScopeId, after.usageScopeId);
  const fixed = new SessionUsageAccumulator('fixed').update('s', '1', { a: row(1) });
  assert.equal(fixed._meta.lody.usageScopeId, 'fixed');
});
