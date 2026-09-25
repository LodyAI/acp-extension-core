/** Disjoint token buckets: input excludes cache reads/writes; output excludes
 * reasoning. Their sum is the reported total token count. Optional token detail
 * may be unavailable; missing cost means unknown, not zero. costUSD is USD
 * (not ticks), and may be a provider bill
 * or a documented adapter estimate, never an authoritative invoice. */
export type ModelUsage = {
  inputTokens: number;
  outputTokens: number;
  cacheReadInputTokens: number;
  cacheCreationInputTokens?: number;
  reasoningOutputTokens?: number;
  webSearchRequests?: number;
  costUSD?: number;
  contextWindow?: number;
};

export type SessionUsageUpdate = {
  sessionId: string;
  /** Latest reported operation/turn snapshot, NOT a session total. Legacy
   * providers may send cumulative usage here; use modelUsage for accounting. */
  usage: ModelUsage;
  /** Cumulative per-model accounting for this ACP session's active accounting
   * lifetime. Includes every reported request, not just the last LLM step.
   * Do not sum successive snapshots. Replay contributes nothing; compaction
   * and model switches must not reset counters. A restarted accounting lifetime
   * requires a new consumer accounting identity or a restored baseline.
   * Missing models are not deletions; missing costs are not free usage. */
  modelUsage?: Record<string, ModelUsage>;
  /** Newly accounted contribution since the preceding emitted update (first:
   * since the accounting baseline). NOT another cumulative snapshot, and not
   * necessarily a full user turn: a turn may contain multiple requests.
   * The same contribution is already included in modelUsage; never add both.
   * Optional for legacy producers. Notification delivery is not an exactly-once
   * ledger: persist/reconcile cumulative modelUsage, not replayed deltas.
   * Late completion can add a correction; unknown delta cost stays omitted. */
  delta?: { usage: ModelUsage; modelUsage: Record<string, ModelUsage> };
  _meta?: { lody?: SessionUsageScopeMeta };
};

/** Optional accounting scope. When present, `modelUsage` is cumulative only
 * within this scope (for example one native turn or one SDK result), and
 * consumers account each scope independently and sum the scopes. The id must be
 * unique within the ACP session and never reused by a later accounting lifetime,
 * so an adapter restart cannot re-enter an old scope from zero. At most 256
 * characters. Unscoped updates keep the session-lifetime semantics above. */
export type SessionUsageScopeMeta = { usageScopeId: string };

export const MAX_USAGE_SCOPE_ID_LENGTH = 256;

const counters = [
  'inputTokens',
  'outputTokens',
  'cacheReadInputTokens',
  'cacheCreationInputTokens',
  'reasoningOutputTokens',
  'webSearchRequests',
] as const;
const emptyUsage = (): ModelUsage => ({ inputTokens: 0, outputTokens: 0, cacheReadInputTokens: 0 });

/** Sum disjoint accounting rows. Unknown costs propagate instead of becoming $0. */
export function sumModelUsage(rows: Record<string, ModelUsage>): ModelUsage {
  const result = emptyUsage();
  const values = Object.values(rows);
  for (const row of values) {
    for (const key of counters) result[key] = (result[key] ?? 0) + (row[key] ?? 0);
  }
  if (values.length > 0 && values.every((row) => row.costUSD !== undefined)) {
    result.costUSD = values.reduce((sum, row) => sum + (row.costUSD ?? 0), 0);
  }
  return result;
}

/** Adapter-local ledger of synthetic/native operation IDs, never transcripts.
 * Repeated snapshots of one operation are merged monotonically, allowing an
 * incomplete result to be completed without counting the operation twice.
 * Keep this instance for the accounting lifetime, not one prompt. Its totals are
 * process-local, so every update is scoped by this instance's never-reused
 * `usageScopeId`; a restarted process starts a new scope instead of re-entering
 * the old one from zero. */
export class SessionUsageAccumulator {
  private operations = new Map<string, Record<string, ModelUsage>>();
  private totals: Record<string, ModelUsage> = {};
  readonly usageScopeId: string;

  constructor(usageScopeId: string = globalThis.crypto.randomUUID()) {
    this.usageScopeId = usageScopeId;
  }

  update(
    sessionId: string,
    operationId: string,
    rows: Record<string, ModelUsage>
  ): SessionUsageUpdate | undefined {
    const previous = this.operations.get(operationId) ?? {};
    const merged: Record<string, ModelUsage> = Object.assign(
      Object.create(null),
      structuredClone(previous)
    );
    for (const [model, row] of Object.entries(rows)) {
      const next = merged[model] ?? emptyUsage();
      for (const key of counters) next[key] = Math.max(next[key] ?? 0, row[key] ?? 0);
      if (row.costUSD !== undefined) next.costUSD = Math.max(next.costUSD ?? 0, row.costUSD);
      merged[model] = next;
    }
    if (JSON.stringify(previous) === JSON.stringify(merged)) return undefined;
    this.operations.set(operationId, merged);
    const grouped: Record<string, Record<string, ModelUsage>> = Object.create(null);
    for (const [id, models] of this.operations) {
      for (const [model, row] of Object.entries(models))
        (grouped[model] ??= Object.create(null))[id] = row;
    }
    const next: Record<string, ModelUsage> = Object.create(null);
    const delta: Record<string, ModelUsage> = Object.create(null);
    for (const [model, contributions] of Object.entries(grouped)) {
      const total = sumModelUsage(contributions);
      next[model] = total;
      const old = this.totals[model];
      const difference = emptyUsage();
      for (const key of counters) difference[key] = (total[key] ?? 0) - (old?.[key] ?? 0);
      if (total.costUSD !== undefined && (!old || old.costUSD !== undefined)) {
        difference.costUSD = total.costUSD - (old?.costUSD ?? 0);
      }
      delta[model] = difference;
    }
    this.totals = next;
    return structuredClone({
      sessionId,
      usage: sumModelUsage(merged),
      modelUsage: next,
      delta: { usage: sumModelUsage(delta), modelUsage: delta },
      _meta: { lody: { usageScopeId: this.usageScopeId } },
    });
  }
}
