export type LodyVersionOneCapability = {
  version: 1;
};

export type LodySteeringCapability = LodyVersionOneCapability & {
  transport: 'request' | 'prompt';
  upstreamTurn: 'same' | 'handoff';
  configPolicy: 'active' | 'apply';
};

export type LodyGoalAction = 'set' | 'pause' | 'resume' | 'clear';

export type LodyGoalCapability = LodyVersionOneCapability & {
  /** Every action the agent implements, on any transport. */
  actions: readonly LodyGoalAction[];
  /**
   * Actions the agent accepts on `_lody/session/goal` while a prompt is in
   * flight. These only move durable goal state and never start a turn, so a
   * client can send them without owning the session's prompt slot.
   */
  controlActions?: readonly LodyGoalAction[];
  /**
   * Actions the agent accepts through `prompt._meta.lody.goalControl`. Actions
   * that start work appear only here: running them inside the client's own
   * prompt is what keeps the resulting turns attributable to a conversation.
   */
  promptActions?: readonly LodyGoalAction[];
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
