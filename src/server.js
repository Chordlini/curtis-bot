import Fastify from "fastify";
import { createHash } from "crypto";
import config from "./config.js";
import { runClaude } from "./claude-runner.js";
import { buildPrompt, getLatestUserText } from "./prompt-builder.js";
import { translateToSSE, buildCompleteResponse, createStreamState } from "./translator.js";
import { getSession, setSession, removeSession } from "./session-store.js";

const fastify = Fastify({ logger: true });

// Per-conversation request queue to prevent concurrent CLI spawns
const activeRequests = new Map(); // conversationKey -> Promise

/**
 * Derive a conversation key from the request.
 * Uses x-conversation-id header if present, otherwise hashes system + first user message.
 */
function getConversationKey(request) {
  const header =
    request.headers["x-conversation-id"] ||
    request.headers["x-openclaw-conversation-id"] ||
    request.headers["x-session-id"];
  if (header) return `hdr:${header}`;

  const body = request.body;
  const system = typeof body.system === "string" ? body.system : "";
  const firstUser = body.messages?.[0]
    ? JSON.stringify(body.messages[0].content).slice(0, 500)
    : "";
  const hash = createHash("sha256")
    .update(system + firstUser)
    .digest("hex")
    .slice(0, 16);
  return `hash:${hash}`;
}

/**
 * Queue a request for a conversation to prevent concurrent CLI spawns.
 */
async function enqueue(conversationKey, fn) {
  const prev = activeRequests.get(conversationKey) || Promise.resolve();
  const current = prev.then(fn, fn); // Run fn after previous completes (even if it failed)
  activeRequests.set(conversationKey, current);
  try {
    return await current;
  } finally {
    // Clean up if this was the last request in the queue
    if (activeRequests.get(conversationKey) === current) {
      activeRequests.delete(conversationKey);
    }
  }
}

// POST /v1/messages - Anthropic Messages API endpoint
fastify.post("/v1/messages", async (request, reply) => {
  const body = request.body;

  if (!body || !body.messages || !Array.isArray(body.messages) || body.messages.length === 0) {
    return reply.code(400).send({
      type: "error",
      error: { type: "invalid_request_error", message: "messages array is required" },
    });
  }

  const model = body.model || "claude-code";
  const stream = body.stream === true;
  const maxTokens = body.max_tokens || null;
  const systemPrompt = typeof body.system === "string" ? body.system : null;
  const conversationKey = getConversationKey(request);

  return enqueue(conversationKey, async () => {
    // Look up existing session for this conversation
    let sessionId = getSession(conversationKey);
    const isResume = !!sessionId;

    // Build prompt from messages
    const prompt = isResume
      ? getLatestUserText(body.messages)
      : buildPrompt(body.messages);

    if (!prompt) {
      return reply.code(400).send({
        type: "error",
        error: { type: "invalid_request_error", message: "Could not extract prompt from messages" },
      });
    }

    console.log(
      `[server] ${stream ? "streaming" : "non-streaming"} request, ` +
      `conversation=${conversationKey}, resume=${isResume}, prompt=${prompt.slice(0, 80)}...`
    );

    try {
      if (stream) {
        return await handleStreaming(reply, prompt, { sessionId, systemPrompt, maxTokens, model, conversationKey, isResume });
      } else {
        return await handleNonStreaming(reply, prompt, { sessionId, systemPrompt, maxTokens, model, conversationKey, isResume });
      }
    } catch (err) {
      console.error(`[server] request failed:`, err.message);

      // If resume failed, retry without session
      if (isResume && err.message.includes("exited with code")) {
        console.log(`[server] resume failed, retrying without session`);
        removeSession(conversationKey);
        const fullPrompt = buildPrompt(body.messages);
        try {
          if (stream) {
            return await handleStreaming(reply, fullPrompt, { sessionId: null, systemPrompt, maxTokens, model, conversationKey, isResume: false });
          } else {
            return await handleNonStreaming(reply, fullPrompt, { sessionId: null, systemPrompt, maxTokens, model, conversationKey, isResume: false });
          }
        } catch (retryErr) {
          console.error(`[server] retry also failed:`, retryErr.message);
        }
      }

      // If headers already sent (streaming started), end the stream with error event
      if (reply.raw.headersSent) {
        const errEvent = `event: error\ndata: ${JSON.stringify({ type: "error", error: { type: "api_error", message: err.message } })}\n\n`;
        reply.raw.write(errEvent);
        reply.raw.end();
        return reply;
      }

      return reply.code(500).send({
        type: "error",
        error: { type: "api_error", message: err.message },
      });
    }
  });
});

async function handleStreaming(reply, prompt, opts) {
  const { sessionId, systemPrompt, maxTokens, model, conversationKey } = opts;

  let headersWritten = false;
  function ensureHeaders() {
    if (!headersWritten) {
      headersWritten = true;
      reply.raw.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      });
    }
  }

  const state = createStreamState(model);
  let lastSessionId = null;

  for await (const event of runClaude(prompt, { sessionId, systemPrompt })) {
    for (const sse of translateToSSE(event, state)) {
      ensureHeaders();
      reply.raw.write(sse);
    }
    if (state.sessionId) lastSessionId = state.sessionId;
  }

  // Ensure we emitted at least message_start and message_stop
  if (!state.messageStarted) {
    ensureHeaders();
    for (const sse of translateToSSE({ type: "result", result: "" }, state)) {
      reply.raw.write(sse);
    }
  }

  if (headersWritten) {
    reply.raw.end();
  }

  // Save session for future conversation continuity
  if (lastSessionId) {
    setSession(conversationKey, lastSessionId);
    console.log(`[server] saved session ${lastSessionId} for ${conversationKey}`);
  }

  return reply;
}

async function handleNonStreaming(reply, prompt, opts) {
  const { sessionId, systemPrompt, maxTokens, model, conversationKey } = opts;

  const events = [];
  for await (const event of runClaude(prompt, { sessionId, systemPrompt, maxTokens })) {
    events.push(event);
  }

  const { response, sessionId: resultSessionId } = buildCompleteResponse(events, model);

  // Save session
  if (resultSessionId) {
    setSession(conversationKey, resultSessionId);
    console.log(`[server] saved session ${resultSessionId} for ${conversationKey}`);
  }

  return reply.code(200).send(response);
}

// GET /health
fastify.get("/health", async () => {
  return { status: "ok", bridge: "claude-code-cli", port: config.port };
});

// GET /v1/models - list available models
fastify.get("/v1/models", async () => {
  return {
    data: [
      {
        id: "claude-code",
        name: "Claude Code (Local CLI)",
        context_window: 200000,
        max_tokens: 16384,
      },
    ],
  };
});

// Start server
const start = async () => {
  try {
    await fastify.listen({ port: config.port, host: config.host });
    console.log(`[claude-bridge] listening on http://${config.host}:${config.port}`);
    console.log(`[claude-bridge] Claude CLI: ${config.claude.path}`);
    console.log(`[claude-bridge] POST /v1/messages (Anthropic Messages API)`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
