import type {
  LodyClientExtensionCapabilities,
  LodyElicitationAnswer,
  LodyElicitationAnswerNote,
  LodyElicitationMeta,
  LodyElicitationQuestion,
} from '../../src/index.js';

// Existing v1 producers/consumers need no new required fields.
const legacyQuestion: LodyElicitationQuestion = {
  id: 'approach', question: 'Which approach?', header: 'Approach',
  options: [{ label: 'Small change' }], multiSelect: false,
  allowCustomAnswer: true,
};
const legacyProperty: LodyElicitationMeta = {
  version: 1, customAnswerFor: 'approach', secret: false,
};
const legacyAnswers: Record<string, LodyElicitationAnswer> = {
  approach: 'Something else', multiple: ['First', 'Second'],
};

const capabilities = {
  elicitation: { version: 1, answerNotes: true },
} satisfies LodyClientExtensionCapabilities;
const noExtensions: LodyClientExtensionCapabilities = {};
const oldElicitation: LodyClientExtensionCapabilities = {
  elicitation: { version: 1 },
};
const noteProperty = {
  version: 1, noteFor: 'approach', secret: true,
} satisfies LodyElicitationMeta;
const question = {
  ...legacyQuestion,
  allowCustomAnswer: false,
  note: { fieldId: 'approach_note', title: 'Context', isSecret: true },
} satisfies LodyElicitationQuestion;
const persisted = {
  version: 1,
  questions: [question],
  answers: { approach: 'Small change', approach_note: 'Keep the public API stable.' },
} satisfies LodyElicitationMeta;

// Notes cannot silently replace the existing answer value shape.
// @ts-expect-error Structured answer objects would break existing consumers.
const invalidAnswer: LodyElicitationAnswer = { selection: 'Small change', note: 'Context' };
// @ts-expect-error Every normalized note must identify its separate answer key.
const missingFieldId: LodyElicitationAnswerNote = { title: 'Context' };
// @ts-expect-error Future versions require explicit support, not optimistic handling.
const unknownVersion: LodyClientExtensionCapabilities = { elicitation: { version: 2 } };

void [legacyProperty, legacyAnswers, capabilities, noExtensions, oldElicitation,
  noteProperty, persisted, invalidAnswer, missingFieldId, unknownVersion];
