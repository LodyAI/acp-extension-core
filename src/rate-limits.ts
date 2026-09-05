export type RateLimitWindow = {
  /** Provider-supplied scope label (for example, "Fable"), shown alongside the duration.
   * Display-only: absence means an unlabeled window, not a model-selection rule.
   * Equal durations may describe distinct quotas and must not be deduplicated.
   */
  label?: string;
  /** Normalized percentage in the inclusive 0..100 range. */
  usedPercent: number;
  windowDurationSeconds: number | null;
  resetsAtEpochSeconds: number | null;
};

export type RateLimitWallet = {
  balanceCents: number;
  totalCents: number;
  monthlyChargeLimitEnabled: boolean;
  monthlyChargeLimitCents: number;
  monthlyUsedCents: number;
  currency: string;
};

export type RateLimitScope = {
  providerId: string;
  accountId?: string;
  modelId?: string;
};

export type RateLimit = {
  limitId: string;
  scope: RateLimitScope;
  limitName?: string | null;
  planName?: string | null;
  windows: RateLimitWindow[];
  wallet?: RateLimitWallet | null;
};

export type RateLimitsSnapshot = {
  rateLimits: RateLimit[];
  fetchedAtEpochSeconds?: number;
};

export type RateLimitsGetRequest = {
  sessionId?: string;
  accountId?: string;
  modelId?: string;
};

export type RateLimitsGetResponse = RateLimitsSnapshot;
export type RateLimitsUpdate = RateLimitsSnapshot;
