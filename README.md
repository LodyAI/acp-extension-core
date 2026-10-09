# ACP Extension Core

Provider-neutral contracts for the Lody extensions that sit on top of [Agent Client Protocol](https://agentclientprotocol.com/) v1.

Lody connects to many agent runtimes, and each one speaks its own dialect. ACP covers the common core, but features such as streaming subagent execution, durable goals, token accounting, and rate limits need a shared and stable description before clients can rely on them. This package is that description: a provider adapter translates its runtime into these contracts once, and any client that has negotiated the corresponding capability can read the result without knowing which runtime produced it.

Extensions are negotiated, not assumed. An agent advertises what it implements on `InitializeResponse.agentCapabilities._meta.lody`; a client advertises its own features on `InitializeRequest.clientCapabilities._meta.lody`. Each key carries its own `{ "version": 1 }`, and a missing key means the peer does not support that feature. Clients branch on the negotiated capability, never on which provider is behind the connection.

[中文](README.zh.md)

## Reference implementations

The following public `acp-extension-*` repositories under [github.com/LodyAI](https://github.com/LodyAI) implement or consume this contract, as of 2026-10-01. This repository is the shared contract; the other eight are provider adapters that speak ACP v1 and map their provider onto the contracts above.

| Repository | What it covers |
| --- | --- |
| [acp-extension-core](https://github.com/LodyAI/acp-extension-core) | Shared v1 types, capability flags, and `_lody/` methods. This repository. |
| [acp-extension-claude](https://github.com/LodyAI/acp-extension-claude) | An ACP agent for the Claude Agent SDK, including Lody subagent events. |
| [acp-extension-codex](https://github.com/LodyAI/acp-extension-codex) | An ACP server for the Codex CLI / App Server, including fork, steer, and goals. |
| [acp-extension-devin](https://github.com/LodyAI/acp-extension-devin) | A proxy in front of Devin's native `devin acp`, translating Devin-only subagent traffic into Core events. |
| [acp-extension-dsh](https://github.com/LodyAI/acp-extension-dsh) | ACP session controls for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness): models, permissions, subagents, compaction. |
| [acp-extension-grok](https://github.com/LodyAI/acp-extension-grok) | An ACP compatibility adapter for the official Grok runtime, including scheduled tasks and subagent events. |
| [acp-extension-kimi](https://github.com/LodyAI/acp-extension-kimi) | The Kimi Code CLI packaged for Lody. |
| [acp-extension-omp](https://github.com/LodyAI/acp-extension-omp) | The Oh My Pi adapter for Lody. |
| [acp-extension-pi](https://github.com/LodyAI/acp-extension-pi) | An ACP adapter for the pinned official Pi CLI (`--mode rpc`). |

## Contents

- [Reference implementations](#reference-implementations)
- [Design principles](#design-principles)
- [Getting started](#getting-started)
- [How extensions are negotiated](#how-extensions-are-negotiated)
- [Capability catalog](#capability-catalog)
- [Custom `_lody/` methods](#custom-_lody-methods)
- [Metadata on standard ACP messages](#metadata-on-standard-acp-messages)
- [Shared rules](#shared-rules)
- [License](#license)

## Design principles

Three placement rules, in order of preference, keep the contract small and interoperable:

1. **Use standard ACP when it already fits.** `session/fork`, `elicitation/create`, `usage_update`, and the ordinary `tool_call` / `tool_call_update` lifecycle each already carry part of the behavior. Prefer them.
2. **Attach Lody semantics to standard messages.** Where ACP has no field for something, put it under `_meta.lody.<feature>` on the message that expresses the behavior.
3. **Add a `_lody/` method only when ACP has no equivalent.** The JSON-RPC namespace is reserved for requests and notifications that have no standard counterpart.

Every feature is versioned on its own. A `{ "version": 1 }` on one capability never implies support for another.

## Getting started

```bash
npm install acp-extension-core
```

The package is mostly TypeScript types: capability shapes, the request and notification maps, and the metadata interfaces that define the contract. It depends on [`@agentclientprotocol/sdk`](https://www.npmjs.com/package/@agentclientprotocol/sdk) for the ACP wire types, and also ships a few runtime helpers:

- `SessionUsageAccumulator` — merges repeated usage snapshots into cumulative per-model totals plus a per-update delta.
- `LodySubagentEmitter` — maps native subagent executions onto opaque run IDs and emits ordered `_lody/subagents/event` messages.
- `createPlanModeConfigOption` — builds the standard `plan_mode` ACP config option.
- `isLodySubagentEvent`, `isLodySubagentSnapshot`, `isLodySubagentOutput` — guards for validating payloads at the wire boundary.
- `supportsLodySubagentEvents` — reads the negotiated `subagentEvents` flag from an ACP capabilities object.

A typical consumer checks the negotiated capability first, then routes by the exported method name and validates at the boundary:

```ts
import {
  LODY_EXTENSION_METHODS,
  isLodySubagentEvent,
  supportsLodySubagentEvents,
} from 'acp-extension-core';

if (supportsLodySubagentEvents(agentCapabilities)) {
  onNotification(LODY_EXTENSION_METHODS.subagentEvent, (payload) => {
    if (!isLodySubagentEvent(payload)) return;
    // payload.runId is opaque; payload holds snapshot, progress, or output.
  });
}
```

To work on the package itself:

```bash
npm install
npm run build      # emit dist/
npm run typecheck  # type-check without emitting
npm test           # build, then run the contract tests
```

## How extensions are negotiated

Negotiation happens per feature, and some features require both directions.

- An **agent** advertises everything it implements under `InitializeResponse.agentCapabilities._meta.lody`.
- A **client** advertises its own features under `InitializeRequest.clientCapabilities._meta.lody`.
- Each key maps to an object containing at least `{ "version": 1 }`. A missing key means the peer does not support that feature, and support for one feature never implies support for another.
- A feature that needs both directions, such as `subagentEvents`, is active only after both peers advertise it. Agent-only features can be used as soon as the agent advertises them.

When ACP already provides a suitable message, the extension rides on it and no new method is added. Only when ACP has no equivalent request or notification does the contract define a `_lody/...` method.

## Capability catalog

### Agent capabilities (`LodyExtensionCapabilities`)

| Capability | What version 1 adds |
| --- | --- |
| `subagentEvents` | After **both** peers advertise it, the agent pushes child-run snapshots, progress, and output on [`_lody/subagents/event`](#custom-_lody-methods). Run IDs are opaque and never reuse native thread IDs; when observation is lost, the run state becomes `unknown` with `outputIncomplete: true`. `LodySubagentEmitter` is an optional adapter helper that covers one root session. |
| `sessionTitle` | The adapter owns automatic title generation and pushes a standard ACP `session_info_update` tagged with `_meta.lody.titleSource`. No request method is added. `generated` and `explicit` are authoritative title sources; `fallback` and `unset` are not. A title the user has set is always preserved. |
| `usage` | Context and token accounting. Prefer the standard ACP `usage_update`. Cumulative totals live in `modelUsage`; `delta` describes the newly accounted contribution and is already included in that total. The optional `_meta.lody.usageScopeId` makes `modelUsage` cumulative only within its scope, so a restarted adapter can begin a new scope. Missing cost means unknown, not zero. |
| `rateLimits` | Quota snapshots pushed on [`_lody/rate_limits/update`](#custom-_lody-methods). With `query: true`, the agent also accepts [`_lody/rate_limits/get`](#custom-_lody-methods). `windows` is the complete current list; a `label` is display-only, and windows with equal durations remain separate meters. |
| `forkAtTurn` | `session/fork` may carry `_meta.lody.forkAtTurn` (`{ version: 1, turnId? }`) to name the turn to fork from. |
| `steering` | Inject guidance into an in-flight turn. The agent advertises `transport` (`request` uses [`_lody/session/steer`](#custom-_lody-methods); `prompt` uses `_meta.lody.steer`), `upstreamTurn` (`same` or `handoff`), and `configPolicy` (`active` or `apply`). The result is `injected` or `failed`, and [`_lody/session/steer_applied`](#custom-_lody-methods) confirms the ID. |
| `tasks` | Background (`background: true`) and scheduled (`scheduled: true`) work. Lifecycle rides on ordinary `tool_call` / `tool_call_update` messages tagged with `_meta.lody.task` (`kind` is `background` or `scheduled`). |
| `subagents` | Subagent lifecycle on the same tool-call envelope (`kind: "subagent"`), independent of `subagentEvents`. `list`, `cancel`, and `output` each enable one query method. A client should show a control only when the individual run advertises it. |
| `goal` | A durable session goal rather than a prompt. `actions` lists everything the agent implements. `controlActions` are accepted on [`_lody/session/goal`](#custom-_lody-methods) while a prompt is in flight and never start a turn. `promptActions` travel on `session/prompt` as `_meta.lody.goalControl`; `set` and `resume` start work and therefore belong there, so the resulting turns stay attached to the client's own prompt. Read the transport from these two lists, not from `actions` alone. |
| `compaction` | Context compaction and retry, reported as a tool lifecycle tagged with `_meta.lody.activity` (`kind` is `context_compaction` or `retry`). |
| `sessionHistory` | Accepts [`_lody/session/history/read`](#custom-_lody-methods) for one session. The response body is empty. |
| `sessionConfig` | Client→agent startup metadata on new/load/resume/fork: `{ version: 1, modelId?, configOptionValues }`. Apply supported selections before native establishment; absence preserves native defaults. Explicit model selection takes precedence over a model option. |
| `worktreeProject` | On `session/new`, `session/load`, `session/resume`, and `session/fork`, `_meta.lody.worktreeProject` names the original project root (`originProjectPath`). ACP `cwd` remains the real execution directory. Omitting the field leaves the provider's ordinary project assignment unchanged. |

### Client capabilities (`LodyClientExtensionCapabilities`)

| Capability | What version 1 adds |
| --- | --- |
| `subagentEvents` | The client can receive [`_lody/subagents/event`](#custom-_lody-methods). Required together with the agent flag. |
| `elicitation` | The client preserves Lody fields on the standard `elicitation/create`. `answerNotes: true` means a selected option and its separate note both survive editing, submission, and read-only display. `noteFor` adds a note; `customAnswerFor` replaces the referenced answer. The two do not combine. |

### Standard ACP configuration

This option uses a fixed ID and needs no separate capability flag.

| Id | What version 1 adds |
| --- | --- |
| `plan_mode` | A boolean option created by `createPlanModeConfigOption` and set through `session/set_config_option`. Advertise it only for sessions that can plan independently. It leaves sandbox and approval policy unchanged. |

### Canonical tool IDs

`LODY_TOOL_NAMES` defines the stable identities for tool flows that Lody handles specially. Adapters map provider-native names onto these values, and consumers never infer behavior from a human-facing title. The ID is sent as `_meta.lody.toolName`.

| ID | Flow |
| --- | --- |
| `ImageGeneration` | Image generation |
| `CronCreate` | Create a schedule |
| `CronDelete` | Delete a schedule |
| `CronList` | List schedules |
| `ScheduleWakeup` | Wake a scheduled run |

## Custom `_lody/` methods

Method names and payload types are exported from `src/methods.ts`. `LodyExtensionRequestMap` and `LodyExtensionNotificationMap` bind each wire name to its DTO, so an adapter cannot implement a method against an unrelated type.

Requests:

| Method | Request | Response |
| --- | --- | --- |
| `_lody/rate_limits/get` | Optional filters `sessionId`, `accountId`, `modelId`. The call is not session-bound. | The current `RateLimitsSnapshot`. |
| `_lody/session/steer` | `sessionId`, `prompt` blocks, `steerId`. | `{ outcome: "injected" \| "failed" }`. |
| `_lody/session/goal` | `sessionId` plus `set` (with `objective`) or `pause` / `resume` / `clear`. | A `{ goal }` snapshot, or `null` when cleared. |
| `_lody/session/history/read` | `sessionId`. | An empty object. |
| `_lody/subagents/list` | `sessionId`, optional `activeOnly`. | `{ tasks }`. |
| `_lody/subagents/cancel` | `sessionId`, `taskId`, optional `reason`. | An empty object. |
| `_lody/subagents/output` | `sessionId`, `taskId`, optional `tail`. | `{ output }`. |

Notifications (agent to client):

| Method | Payload |
| --- | --- |
| `_lody/subagents/event` | `LodySubagentEvent`: `version: 1`, the root `sessionId`, an opaque `runId`, and then a `snapshot`, `progress`, or `output` (ACP text, thought, tool call, tool update, or plan). `isLodySubagentEvent` validates this boundary. Messages are delivered in connection order. |
| `_lody/session/usage_update` | `SessionUsageUpdate`: the latest operation in `usage`, cumulative per-model totals in `modelUsage`, and an optional `delta`. |
| `_lody/rate_limits/update` | The same snapshot shape as the query response. |
| `_lody/session/steer_applied` | `sessionId` and `steerId`. |

## Metadata on standard ACP messages

Each of these fields lives under `_meta.lody` on a message ACP already defines.

| Field | Envelope | Role |
| --- | --- | --- |
| `forkAtTurn` | `session/fork` | The optional source turn. |
| `elicitation` | `elicitation/create` | Questions, options, preview, secret, auto-resolve time, `customAnswerFor`, `noteFor`. |
| `task` | `tool_call`, `tool_call_update` | Subagent, background, or scheduled lifecycle (`LodyTaskMeta`). |
| `activity` | `tool_call`, `tool_call_update` | Compaction or retry (`LodyActivityMeta`). |
| `toolName` | `tool_call`, `tool_call_update` | A canonical ID from `LODY_TOOL_NAMES`. |
| `titleSource` | `session_info_update` | `explicit`, `generated`, `fallback`, or `unset`. |
| `goal` | session update | The agent-published `LodyGoalSnapshot`, or `null`. |
| `goalControl` | `session/prompt` | A client goal action. The prompt text is a fallback for when the action starts no native turn. |
| `steer` | `session/prompt` | `{ id }` for the prompt transport. |
| `notice` | session update | An `info`, `warning`, or `error` message. |
| `messagePhase` | session update | `commentary` or `final_answer`. |
| `worktreeProject` | `session/new`, `load`, `resume`, `fork` | `{ version: 1, originProjectPath }`. |
| `usageScopeId` | usage update | The accounting scope. Unique within the ACP session and never reused. |
| `turnId` | session meta | The turn ID, carried alongside the other session fields. |

## Shared rules

- Each feature is advertised independently. Support for one `{ "version": 1 }` must not be treated as support for the others.
- Absolute timestamps are Unix epoch **seconds**, and the field name says so. Durations expressed in seconds also say so; `durationMs` is milliseconds.
- Provider adapters map native payloads into these contracts. Consumers do not branch on provider-specific bodies.
- Rate-limit `windows` is a complete replacement list. Never merge windows that share a duration, utilization, or reset time.
- An elicitation note is its own string property. It survives an option change, and editing it does not switch the question into custom-answer mode. Empty notes are omitted, and each note references exactly one question in the same schema.
- Usage token buckets are disjoint: input excludes cache reads and writes, and output excludes reasoning. `costUSD` is in US dollars and may be a documented estimate. Sum scopes independently, and never add `delta` on top of `modelUsage`.
- `SessionUsageAccumulator` is process-local. Keep one instance for the accounting lifetime of the session; replay and compaction must not reset it.
- Goal actions that only move state (`pause`, `clear`, and any other advertised `controlActions`) must be accepted mid-prompt and must not start a turn.
- `worktreeProject` grants no directory access, does not change `cwd`, and does not move worktree creation or cleanup onto the provider. An accepted but unresolvable root is an error.
- Plan mode does not promise a read-only sandbox. Claude's permission-mode plan switch is outside this contract.
- Adapters emit only the current contracts. Compatibility with older payloads belongs at the consumer boundary and should be time-bounded.

## License

MIT — see [LICENSE](LICENSE).
