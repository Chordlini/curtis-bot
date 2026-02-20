# Architecture

How Curtis Bot works under the hood.

## System Overview

Curtis Bot is not a single application — it's a pattern for wiring together existing tools into a personal AI operating system.

```
┌─────────────────────────────────────────────────────────────────┐
│                        YOUR MACHINE                             │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                   OpenClaw Gateway                        │  │
│  │                   (Port 19000)                            │  │
│  │                                                           │  │
│  │  ┌─────────┐  ┌──────────┐  ┌───────┐  ┌─────────────┐  │  │
│  │  │ Channels│  │  Skills  │  │ Cron  │  │ Agent Router│  │  │
│  │  │         │  │          │  │       │  │             │  │  │
│  │  │Telegram │  │ GitHub   │  │ PMBot │  │ Claude Code │  │  │
│  │  │Discord  │  │ 1Pass    │  │ Health│  │ Kimi        │  │  │
│  │  │SMS      │  │ LocalSend│  │ Custom│  │ Codex       │  │  │
│  │  └─────────┘  └──────────┘  └───────┘  └─────────────┘  │  │
│  └───────────────────────────────────────────────────────────┘  │
│                              │                                   │
│                              ▼                                   │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                    Your Filesystem                        │  │
│  │                                                           │  │
│  │  ~/server/sites/     → Deployed websites                  │  │
│  │  ~/projects/         → Code repositories                  │  │
│  │  ~/.openclaw/        → Config, skills, logs               │  │
│  │  ~/Downloads/        → Incoming files                     │  │
│  └───────────────────────────────────────────────────────────┘  │
│                              │                                   │
│                              ▼                                   │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                    External Services                      │  │
│  │                                                           │  │
│  │  Caddy (web server) → Cloudflare Tunnel → yourdomain.com │  │
│  │  Docker containers  → Isolated services                   │  │
│  │  systemd services   → Background processes                │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

## Component Breakdown

### 1. OpenClaw Gateway

The central hub. Handles:
- **Message routing**: Phone → agent, agent → phone
- **Skill dispatch**: Matches user intent to available skills
- **Cron scheduling**: Runs jobs on intervals
- **Session management**: Maintains conversation context across messages
- **Budget tracking**: Monitors API token spending

### 2. Channels (Input/Output)

How messages get in and out:

| Channel | Direction | Protocol |
|---------|-----------|----------|
| Telegram | Bidirectional | Bot API (polling) |
| Discord | Bidirectional | Bot gateway (websocket) |
| SMS | Bidirectional | Twilio / carrier bridge |
| LocalSend | Receive files | mDNS + HTTP |

### 3. Agent Router

Decides which AI handles each request:

```
Incoming message
    │
    ├── Is it a skill trigger? → Execute skill directly
    │
    ├── Is it a coding task? → Spawn Claude Code
    │
    ├── Is it a research query? → Route to gateway model
    │
    └── Is it a multi-task? → Spawn parallel agents
```

### 4. Skills System

Modular plugins that extend functionality:

```
~/.openclaw/skills/
├── localsend/          → File transfer skill
│   ├── skill.json      → Metadata and triggers
│   ├── prompt.md       → Instructions for the agent
│   └── scripts/        → Helper scripts
├── github/
├── discord/
└── ...
```

Skills are triggered by:
- Direct invocation (`/localsend receive`)
- Pattern matching (agent detects intent)
- Cron jobs (scheduled execution)

### 5. Cron Engine

Periodic task execution:

```json
{
  "name": "PMBot Health Check",
  "interval": 7200000,
  "prompt": "Check pmbot operator brief, report issues",
  "enabled": true
}
```

Cron jobs can:
- Run agent prompts on schedule
- Execute shell commands
- Trigger skills
- Send results to channels

## Data Flow Example

### "Deploy my portfolio" (end to end)

```
1. User texts "Deploy" via Telegram
                │
2. Telegram Bot API → OpenClaw Gateway
                │
3. Gateway loads conversation context (prior messages about portfolio)
                │
4. Gateway routes to Claude Code agent
                │
5. Claude Code:
   ├── Reads ~/incoming/rami-portfolio.zip
   ├── Extracts to temp directory
   ├── Runs `bun install && bun run build`
   ├── Copies dist/ to ~/server/sites/main/
   ├── Verifies with curl https://iaiaia.dev
   └── Returns "Deployed successfully"
                │
6. Gateway sends result back via Telegram
                │
7. User sees "Deployed successfully" on phone
```

## Security Model

### What agents CAN do:
- Read/write files in your home directory
- Run terminal commands
- Access network (curl, git, npm)
- Use configured API keys

### What agents CANNOT do:
- Access files outside home directory (sandboxed)
- Run destructive commands without confirmation
- Push to git without explicit approval
- Access credentials not in their environment

### Safety layers:
1. **OpenClaw approvals**: Dangerous commands require user confirmation
2. **Claude Code safety**: Won't force-push, delete branches, or run destructive ops without asking
3. **Budget limits**: Token spending caps prevent runaway costs
4. **Dry-run modes**: Services like trading bots run in simulation by default

## Networking

### External Access via Cloudflare Tunnel

```
Internet → Cloudflare Edge → cloudflared tunnel → localhost:80 (Caddy)
                                                 → localhost:8787 (pmbot)
                                                 → localhost:8899 (TTS app)
```

No ports exposed directly. All traffic routes through Cloudflare's network.

### Local Network (LocalSend)

```
Phone (LocalSend app) ←→ mDNS discovery ←→ localsend-cli (your machine)
```

Files transfer directly over WiFi, no cloud involved.

## Scaling

### Adding More Agents

Drop in new CLI tools as they become available:
1. Install the CLI
2. Add API key to `~/.openclaw/.env`
3. Update the coding-agent skill to support the new engine
4. Use it: "Have [new-agent] work on this"

### Adding More Skills

```bash
# Search for community skills
npx clawhub search "skill-name"

# Install
npx clawhub install skill-name

# Or create your own
openclaw skill create my-skill
```

### Adding More Channels

```bash
openclaw channels add [channel-type]
```

Each channel runs independently — you can message from Telegram while Discord runs cron reports.
