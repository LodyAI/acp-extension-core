import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as core from '../dist/index.js';

test('prompt suggestions require explicit v1 negotiation', () => {
  assert.equal(typeof core.supportsLodyPromptSuggestions, 'function');
  for (const caps of [null, {}, [], {_meta: {lody: {promptSuggestions: true}}},
    {_meta: {lody: {promptSuggestions: {version: 2}}}}]) {
    assert.equal(core.supportsLodyPromptSuggestions(caps), false);
  }
  assert.equal(core.supportsLodyPromptSuggestions({_meta: {lody: {promptSuggestions: {version: 1}}}}), true);
});

test('prompt suggestion boundary distinguishes text, no suggestion and failure', () => {
  assert.equal(typeof core.isLodyPromptSuggestion, 'function');
  const base = {sessionId: 'session'};
  for (const result of [{type: 'completed', text: 'next'}, {type: 'completed', text: ''},
    {type: 'completed', text: null}, {type: 'failed'}]) {
    assert.equal(core.isLodyPromptSuggestion({...base, result}), true);
    assert.equal(core.isLodyPromptSuggestion({...base, sourceTurnId: 'turn', suggestionId: 'message', result}), true);
  }
  for (const value of [null, [], {}, {...base, result: {type: 'completed'}},
    {...base, result: {type: 'completed', text: 1}}, {...base, result: {type: 'unknown'}},
    {...base, sessionId: '', result: {type: 'failed'}},
    {...base, sourceTurnId: '', result: {type: 'failed'}},
    {...base, suggestionId: null, result: {type: 'failed'}}]) {
    assert.equal(core.isLodyPromptSuggestion(value), false);
  }
});
