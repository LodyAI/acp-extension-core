export const EXT_METHOD_NAME = {
  usage_update: 'acp_ext:session_usage_update',
  rate_limits: 'acp_ext:session_rate_limits',
} as const;

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
  usage: ModelUsage;
  modelUsage?: Record<string, ModelUsage>;
};

export type UsageWindow = {
  /** Normalized 0..100 usage percentage. */
  usedPercent: number;
  windowDurationMins: number | null;
  resetsAt: number | null;
};

export type UsageData = {
  schemaVersion?: 2;
  planName: string | null;
  limitName?: string | null;
  limitId?: string | null;
  /** Provider-reported windows. Prefer this over the legacy fixed fields when present. */
  windows?: UsageWindow[];
  fiveHour: number | null;
  sevenDay: number | null;
  fiveHourResetAt: number | null;
  sevenDayResetAt: number | null;
  apiUnavailable?: boolean;
};
