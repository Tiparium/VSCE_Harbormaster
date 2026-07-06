type McpContent = { type: 'text'; text: string };
type McpResponse = { content: McpContent[]; isError?: true };

/** Raw prose/markdown response — for content tools that return human-readable files. */
export function mcpText(text: string): McpResponse {
  return { content: [{ type: 'text', text }] };
}

/** Structured data response — serialises as pretty-printed JSON. */
export function mcpData(data: unknown): McpResponse {
  return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
}

/** Action success response. */
export function mcpOk(message: string): McpResponse {
  return { content: [{ type: 'text', text: JSON.stringify({ ok: true, message }) }] };
}

/** Error response. */
export function mcpError(message: string): McpResponse {
  return { content: [{ type: 'text', text: JSON.stringify({ ok: false, error: message }) }], isError: true };
}
