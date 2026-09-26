import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isLodySubagentEvent, isLodySubagentOutput, isLodySubagentProgress, supportsLodySubagentEvents } from '../dist/index.js';

test('subagent negotiation and event validation preserve only the closed execution contract', () => {
  const base = {version: 1, sessionId: 'root', runId: 'run'};
  assert.equal(supportsLodySubagentEvents({_meta: {lody: {subagentEvents: {version: 1}}}}), true);
  assert.equal(supportsLodySubagentEvents({_meta: {lody: {subagents: {version: 1}}}}), false);
  assert.equal(supportsLodySubagentEvents({_meta: {lody: {subagentEvents: {version: 2}}}}), false);
  assert.equal(isLodySubagentEvent({...base, type: 'snapshot', snapshot: {
    state: 'unknown', outputIncomplete: true, reason: {code: 'disconnected'}, parentRunId: null,
    support: {stream: ['text', 'tool'], progress: false, outputRead: 'none', cancel: false},
  }}), true);
  assert.equal(isLodySubagentProgress({summary: null, lastToolName: 'read', totalTokens: 123}), true);
  assert.equal(isLodySubagentProgress({totalTokens: -1}), false);
  assert.equal(isLodySubagentProgress({contextTokens: Infinity}), false);
  const snapshot = {state: 'running', support: {stream: ['text'], progress: false, outputRead: 'none', cancel: false}};
  for (const malformed of [
    {...snapshot, state: ['running']},
    {...snapshot, support: {...snapshot.support, outputRead: ['none']}},
    {...snapshot, reason: {code: ['lost']}},
  ]) assert.equal(isLodySubagentEvent({...base, type: 'snapshot', snapshot: malformed}), false);
  assert.equal(isLodySubagentEvent({...base, type: 'output', update: {sessionUpdate: 'usage_update', used: 1, size: 2}}), false);
  assert.equal(isLodySubagentEvent({...base, runId: '', type: 'output', update: {sessionUpdate: 'agent_message_chunk', content: {type: 'text', text: 'hello'}}}), false);
});

test('ACP content validation retains rich content and rejects malformed known nested fields', () => {
  const tool = {sessionUpdate: 'tool_call', toolCallId: 'tool', title: 'Inspect', kind: 'read', status: 'in_progress', content: [
    {type: 'content', content: {type: 'resource', resource: {uri: 'file:///test', text: 'synthetic', mimeType: 'text/plain'}}},
    {type: 'diff', path: '/test', newText: 'new'},
    {type: 'terminal', terminalId: 'terminal'},
  ]};
  assert.equal(isLodySubagentOutput(tool), true);
  for (const bad of [
    {...tool, status: null}, {...tool, status: 'unknown'}, {...tool, status: ['completed']}, {...tool, _meta: []},
    {...tool, locations: [{path: '/test', line: 1.5}]}, {...tool, name: {}},
    {...tool, content: [{type: 'content', content: {type: 'text', text: 'ok', annotations: {audience: ['system']}}}]},
    {...tool, content: [{type: 'content', content: {type: 'image', data: 'x', mimeType: 'image/png', uri: []}}]},
    {...tool, content: [{type: 'content', content: {type: 'resource_link', name: 'n', uri: 'u', size: 'bad'}}]},
    {sessionUpdate: 'agent_message_chunk', content: {type: 'text', text: 'ok'}, messageId: 5},
    {sessionUpdate: 'plan', entries: [{content: 'inspect', status: 'pending', priority: 'high', _meta: 5}]},
  ]) assert.equal(isLodySubagentOutput(bad), false, JSON.stringify(bad));
  assert.equal(isLodySubagentOutput({sessionUpdate: 'tool_call_update', toolCallId: 'tool', status: null, content: null}), true);
});
