/**
 * Convert Anthropic Messages API `messages[]` to a single prompt string
 * suitable for Claude CLI's `--print` mode.
 *
 * For resumed sessions: returns only the latest user message.
 * For new sessions: reconstructs the full conversation context.
 */

export function buildPrompt(messages, { isResume = false } = {}) {
  if (!messages || messages.length === 0) {
    return "";
  }

  if (isResume) {
    // For resumed sessions, only send the latest user message
    const lastUser = findLastUserMessage(messages);
    return lastUser ? extractTextContent(lastUser.content) : "";
  }

  // For new sessions, build full context from all messages
  if (messages.length === 1) {
    return extractTextContent(messages[0].content);
  }

  const parts = [];
  for (const msg of messages) {
    const text = extractTextContent(msg.content);
    if (!text) continue;

    if (msg.role === "user") {
      parts.push(`User: ${text}`);
    } else if (msg.role === "assistant") {
      parts.push(`Assistant: ${text}`);
    }
  }
  return parts.join("\n\n");
}

/**
 * Extract the latest user message text for resume mode.
 */
export function getLatestUserText(messages) {
  const lastUser = findLastUserMessage(messages);
  return lastUser ? extractTextContent(lastUser.content) : "";
}

function findLastUserMessage(messages) {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === "user") return messages[i];
  }
  return null;
}

/**
 * Extract plain text from Anthropic message content.
 * Content can be a string or an array of content blocks.
 */
function extractTextContent(content) {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";

  const textParts = [];
  for (const block of content) {
    if (typeof block === "string") {
      textParts.push(block);
    } else if (block.type === "text") {
      textParts.push(block.text);
    }
    // Skip image/tool_use/tool_result blocks for prompt building
  }
  return textParts.join("\n");
}

export default { buildPrompt, getLatestUserText };
