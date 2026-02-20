import { spawn } from "child_process";
import config from "./config.js";

const DONE = Symbol("done");

function extractSessionId(event) {
  if (!event || typeof event !== "object") return null;
  for (const candidate of [
    event.session_id,
    event.sessionId,
    event.session?.id,
    event.result?.session_id,
  ]) {
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim();
    }
  }
  return null;
}

/**
 * Spawn Claude CLI and yield NDJSON events as an async generator.
 * Pipes the prompt via stdin to avoid E2BIG on large prompts/system prompts.
 */
export async function* runClaude(prompt, options = {}) {
  const { sessionId = null, systemPrompt = null, signal = null } = options;

  const cliArgs = [
    "--print",
    "--verbose",
    "--output-format", "stream-json",
    "--max-budget-usd", String(config.claude.maxBudgetUsd),
  ];

  const useNodeEntry = config.claude.entry && config.claude.script;
  const spawnCmd = useNodeEntry ? config.claude.entry : config.claude.path;
  const args = useNodeEntry ? [config.claude.script, ...cliArgs] : [...cliArgs];

  for (const tool of config.claude.allowedTools) {
    args.push("--allowed-tools", tool);
  }

  if (config.claude.dangerouslySkipPermissions) {
    args.push("--dangerously-skip-permissions");
  }

  if (config.claude.allowedDirectories) {
    for (const dir of config.claude.allowedDirectories) {
      args.push("--add-dir", dir);
    }
  }

  if (sessionId) {
    args.push("--resume", sessionId);
  }

  // No positional prompt arg — we pipe everything via stdin.
  // Build the stdin content: prepend system prompt if provided.
  let stdinContent = prompt;
  if (systemPrompt) {
    stdinContent = `<system>\n${systemPrompt}\n</system>\n\n${prompt}`;
  }

  console.log(`[claude-runner] spawning: ${spawnCmd} ${useNodeEntry ? "(node)" : "(bin)"}, ${sessionId ? "resume " + sessionId : "new session"}, stdin=${stdinContent.length} chars`);

  const env = { ...process.env };
  delete env.CLAUDECODE;
  delete env.CLAUDE_CODE;
  delete env.CLAUDE_CODE_ENTRYPOINT;
  if (config.claude.extraPath) {
    env.PATH = `${config.claude.extraPath}:${env.PATH || ""}`;
  }

  const proc = spawn(spawnCmd, args, {
    env,
    stdio: ["pipe", "pipe", "pipe"],
  });

  // Pipe prompt via stdin
  proc.stdin.write(stdinContent);
  proc.stdin.end();

  if (signal) {
    signal.addEventListener("abort", () => proc.kill("SIGTERM"), { once: true });
  }

  const timeout = setTimeout(() => {
    console.log(`[claude-runner] timeout after ${config.claude.timeoutMs / 1000}s`);
    proc.kill("SIGTERM");
  }, config.claude.timeoutMs);

  const queue = [];
  let waiting = null;

  function push(item) {
    if (waiting) {
      const r = waiting;
      waiting = null;
      r(item);
    } else {
      queue.push(item);
    }
  }

  function pull() {
    if (queue.length > 0) return Promise.resolve(queue.shift());
    return new Promise((r) => { waiting = r; });
  }

  const stderrChunks = [];
  proc.stderr.on("data", (chunk) => {
    const text = chunk.toString();
    stderrChunks.push(text);
    if (text.trim()) {
      console.log(`[claude-runner stderr] ${text.trim().slice(0, 200)}`);
    }
  });

  let buffer = "";
  proc.stdout.on("data", (chunk) => {
    buffer += chunk.toString();
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const event = JSON.parse(line);
        const sid = extractSessionId(event);
        if (sid) event._sessionId = sid;
        push(event);
      } catch {
        // Non-JSON line, skip
      }
    }
  });

  proc.on("close", (code, sig) => {
    clearTimeout(timeout);
    console.log(`[claude-runner] process closed: code=${code}, signal=${sig}`);

    if (buffer.trim()) {
      try {
        const event = JSON.parse(buffer);
        const sid = extractSessionId(event);
        if (sid) event._sessionId = sid;
        push(event);
      } catch {}
    }

    if (sig) {
      const stderr = stderrChunks.join("").slice(0, 500);
      push(new Error(`Claude killed by signal ${sig}: ${stderr}`));
    } else if (code !== 0 && code !== null) {
      const stderr = stderrChunks.join("").slice(0, 500);
      push(new Error(`Claude exited with code ${code}: ${stderr}`));
    } else {
      push(DONE);
    }
  });

  proc.on("error", (err) => {
    clearTimeout(timeout);
    push(err);
  });

  while (true) {
    const item = await pull();
    if (item === DONE) return;
    if (item instanceof Error) throw item;
    yield item;
  }
}

export default { runClaude };
