import { config as loadEnv } from "dotenv";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
loadEnv({ path: join(__dirname, "..", ".env") });

export const config = {
  port: Number(process.env.PORT) || 8787,
  host: process.env.HOST || "127.0.0.1",

  claude: {
    // Support both direct binary (CLAUDE_PATH) and node+script (CLAUDE_ENTRY + CLAUDE_SCRIPT)
    entry: process.env.CLAUDE_ENTRY || null, // e.g. "node"
    script: process.env.CLAUDE_SCRIPT || null, // e.g. "/path/to/cli.js"
    path: process.env.CLAUDE_PATH || "claude",
    timeoutMs: Number(process.env.CLAUDE_TIMEOUT_MS) || 300_000,
    maxBudgetUsd: Number(process.env.CLAUDE_MAX_BUDGET_USD) || 5,
    allowedTools: (process.env.CLAUDE_ALLOWED_TOOLS || "Read,Glob,Grep,WebSearch,WebFetch")
      .split(",")
      .map((t) => t.trim()),
    dangerouslySkipPermissions:
      process.env.CLAUDE_DANGEROUSLY_SKIP_PERMISSIONS === "true",
    allowedDirectories: process.env.CLAUDE_ALLOWED_DIRECTORIES
      ? process.env.CLAUDE_ALLOWED_DIRECTORIES.split(",").map((d) => d.trim())
      : null,
    extraPath: process.env.CLAUDE_EXTRA_PATH || "",
  },

  sessions: {
    filePath: join(__dirname, "..", "data", "sessions.json"),
    maxAge: Number(process.env.SESSION_MAX_AGE_MS) || 24 * 60 * 60 * 1000, // 24h
  },
};

export default config;
