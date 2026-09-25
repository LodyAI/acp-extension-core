# ACP Extension Core

Provider-neutral contracts for Lody capabilities that are not part of ACP.

## Design rules

- Use standard ACP whenever it can carry the behavior: `session/fork`,
  `elicitation/create`, `plan_update`, `usage_update`, and normal
  `tool_call`/`tool_call_update` lifecycle messages.
- Put Lody semantics on standard ACP messages under `_meta.lody.<feature>`.
- Advertise every optional feature under
  `InitializeResponse.agentCapabilities._meta.lody`, with an independent
  integer `version`. Client-side extensions are advertised under
  `InitializeRequest.clientCapabilities._meta.lody` instead.
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

## Automatic session titles

Advertise `agentCapabilities._meta.lody.sessionTitle: { version: 1 }` when the
adapter owns automatic title generation. The client can then skip its separate
title-generation process. This is a push contract, with no new request method:
use the existing ACP `session/update` callback after generating the title.

```json
{
  "sessionId": "session-id",
  "update": {
    "sessionUpdate": "session_info_update",
    "title": "Fix login redirect",
    "_meta": { "lody": { "titleSource": "generated" } }
  }
}
```

Use `generated` for model-generated titles and `explicit` for deliberate names.
`fallback` (for example a truncated first prompt) and `unset` are not authoritative.
Version 1 requires tagged titles; advertising support does not make untagged
previews trustworthy. Emit updates for the corresponding ACP session only.
Generation is best effort: failure leaves the client's draft title and does not
request a second generator. Clients must preserve titles their users set.

## Elicitation answer notes (0.1.6)

`customAnswerFor` still means an alternative answer that **replaces** the
referenced question's selection. Do not reinterpret existing version 1 payloads.
`noteFor` is additive: a user can choose an option and independently provide an
optional note. Both use standard ACP `elicitation/create`; no new RPC is needed.

Before sending `noteFor`, require standard ACP form support **and**
`clientCapabilities._meta.lody.elicitation: { version: 1, answerNotes: true }`.
`LodyClientExtensionCapabilities` types this client advertisement; it is not an
agent capability. A client advertises it only when parsing, editing, submission,
and persisted/read-only presentation all retain notes. An absent/unsupported
version or absent `answerNotes` means no support. Keep the legacy custom-answer
flow for those clients; never silently relabel a note as a replacement answer.

For example, these are two properties in one form's `requestedSchema`:

```json
{
  "approach": {
    "type": "string",
    "title": "Approach",
    "description": "Which approach should we use?",
    "enum": ["Small change", "Refactor", "None of the above"]
  },
  "approach_note": {
    "type": "string",
    "title": "Additional context",
    "_meta": { "lody": { "elicitation": { "version": 1, "noteFor": "approach" } } }
  }
}
```

The main property remains in `required`; the note is not required. The explicit
"None of the above" option, when needed, is supplied by the adapter, never
inferred by Core. Presentation stays compatible: question `title` is the short
header and `description` is the question text. Note `title`, `description`, and
property-level `secret` describe the note, not the selected answer.

Normalize this as a `LodyElicitationQuestion` with
`note: { fieldId: "approach_note", title: "Additional context" }`. Selecting an
option must not clear its note; editing the note must not activate custom-answer
mode. Persist both values in the existing `answers` map and return them under
the same schema property keys in ACP `content`:

```json
{ "approach": "Small change", "approach_note": "Keep the public API stable." }
```

Notes are strings, never option arrays. Omit an empty note. Cancellation and
decline retain their ACP meaning. `LodyElicitationAnswer` stays `string | string[]`
for backward compatibility; the note's schema narrows its value to a string.
Adapters translate these separate fields into provider-native answers, preserving
the choice. Provider-specific note prefixes do not belong in Core or client UI.
Read-only presentation must retain notes and mask secret notes independently.

Use distinct, nonempty question and note keys, including when user-supplied ids
already end in `_note`. A note must reference an existing question in the same
schema and must not also declare `customAnswerFor`. Permit at most one note per
question; no self-reference, reference chains, or references to custom-answer
fields. Consumers must reject malformed associations rather than overwrite or
reinterpret another answer. These are wire validation rules, not runtime
validation supplied by this type-only contract.

Publish Core 0.1.6 before releasing consumers of the new types. Updating Core
alone does not enable note support in an adapter or client.

## Usage accounting

`SessionUsageUpdate` keeps the latest operation in `usage`, cumulative per-model
totals in `modelUsage`, and optionally the newly accounted contribution in `delta`
(`usage` plus `modelUsage`). Delta is already included in the cumulative snapshot;
never add both. Legacy producers may omit delta and may use different top-level
usage scopes; accounting consumers use `modelUsage`.

Adapters whose cumulative counters cannot survive a restart should scope each
update with `_meta.lody.usageScopeId`. `modelUsage` is then cumulative only
within that scope; consumers account every scope independently and sum them. A
scope id is unique within the ACP session and never reused, so a restarted
adapter starts a new scope instead of re-entering an old one from zero. Prefer a
native identity that already exists, such as a turn or SDK result id.

All token buckets are disjoint. Missing cost means unknown, not free. Cost is USD,
possibly an adapter's documented estimate rather than a provider invoice.
An empty aggregate has no reported cost; it does not imply zero-dollar usage.
`SessionUsageAccumulator` merges repeated operation IDs monotonically, including
late completeness corrections, and returns detached snapshots. Keep it for the
whole ACP accounting lifetime; replay must not contribute and compaction must not
reset it. A process restart requires restored baselines or a new consumer accounting
identity. The helper stores IDs/counters only and is not a durable billing ledger.
Each instance scopes its updates with its own random `usageScopeId`, so a
restarted process never re-enters an earlier instance's totals.

Run `npm test` for synthetic accounting tests. Core 0.1.5 must be published before
releasing consumers of the new runtime helper.

## Goal control

A goal is durable session state, not a running prompt. Its two halves travel on
different transports because they need different things from ACP v1:

| Transport                       | Actions               | Property                               |
| ------------------------------- | --------------------- | -------------------------------------- |
| `_lody/session/goal` request    | status-only actions   | Never starts a turn; works mid-prompt  |
| `prompt._meta.lody.goalControl` | any advertised action | Runs inside the prompt the client owns |

The request exists for `pause` and `clear`: an active goal keeps a prompt open
across the agent's own continuations, so a client that could only speak through
prompts would have no way to reach a goal it wants to stop. Agents must accept
these mid-prompt and must not start a turn for them.

`set` and `resume` start work, and ACP v1 gives a client exactly one way to own
running work — its own prompt. The client sends a prompt carrying
`_meta.lody.goalControl` instead of user-visible command text; the agent applies
the action, adopts any turn the action started natively, and keeps that prompt
open for the goal's remaining turns. Status-only actions may travel this way
too, which is what lets a client reach a goal whose session is not running.

An agent may also accept work-starting actions on the request for clients that
cannot carry prompt metadata, but then the agent owns starting the work and the
client sees turns it never prompted. Clients that must attribute every turn to a
conversation entry use `promptActions` for exactly this reason.

`LodyGoalCapability` advertises `actions` (everything implemented),
`controlActions` (accepted on the request while a prompt is in flight), and
`promptActions` (accepted through prompt metadata). Clients must not infer an
action's transport from `actions` alone.

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
