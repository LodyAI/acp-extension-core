import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SessionUsageAccumulator, sumModelUsage } from '../dist/usage.js';

const row = (inputTokens, costUSD) => ({
  inputTokens,
  outputTokens: 10,
  cacheReadInputTokens: 20,
  ...(costUSD === undefined ? {} : { costUSD }),
});

test('empty and unknown rows do not claim free usage', () => {
  assert.equal(sumModelUsage({}).costUSD, undefined);
  assert.equal(sumModelUsage({ a: row(10, 0), b: row(20) }).costUSD, undefined);
  assert.equal(sumModelUsage({ a: row(0, 0) }).costUSD, 0);
});

test('cumulative snapshots and delta account each operation once across models', () => {
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

test('incomplete-first can be corrected; unknown cost is never zero', () => {
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
