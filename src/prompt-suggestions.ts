/** Advisory next-input snapshot. It is neither conversation content nor an instruction to send. */
export type LodyPromptSuggestion = {
  sessionId: string;
  /** Native origin turn, when the provider supplies it. Never inferred at receipt. */
  sourceTurnId?: string;
  /** Native suggestion/message identity, not a turn identity. */
  suggestionId?: string;
  result:
    | { type: 'completed'; text: string | null }
    | { type: 'failed' };
};

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function id(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

/** Both peers must advertise this capability before the adapter sends suggestions. */
export function supportsLodyPromptSuggestions(capabilities: unknown): boolean {
  if (!record(capabilities) || !record(capabilities['_meta'])) return false;
  const lody = capabilities['_meta']['lody'];
  return record(lody) && record(lody['promptSuggestions'])
    && lody['promptSuggestions']['version'] === 1;
}

export function isLodyPromptSuggestion(value: unknown): value is LodyPromptSuggestion {
  if (!record(value) || !id(value['sessionId'])) return false;
  for (const key of ['sourceTurnId', 'suggestionId']) {
    if (value[key] !== undefined && !id(value[key])) return false;
  }
  const result = value['result'];
  return record(result) && (result['type'] === 'failed'
    || result['type'] === 'completed' && (result['text'] === null || typeof result['text'] === 'string'));
}
