# ACP Extension Core

Provider-neutral contracts for Lody capabilities that are not part of ACP.

## Design rules

- Use standard ACP whenever it can carry the behavior: `session/fork`,
  `elicitation/create`, `plan_update`, `usage_update`, and normal
  `tool_call`/`tool_call_update` lifecycle messages.
- Put Lody semantics on standard ACP messages under `_meta.lody.<feature>`.
- Advertise every optional feature under
  `InitializeResponse.agentCapabilities._meta.lody`, with an independent
  integer `version`.
- Use the `_lody/...` JSON-RPC namespace only when ACP has no equivalent
  request or notification.
- All absolute protocol timestamps are Unix epoch seconds and name that unit
  explicitly. Relative durations also name seconds explicitly.
- Provider adapters translate native data into these contracts. Consumers do
  not branch on provider-specific payloads.

## Standard ACP envelopes

| Feature                                 | ACP envelope                     | Lody metadata                                                   |
| --------------------------------------- | -------------------------------- | --------------------------------------------------------------- |
| Fork                                    | `session/fork`                   | `_meta.lody.forkAtTurn` for an optional source turn             |
| Ask user                                | `elicitation/create`             | `_meta.lody.elicitation` for details JSON Schema cannot express |
| Proposed plan                           | `plan_update` / `plan_removed`   | none required                                                   |
| Context occupancy                       | `usage_update`                   | none required                                                   |
| Subagent/background/scheduled lifecycle | `tool_call` / `tool_call_update` | `_meta.lody.task`                                               |
| Compaction/retry lifecycle              | `tool_call` / `tool_call_update` | `_meta.lody.activity`                                           |
| Canonical tool identity                 | `tool_call` / `tool_call_update` | `_meta.lody.toolName`                                           |
| Goal/notice/title/message phase         | normal session update            | `_meta.lody.<feature>`                                          |

## Custom methods

Method names and their request/response types are exported from `src/methods.ts`
and the adjacent contract modules. `LodyExtensionRequestMap`,
`LodyExtensionNotificationMap`, and `LodyExtensionRequestHandlers` bind every
wire name to its payload types so adapters cannot implement a method against an
unrelated DTO. Rate limits support both proactive
`_lody/rate_limits/update` notifications and independent
`_lody/rate_limits/get` queries. The query is not session-bound; `sessionId`,
`accountId`, and `modelId` are optional filters.

Each rate limit's `windows` is the complete current list of concurrent quota
constraints. A window may carry a provider-supplied `label` such as `Fable`,
displayed alongside its duration. Multiple windows may have the same duration:
an all-model weekly quota and a model weekly sub-cap remain separate meters,
not additive allowances. Labels are display-only; do not use them for routing
or deduplicate windows by duration, utilization, or reset time. This optional
field is additive to the version 1 rate-limit contract.

Adapters should emit only the current contracts. Compatibility with payloads
that predate this package belongs at the consumer boundary and should be
time-bounded.

`LODY_TOOL_NAMES` defines the stable identities for tool flows that Lody treats
specially. Adapters map provider-native names to these values; consumers never
infer behavior from a human-facing tool title.

## Plan mode configuration

`LODY_PLAN_MODE_CONFIG_ID` is `plan_mode`. `createPlanModeConfigOption(active)`
builds the boolean ACP config option; clients send boolean values through
`session/set_config_option` and consume normal config snapshots/updates. There
is no separate Plan RPC or provider-specific collaboration vocabulary.

Providers advertise this option only for sessions that support independent
planning. Selecting it preserves sandbox and approval policy; it does not
promise read-only enforcement. Providers own the native translation, durable
state, plan review, and pending-switch behavior. Claude's permission-based Plan
mode is outside this contract.
