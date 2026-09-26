/// <reference lib="esnext.disposable" />
import type { SessionNotification } from '@agentclientprotocol/sdk';

export const LODY_SUBAGENT_EVENT_METHOD = '_lody/subagents/event';
export type LodySubagentState = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled' | 'unknown';
export type LodySubagentSupport = {
  stream: Array<'text' | 'thought' | 'tool' | 'plan'>;
  progress: boolean;
  outputRead: 'none' | 'live_tail' | 'final_tail';
  cancel: boolean;
};
export type LodySubagentSnapshot = {
  state: LodySubagentState;
  parentRunId?: string | null;
  parentToolCallId?: string;
  name?: string;
  description?: string;
  modelId?: string;
  startedAtEpochSeconds?: number;
  endedAtEpochSeconds?: number;
  summary?: string;
  outputIncomplete?: true;
  reason?: { code: 'error' | 'timeout' | 'cancelled' | 'disconnected' | 'lost'; message?: string };
  support: LodySubagentSupport;
};
export type LodySubagentProgress = {
  summary?: string | null;
  lastToolName?: string | null;
  toolsUsed?: string[] | null;
  durationMs?: number | null;
  turnCount?: number | null;
  toolCallCount?: number | null;
  errorCount?: number | null;
  totalTokens?: number | null;
  contextTokens?: number | null;
  contextWindowTokens?: number | null;
  contextUsagePercent?: number | null;
};
export type LodySubagentOutput = Extract<SessionNotification['update'], {
  sessionUpdate: 'agent_message_chunk' | 'agent_thought_chunk' | 'tool_call' | 'tool_call_update' | 'plan';
}>;
export type LodySubagentEvent = { version: 1; sessionId: string; runId: string } & (
  | { type: 'snapshot'; snapshot: LodySubagentSnapshot }
  | { type: 'progress'; progress: LodySubagentProgress }
  | { type: 'output'; update: LodySubagentOutput; nativeTurnId?: string; messageId?: string }
);

function record(v: unknown): v is Record<string, unknown> { return typeof v === 'object' && v !== null && !Array.isArray(v); }
function text(v: unknown): v is string { return typeof v === 'string'; }
function member(v: unknown, choices: readonly string[]): boolean { return text(v) && choices.includes(v); }
function number(v: unknown): v is number { return typeof v === 'number' && Number.isFinite(v) && v >= 0; }
function optional(v: Record<string, unknown>, keys: string[], check: (v: unknown) => boolean): boolean {
  return keys.every(k => v[k] === undefined || check(v[k]));
}
function nullable(check: (v: unknown) => boolean): (v: unknown) => boolean { return v => v === null || check(v); }
function meta(v: Record<string, unknown>): boolean { return optional(v, ['_meta'], nullable(record)); }
function annotations(v: unknown): boolean {
  return record(v) && meta(v)
    && optional(v, ['audience'], nullable(x => Array.isArray(x) && x.every(role => role === 'user' || role === 'assistant')))
    && optional(v, ['lastModified'], nullable(text))
    && optional(v, ['priority'], nullable(x => typeof x === 'number' && Number.isFinite(x)));
}
export function supportsLodySubagentEvents(capabilities: unknown): boolean {
  return record(capabilities) && record(capabilities['_meta']) && record(capabilities['_meta']['lody'])
    && record(capabilities['_meta']['lody']['subagentEvents']) && capabilities['_meta']['lody']['subagentEvents']['version'] === 1;
}
export function isLodySubagentSnapshot(v: unknown): v is LodySubagentSnapshot {
  if (!record(v) || !member(v['state'], ['pending', 'running', 'completed', 'failed', 'cancelled', 'unknown'])) return false;
  const s = v['support'];
  return record(s) && Array.isArray(s['stream']) && s['stream'].every(x => member(x, ['text', 'thought', 'tool', 'plan']))
    && typeof s['progress'] === 'boolean' && typeof s['cancel'] === 'boolean' && member(s['outputRead'], ['none', 'live_tail', 'final_tail'])
    && optional(v, ['parentRunId'], x => x === null || text(x))
    && optional(v, ['parentToolCallId', 'name', 'description', 'modelId', 'summary'], text)
    && optional(v, ['startedAtEpochSeconds', 'endedAtEpochSeconds'], number)
    && (v['outputIncomplete'] === undefined || v['outputIncomplete'] === true)
    && (v['reason'] === undefined || record(v['reason']) && member(v['reason']['code'], ['error', 'timeout', 'cancelled', 'disconnected', 'lost']) && optional(v['reason'], ['message'], text));
}
export function isLodySubagentProgress(v: unknown): v is LodySubagentProgress {
  return record(v) && optional(v, ['summary', 'lastToolName'], x => x === null || text(x))
    && optional(v, ['toolsUsed'], x => x === null || Array.isArray(x) && x.every(text))
    && optional(v, ['durationMs', 'turnCount', 'toolCallCount', 'errorCount', 'totalTokens', 'contextTokens', 'contextWindowTokens', 'contextUsagePercent'], x => x === null || number(x));
}

// ACP SDK 1.4 does not export its runtime guards. Keep this closed content
// boundary aligned with its public JSON schema without runtime code generation
// (Core also runs in browser renderers with a restrictive CSP).
function content(v: unknown): boolean {
  if (!record(v) || !meta(v) || !optional(v, ['annotations'], nullable(annotations))) return false;
  switch (v['type']) {
    case 'text': return text(v['text']);
    case 'image': return text(v['data']) && text(v['mimeType']) && optional(v, ['uri'], nullable(text));
    case 'audio': return text(v['data']) && text(v['mimeType']);
    case 'resource_link': return text(v['uri']) && text(v['name'])
      && optional(v, ['description', 'mimeType', 'title'], nullable(text))
      && optional(v, ['size'], nullable(Number.isSafeInteger));
    case 'resource': return record(v['resource']) && meta(v['resource']) && text(v['resource']['uri'])
      && optional(v['resource'], ['mimeType'], nullable(text))
      && (text(v['resource']['text']) || text(v['resource']['blob']));
    default: return false;
  }
}
export function isLodySubagentOutput(v: unknown): v is LodySubagentOutput {
  if (!record(v) || !meta(v)) return false;
  switch (v['sessionUpdate']) {
    case 'agent_message_chunk': case 'agent_thought_chunk': return content(v['content']) && optional(v, ['messageId'], nullable(text));
    case 'plan': return Array.isArray(v['entries']) && v['entries'].every(e => record(e) && meta(e) && text(e['content'])
      && member(e['priority'], ['high', 'medium', 'low']) && member(e['status'], ['pending', 'in_progress', 'completed']));
    case 'tool_call': case 'tool_call_update':
      return text(v['toolCallId']) && v['toolCallId'].length > 0 && (v['sessionUpdate'] !== 'tool_call' || text(v['title'])
          && ['status', 'kind', 'locations', 'content'].every(k => v[k] !== null))
        && optional(v, ['name'], nullable(text))
        && optional(v, ['title'], x => x === null || text(x))
        && optional(v, ['status'], x => x === null || member(x, ['pending', 'in_progress', 'completed', 'failed']))
        && optional(v, ['kind'], x => x === null || member(x, ['read', 'edit', 'delete', 'move', 'search', 'execute', 'think', 'fetch', 'switch_mode', 'other']))
        && optional(v, ['locations'], x => x === null || Array.isArray(x) && x.every(l => record(l) && meta(l) && text(l['path']) && optional(l, ['line'], nullable(line => number(line) && Number.isSafeInteger(line)))))
        && optional(v, ['content'], x => x === null || Array.isArray(x) && x.every(c => record(c) && meta(c) && (
          c['type'] === 'content' && content(c['content']) || c['type'] === 'terminal' && text(c['terminalId'])
          || c['type'] === 'diff' && text(c['path']) && text(c['newText']) && optional(c, ['oldText'], nullable(text)))));
    default: return false;
  }
}
export function isLodySubagentEvent(v: unknown): v is LodySubagentEvent {
  if (!record(v) || v['version'] !== 1 || !text(v['sessionId']) || !v['sessionId'] || !text(v['runId']) || !v['runId']) return false;
  switch (v['type']) {
    case 'snapshot': return isLodySubagentSnapshot(v['snapshot']);
    case 'progress': return isLodySubagentProgress(v['progress']);
    case 'output': return isLodySubagentOutput(v['update']) && optional(v, ['nativeTurnId', 'messageId'], text);
    default: return false;
  }
}
