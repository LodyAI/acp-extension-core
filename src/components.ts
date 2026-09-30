/** Declarative, inert GUI content carried by standard ACP form elicitation. */
export type LodyComponentNode =
  | { type: 'text'; text: string }
  | { type: 'button'; id: string; label: string; input: string }
  | { type: 'input'; id: string; label: string };

export type LodyComponentDocument = {
  version: 1;
  id: string;
  revision: number;
  title: string;
  /** A component-local palette; never changes the client's application theme. */
  theme?: { name: string; foreground: string; background: string; accent: string };
  nodes: LodyComponentNode[];
  /** Focus-scoped native key bindings. These never install global shortcuts. */
  keybindings?: Array<{ key: string; label: string; input: string }>;
};

/** Serialized into the form's required `event` string property. */
export type LodyComponentEvent = {
  version: 1;
  componentId: string;
  revision: number;
  input: string;
};
