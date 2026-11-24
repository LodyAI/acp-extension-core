/**
 * MCP Apps (SEP-1865) hosting over ACP. The agent owns the MCP connection, so
 * the client renders the app while every resource read and tool call it makes
 * goes back through the agent, scoped to the originating tool call.
 */

export type LodyMcpAppDisplayMode = 'inline' | 'fullscreen';

/** Attached as `tool_call._meta.lody.mcpApp` when the called tool declares a UI resource. */
export type LodyMcpAppToolCallMeta = {
  version: 1;
  server: string;
  tool: string;
  /** `ui://` resource holding the `text/html;profile=mcp-app` document. */
  resourceUri: string;
  appName?: string;
  preferredDisplayMode?: LodyMcpAppDisplayMode;
};

/** Structural MCP `CallToolResult`; kept loose so providers forward it verbatim. */
export type LodyMcpCallToolResult = {
  content: unknown[];
  structuredContent?: Record<string, unknown>;
  isError?: boolean;
  _meta?: Record<string, unknown>;
};

/** Structural MCP `ReadResourceResult` content item. */
export type LodyMcpResourceContents = {
  uri: string;
  mimeType?: string;
  text?: string;
  blob?: string;
  _meta?: Record<string, unknown>;
};

export type LodyMcpAppLoadRequest = {
  sessionId: string;
  toolCallId: string;
};

export type LodyMcpAppLoadResponse = {
  app: LodyMcpAppToolCallMeta;
  toolInput: Record<string, unknown>;
  /** Null until the originating call completes. */
  toolResult: LodyMcpCallToolResult | null;
};

export type LodyMcpAppResourceReadRequest = {
  sessionId: string;
  toolCallId: string;
  uri: string;
};

export type LodyMcpAppResourceReadResponse = {
  contents: LodyMcpResourceContents[];
};

/**
 * A call initiated by the app. The agent MUST reject tools on other servers and
 * tools whose `_meta.ui.visibility` excludes `"app"`.
 */
export type LodyMcpAppToolCallRequest = {
  sessionId: string;
  toolCallId: string;
  name: string;
  arguments?: Record<string, unknown>;
};

export type LodyMcpAppToolCallResponse = LodyMcpCallToolResult;
