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

## Logical local project identity

An agent advertising `worktreeProject: { version: 1 }` accepts
`_meta.lody.worktreeProject: { version: 1, originProjectPath: "/absolute/project" }`
on `session/new`, `session/load`, `session/resume`, and `session/fork`.
`LodyWorktreeProject` defines the payload. The client resolves the original local
project root on the agent host; ACP `cwd` remains the actual execution directory,
which may be a worktree. Only send this extension after capability negotiation.

The adapter resolves or creates the provider's project identity for that root.
New sessions and fork targets use the requested project. Load/resume fills an
unassigned session and preserves an existing assignment. Omission preserves
ordinary provider behavior and never clears an assignment. An agent that accepts
the extension must report an invalid or unresolvable project instead of silently
claiming success without the requested association.

Project identity does not grant directory access, add workspace roots, change
`cwd`, or transfer worktree creation/cleanup ownership to the provider. It does
not change the standard `session/list.cwd` filter or promise a provider-specific
worktree badge. Project-wide catalog queries are a separate extension concern.
