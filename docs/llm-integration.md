# LLM Integration

How Curtis Bot connects to and orchestrates AI coding agents.

## Supported LLMs

| CLI Tool | Model | Best For | Install |
|----------|-------|----------|---------|
| Claude Code | Opus 4.6 (1M context) | Complex coding, refactoring, multi-file edits | `npm i -g @anthropic-ai/claude-code` |
| Kimi | Kimi 1.12 | Alternative coding, research, parallel tasks | `pip install kimi-cli` |
| Codex CLI | GPT-5.3-Codex | OpenAI ecosystem, security analysis | `npm i -g @openai/codex` |

## How It Works

### The Routing Flow

```
User Message
    │
    ▼
OpenClaw Gateway
    │
    ├──▶ Simple question? → Gateway's built-in model answers directly
    │
    ├──▶ Coding task? → Spawns Claude Code / Kimi as background process
    │
    └──▶ Multi-step task? → Spawns multiple agents in parallel
```

### Single Agent Mode

For most tasks, the gateway routes to Claude Code:

```
You: "Fix the bug in server.py line 42"
     │
     ▼
Gateway spawns Claude Code
     │
     ├── Reads server.py
     ├── Identifies the bug
     ├── Edits the file
     ├── Runs tests
     │
     ▼
Gateway relays: "Fixed the null check on line 42, tests passing"
```

### Multi-Agent Mode

For complex tasks, spawn agents in parallel:

```
You: "Refactor the API and write tests for it"
     │
     ▼
Gateway spawns:
├── Claude Code → Refactors API (agent 1)
└── Kimi → Writes integration tests (agent 2)
     │
     ▼ (both complete)
Gateway relays combined results
```

## Using Claude Code

### Direct CLI Usage

```bash
# One-shot prompt
claude --print "Explain what this function does" < myfile.py

# Interactive session
claude

# With specific model
claude --model opus-4-6
```

### Through OpenClaw (Coding Agent Skill)

The `coding-agent` skill wraps Claude Code for background execution:

```bash
# Spawn a coding agent on a task
openclaw skill coding-agent --prompt "Build a REST API with Express" --dir ~/projects/my-api
```

### Key Capabilities

- **File operations**: Read, write, edit any file on your system
- **Terminal commands**: Run builds, tests, git operations, npm/pip installs
- **Multi-file edits**: Refactor across entire codebases
- **Git workflows**: Create branches, commit, push, open PRs
- **1M context window**: Can hold entire codebases in memory

## Using Kimi

### Direct CLI Usage

```bash
# One-shot
kimi "What does this code do?" --file myfile.py

# Interactive
kimi
```

### Through OpenClaw

Same `coding-agent` skill, different engine:

```bash
openclaw skill coding-agent --engine kimi --prompt "Write unit tests" --dir ~/projects/my-api
```

### When to Use Kimi vs Claude

| Scenario | Best Choice |
|----------|-------------|
| Complex refactoring | Claude Code |
| Writing tests | Either |
| Quick research | Kimi |
| Multi-file changes | Claude Code |
| Parallel worker | Kimi (while Claude does main task) |

## Configuration

### API Keys

Store in `~/.openclaw/.env`:
```bash
ANTHROPIC_API_KEY=sk-ant-...      # For Claude Code
KIMI_API_KEY=...                   # For Kimi
OPENAI_API_KEY=sk-...              # For Codex (optional)
```

### Model Selection

Set default model in OpenClaw config:
```bash
openclaw config set agent.default_model "opus-4-6"
```

### Context Window

Claude Code supports up to 1M tokens of context. For large codebases:
- It automatically compresses older messages
- Prioritizes recent file reads and edits
- Can hold ~50-100 files in active context

## Cost Management

### Token Usage

| Model | Input (per 1M tokens) | Output (per 1M tokens) |
|-------|----------------------|------------------------|
| Opus 4.6 | $15 | $75 |
| Sonnet 4.6 | $3 | $15 |
| Haiku 4.5 | $0.80 | $4 |

### Tips to Reduce Costs

1. **Use Haiku for simple tasks** — routing, simple questions, status checks
2. **Use Opus for coding** — complex tasks that need accuracy
3. **Batch related requests** — one big prompt beats five small ones
4. **Let agents work autonomously** — fewer round-trips = fewer tokens

### Monitoring Usage

```bash
# Check current session cost
openclaw config get budget

# Set spending limits
openclaw config set budget.max_usd 5.00
```

## Advanced: Custom Agent Workflows

### Chained Agents

Run agents sequentially where output of one feeds the next:

```
Agent 1 (Claude): Write the API endpoints
    │ output
    ▼
Agent 2 (Kimi): Write tests for those endpoints
    │ output
    ▼
Agent 3 (Claude): Fix any failing tests
```

### Watchdog Agents

Set up cron-based agents that monitor and fix issues:

```bash
openclaw cron add \
  --name "Code Quality Watch" \
  --interval 86400000 \
  --prompt "Run linter on ~/projects/my-app, fix any issues, commit fixes"
```

### Agent-to-Agent Communication

Agents can read each other's output files:
```
Agent 1 writes → /tmp/agent1-output.json
Agent 2 reads → /tmp/agent1-output.json → continues work
```

## Troubleshooting

### Claude Code hangs
```bash
# Check if process is running
ps aux | grep claude

# Kill and restart
pkill -f claude
claude --version  # Verify still works
```

### Token limit exceeded
- Break the task into smaller pieces
- Use `--model sonnet-4-6` for lighter tasks
- Clear conversation context and start fresh

### Agent not finding files
- Ensure the working directory is set correctly
- Use absolute paths when possible
- Check file permissions
