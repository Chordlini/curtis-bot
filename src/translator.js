import { v4 as uuidv4 } from "uuid";

const MODEL_ID = "claude-code";

/**
 * Translate Claude CLI NDJSON events into Anthropic Messages API SSE events.
 * Yields SSE-formatted strings ready to write to the response.
 *
 * Claude CLI stream-json emits conversation-level events:
 *   - {type: "system", ...}           - init
 *   - {type: "assistant", message: {content: [...]}}  - full assistant turn
 *   - {type: "user", message: {...}}   - tool results
 *   - {type: "result", result: "...", session_id: "...", cost_usd: ...}
 *
 * We synthesize Anthropic SSE events from these.
 */
export function* translateToSSE(event, state) {
  if (!event || typeof event !== "object") return;

  switch (event.type) {
    case "assistant": {
      const content = event.message?.content;
      if (!content || !Array.isArray(content)) break;

      // Emit message_start on first assistant event
      if (!state.messageStarted) {
        state.messageStarted = true;
        yield formatSSE("message_start", {
          type: "message_start",
          message: {
            id: state.messageId,
            type: "message",
            role: "assistant",
            content: [],
            model: state.model,
            stop_reason: null,
            stop_sequence: null,
            usage: { input_tokens: 0, output_tokens: 0 },
          },
        });
      }

      // Emit content blocks
      for (const block of content) {
        if (block.type === "text" && block.text) {
          const idx = state.blockIndex++;
          yield formatSSE("content_block_start", {
            type: "content_block_start",
            index: idx,
            content_block: { type: "text", text: "" },
          });
          yield formatSSE("content_block_delta", {
            type: "content_block_delta",
            index: idx,
            delta: { type: "text_delta", text: block.text },
          });
          yield formatSSE("content_block_stop", {
            type: "content_block_stop",
            index: idx,
          });
          state.outputText += block.text;
        } else if (block.type === "thinking" && block.thinking) {
          const idx = state.blockIndex++;
          yield formatSSE("content_block_start", {
            type: "content_block_start",
            index: idx,
            content_block: { type: "thinking", thinking: "" },
          });
          yield formatSSE("content_block_delta", {
            type: "content_block_delta",
            index: idx,
            delta: { type: "thinking_delta", thinking: block.thinking },
          });
          yield formatSSE("content_block_stop", {
            type: "content_block_stop",
            index: idx,
          });
        }
        // Skip tool_use blocks - they're internal to Claude CLI's agentic loop
      }
      break;
    }

    case "result": {
      // Emit message_start if we haven't yet (edge case: result with no assistant events)
      if (!state.messageStarted) {
        state.messageStarted = true;
        const resultText = typeof event.result === "string" ? event.result : "";
        yield formatSSE("message_start", {
          type: "message_start",
          message: {
            id: state.messageId,
            type: "message",
            role: "assistant",
            content: [],
            model: state.model,
            stop_reason: null,
            stop_sequence: null,
            usage: { input_tokens: 0, output_tokens: 0 },
          },
        });
        if (resultText && !state.outputText) {
          const idx = state.blockIndex++;
          yield formatSSE("content_block_start", {
            type: "content_block_start",
            index: idx,
            content_block: { type: "text", text: "" },
          });
          yield formatSSE("content_block_delta", {
            type: "content_block_delta",
            index: idx,
            delta: { type: "text_delta", text: resultText },
          });
          yield formatSSE("content_block_stop", {
            type: "content_block_stop",
            index: idx,
          });
          state.outputText = resultText;
        }
      }

      state.sessionId = event._sessionId || event.session_id || state.sessionId;
      state.costUsd = event.cost_usd;
      state.durationMs = event.duration_ms;

      // Emit message_delta with stop_reason and final message_stop
      yield formatSSE("message_delta", {
        type: "message_delta",
        delta: { stop_reason: "end_turn", stop_sequence: null },
        usage: { output_tokens: estimateTokens(state.outputText) },
      });
      yield formatSSE("message_stop", { type: "message_stop" });
      break;
    }

    case "system":
    case "user":
      // Internal events - extract session_id if present
      if (event._sessionId) {
        state.sessionId = event._sessionId;
      }
      break;

    default:
      // Pass through any Anthropic-native SSE events (content_block_start, etc.)
      // that the CLI might emit directly in some versions
      if (isAnthropicSSEType(event.type)) {
        yield formatSSE(event.type, event);
        if (!state.messageStarted && event.type === "message_start") {
          state.messageStarted = true;
        }
      }
      break;
  }
}

/**
 * Collect all events and build a complete Anthropic Message JSON response.
 */
export function buildCompleteResponse(events, model = MODEL_ID) {
  const messageId = `msg_${uuidv4().replace(/-/g, "").slice(0, 24)}`;
  const contentBlocks = [];
  let sessionId = null;
  let resultText = null;

  for (const event of events) {
    if (event._sessionId) sessionId = event._sessionId;

    if (event.type === "assistant" && event.message?.content) {
      for (const block of event.message.content) {
        if (block.type === "text" && block.text) {
          contentBlocks.push({ type: "text", text: block.text });
        }
      }
    } else if (event.type === "result") {
      sessionId = event._sessionId || event.session_id || sessionId;
      if (typeof event.result === "string") {
        resultText = event.result;
      }
    }
  }

  // If no text blocks were collected from assistant events, use the result text
  if (contentBlocks.length === 0 && resultText) {
    contentBlocks.push({ type: "text", text: resultText });
  }

  // Fallback
  if (contentBlocks.length === 0) {
    contentBlocks.push({ type: "text", text: "" });
  }

  const fullText = contentBlocks.map((b) => b.text).join("");

  return {
    response: {
      id: messageId,
      type: "message",
      role: "assistant",
      content: contentBlocks,
      model,
      stop_reason: "end_turn",
      stop_sequence: null,
      usage: {
        input_tokens: 0,
        output_tokens: estimateTokens(fullText),
      },
    },
    sessionId,
  };
}

/**
 * Create initial streaming state.
 */
export function createStreamState(model = MODEL_ID) {
  return {
    messageId: `msg_${uuidv4().replace(/-/g, "").slice(0, 24)}`,
    model,
    messageStarted: false,
    blockIndex: 0,
    outputText: "",
    sessionId: null,
    costUsd: null,
    durationMs: null,
  };
}

function formatSSE(eventType, data) {
  return `event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`;
}

function isAnthropicSSEType(type) {
  return [
    "message_start",
    "content_block_start",
    "content_block_delta",
    "content_block_stop",
    "message_delta",
    "message_stop",
    "ping",
  ].includes(type);
}

function estimateTokens(text) {
  if (!text) return 0;
  // Rough estimate: ~4 chars per token
  return Math.ceil(text.length / 4);
}

export default { translateToSSE, buildCompleteResponse, createStreamState };
