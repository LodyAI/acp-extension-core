/**
 * Metadata for ACP form elicitation details that JSON Schema cannot express.
 * The same shape is used at request, property, and enum-option scope; consumers
 * read only the fields meaningful at that scope.
 */
export type LodyElicitationOption = {
  label: string;
  description?: string;
  preview?: string;
};

/** An optional additive note, stored under its own key in `answers`. */
export type LodyElicitationAnswerNote = {
  /** The schema property key. Must not equal any question id or another note key. */
  fieldId: string;
  title?: string;
  description?: string;
  /** Applies to the note independently of the question's answer. */
  isSecret?: boolean;
};

export type LodyElicitationQuestion = {
  id?: string;
  question: string;
  header: string;
  options: LodyElicitationOption[];
  multiSelect: boolean;
  allowCustomAnswer?: boolean;
  isSecret?: boolean;
  /** Does not enable a custom answer or replace the selected option(s). */
  note?: LodyElicitationAnswerNote;
};

export type LodyElicitationAnswer = string | string[];

export type LodyElicitationMeta = {
  version: 1;
  autoResolveAfterSeconds?: number | null;
  autoResolveAtEpochSeconds?: number;
  /** Property scope: an alternative answer replacing the referenced selection. */
  customAnswerFor?: string;
  /**
   * Property scope: an optional string note accompanying the referenced answer.
   * Mutually exclusive with customAnswerFor. References a question property in
   * the same schema; never another note or a custom-answer property.
   */
  noteFor?: string;
  secret?: boolean;
  preview?: string;
  questions?: LodyElicitationQuestion[];
  answers?: Record<string, LodyElicitationAnswer>;
};
