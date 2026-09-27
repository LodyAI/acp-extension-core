import assert from 'node:assert/strict';
import test from 'node:test';

import { LodySubagentEmitter, isLodySubagentEvent } from '../dist/index.js';

test('execution reuse, late output, incomplete content and disconnect retain truthful snapshots', async () => {
  const events = [];
  let id = 0;
  const runs = new LodySubagentEmitter(
    'root',
    (event) => {
      events.push(event);
    },
    () => `run-${++id}`,
  );
  const snapshot = {
    state: 'running',
    name: 'Worker',
    support: { stream: ['text'], progress: true, cancel: false, outputRead: 'none' },
  };
  await runs.output('unknown', {
    sessionUpdate: 'agent_message_chunk',
    content: { type: 'text', text: 'orphan' },
  });
  await runs.start('native', snapshot);
  await runs.start('native', snapshot);
  await runs.progress('native', { toolCallCount: 3 });
  await runs.output('native', {
    sessionUpdate: 'agent_message_chunk',
    content: { type: 'text', text: 'hello' },
  });
  await runs.output('native', { sessionUpdate: 'permission' });
  await runs.snapshot('native', { state: 'completed' });
  await runs.output('native', {
    sessionUpdate: 'agent_message_chunk',
    content: { type: 'text', text: 'late' },
  });
  await runs.snapshot('native', { state: 'running' });
  await runs.start('native', snapshot);
  await runs.disconnect();
  assert.deepEqual(
    events.map((event) => [event.runId, event.type, event.snapshot?.state]),
    [
      ['run-1', 'snapshot', 'running'],
      ['run-1', 'progress', undefined],
      ['run-1', 'output', undefined],
      ['run-1', 'snapshot', 'running'],
      ['run-1', 'snapshot', 'completed'],
      ['run-2', 'snapshot', 'running'],
      ['run-2', 'snapshot', 'unknown'],
    ],
  );
  assert.equal(events[4].snapshot.outputIncomplete, true);
  assert.equal(events.at(-1).snapshot.reason.code, 'disconnected');
  assert.ok(events.every(isLodySubagentEvent));
});
