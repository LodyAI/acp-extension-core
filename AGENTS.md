# ACP extension contracts

`CLAUDE.md` is a symlink to this file. Edit `AGENTS.md` only.

- Rate-limit windows are concurrent constraints. Optional `label` is a
  provider-supplied display name shown alongside duration, never a routing key.
  Equal durations, utilization, or reset times do not make windows duplicates.
  Preserve compatibility with version 1 payloads that omit the label.
- Run `npm run build` and `npm run typecheck` when changing contracts.
- `worktreeProject` is logical identity only: never change ACP cwd, permissions,
  workspace roots, or worktree lifecycle ownership to implement project grouping.


- Independent planning uses the boolean `plan_mode` config option from this package.
  It does not select sandbox or approval policy; advertise only when supported.
