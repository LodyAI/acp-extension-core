# ACP extension contracts

`CLAUDE.md` is a symlink to this file. Edit `AGENTS.md` only.

- Rate-limit windows are concurrent constraints. Optional `label` is a
  provider-supplied display name shown alongside duration, never a routing key.
  Equal durations, utilization, or reset times do not make windows duplicates.
  Preserve compatibility with version 1 payloads that omit the label.
- Run `npm run build` and `npm run typecheck` when changing contracts.
- MCP opt-out is version 1 with `supported: false`; omission preserves ACP
  defaults. It never authorizes silently dropping a turn's selected MCP servers.
