# Setup Guide

Complete guide to setting up Curtis Bot — your personal AI agent gateway.

## Prerequisites

- A Linux machine (Arch, Ubuntu, Debian, etc.)
- sudo access
- A phone with Telegram (or another supported messaging app)

## Step 1: Install Core Dependencies

### Node.js (via mise)
```bash
curl https://mise.run | sh
mise install node@latest
mise use -g node@latest
```

### Bun (fast JS runtime)
```bash
curl -fsSL https://bun.sh/install | bash
```

### Python 3.12+
```bash
# Arch
sudo pacman -S python

# Ubuntu/Debian
sudo apt install python3 python3-pip
```

### Git
```bash
# Arch
sudo pacman -S git

# Ubuntu/Debian
sudo apt install git
```

## Step 2: Install OpenClaw

```bash
curl -fsSL https://get.openclaw.com | bash
```

Run the setup wizard:
```bash
openclaw configure
```

This will walk you through:
- API keys (Anthropic, OpenAI, etc.)
- Gateway port configuration
- Default agent model selection

## Step 3: Install Claude Code

```bash
npm install -g @anthropic-ai/claude-code
```

Verify:
```bash
claude --version
```

Set your Anthropic API key:
```bash
export ANTHROPIC_API_KEY="your-key-here"
# Add to ~/.bashrc or ~/.zshrc for persistence
```

## Step 4: Install Kimi (Optional)

```bash
pip install kimi-cli
```

Verify:
```bash
kimi --version
```

## Step 5: Connect a Messaging Channel

### Telegram (Recommended)
```bash
openclaw channels add telegram
```

Follow the prompts to:
1. Create a Telegram bot via @BotFather
2. Enter the bot token
3. Set your phone number for authentication

### Other Channels
```bash
openclaw channels add discord
openclaw channels add sms
```

## Step 6: Install GitHub CLI

```bash
# Arch
sudo pacman -S github-cli

# Ubuntu/Debian
sudo apt install gh

# Authenticate
gh auth login --web -p https
```

## Step 7: Install LocalSend CLI (Optional)

For file transfers between devices:
```bash
pip install localsend-cli
```

## Step 8: Install 1Password CLI (Optional)

For secrets management:
```bash
# Arch
yay -S 1password-cli

# Ubuntu/Debian — see https://developer.1password.com/docs/cli/get-started
```

## Step 9: Start the Gateway

```bash
openclaw gateway start
```

The gateway runs on port 19000 by default. It handles:
- Incoming messages from your phone
- Routing to Claude Code / Kimi
- Cron job scheduling
- Skill execution

## Step 10: Configure Skills

List available skills:
```bash
openclaw skills list
```

Install additional skills:
```bash
npx clawhub search twitter
npx clawhub install twitter-openclaw
```

## Step 11: Set Up Cron Jobs (Optional)

Example: Monitor a service every 2 hours:
```bash
openclaw cron add \
  --name "Service Health Check" \
  --interval 7200000 \
  --prompt "Check the service status and report any issues"
```

List active cron jobs:
```bash
openclaw cron list
```

## Step 12: Set Up Web Server (Optional)

If you want to serve websites from your machine:

### Install Caddy
```bash
# Arch
sudo pacman -S caddy

# Ubuntu/Debian
sudo apt install caddy
```

### Configure Caddy
```
# /etc/caddy/Caddyfile
:80 {
    root * /home/youruser/server/sites/main
    file_server
}
```

### Install Cloudflare Tunnel
For HTTPS with a custom domain:
```bash
# Install cloudflared
# Arch
yay -S cloudflared

# Configure tunnel
cloudflared tunnel create my-tunnel
cloudflared tunnel route dns my-tunnel yourdomain.com
```

## Verify Everything Works

Send a message from your phone:
```
"Hello, can you see my files?"
```

If Curtis responds with information about your filesystem, you're all set.

## Troubleshooting

### Gateway won't start
```bash
openclaw gateway status
openclaw gateway restart
```

### Claude Code not responding
```bash
claude --version
echo $ANTHROPIC_API_KEY  # Should not be empty
```

### Messages not arriving
```bash
openclaw channels list
openclaw channels test telegram
```

### Skills not loading
```bash
openclaw skills list  # Check status column
npx clawhub sync     # Re-sync skills
```

## Directory Structure

```
~/.openclaw/
├── .env                 # API keys and secrets
├── config.json          # Gateway configuration
├── workspace/           # Agent working directory
│   ├── _incoming/       # LocalSend received files
│   └── projects/        # Cloned repos and projects
├── skills/              # Installed skills
├── cron/                # Cron job definitions
└── logs/                # Session logs
```

## Next Steps

- Read [LLM Integration](docs/llm-integration.md) to learn how to use multiple AI agents
- Read [Architecture](docs/architecture.md) to understand the system design
- Check [Skills Reference](docs/skills.md) for all available skills
