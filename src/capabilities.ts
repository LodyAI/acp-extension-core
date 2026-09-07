export type LodyVersionOneCapability = {
  version: 1;
};

/** Explicitly opts out of all MCP; omission preserves standard ACP behavior. */
export type LodyMcpCapability = LodyVersionOneCapability & {
  supported: false;
};

export type LodySteeringCapability = LodyVersionOneCapability & {
  transport: 'request' | 'prompt';
  upstreamTurn: 'same' | 'handoff';
  configPolicy: 'active' | 'apply';
};

export type LodyGoalAction = 'set' | 'pause' | 'resume' | 'clear';

export type LodyGoalCapability = LodyVersionOneCapability & {
  actions: readonly LodyGoalAction[];
};

export type LodySubagentCapability = LodyVersionOneCapability & {
  lifecycle: true;
  list?: true;
  cancel?: true;
  output?: true;
};

export type LodyTaskCapability = LodyVersionOneCapability & {
  background?: true;
  scheduled?: true;
};

export type LodyRateLimitsCapability = LodyVersionOneCapability & {
  query?: true;
};

export type LodyExtensionCapabilities = {
  mcp?: LodyMcpCapability;
  usage?: LodyVersionOneCapability;
  rateLimits?: LodyRateLimitsCapability;
  forkAtTurn?: LodyVersionOneCapability;
  steering?: LodySteeringCapability;
  tasks?: LodyTaskCapability;
  subagents?: LodySubagentCapability;
  goal?: LodyGoalCapability;
  compaction?: LodyVersionOneCapability;
  sessionHistory?: LodyVersionOneCapability;
};
