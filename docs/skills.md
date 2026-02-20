# Skills Reference

Available skills and how to use them.

## Ready Skills (12/52)

### 1Password (`/1password`)
Set up and use 1Password CLI for secrets management.
```
"Store my API key in 1Password"
"Get the Cloudflare token from 1Password"
```

### Coding Agent (`/coding-agent`)
Delegate coding tasks to Claude Code, Kimi, or Codex.
```
"Have Claude build a REST API"
"Spawn Kimi to write tests for the auth module"
```

### Discord (`/discord`)
Send messages and manage Discord channels.
```
"Send a message to #general on Discord"
"Check Discord notifications"
```

### GitHub (`/github`)
Full GitHub operations via `gh` CLI.
```
"Create a new repo called my-project"
"Open a PR for the current branch"
"Check CI status on the latest PR"
```

### GH Issues (`/gh-issues`)
Fetch and manage GitHub issues, spawn agents to fix them.
```
"/gh-issues Chordlini/my-repo --label bug --limit 5"
```

### Healthcheck (`/healthcheck`)
Security auditing and system health checks.
```
"Run a security audit on this machine"
"Check for open ports"
```

### Session Logs (`/session-logs`)
Search and analyze your conversation history.
```
"Search my logs for the deployment we did yesterday"
"Find the API key discussion from last week"
```

### Skill Creator (`/skill-creator`)
Create new custom skills.
```
"Create a skill for managing my Spotify"
"Build a Twitter posting skill"
```

### Video Frames (`/video-frames`)
Extract frames or clips from videos using ffmpeg.
```
"Extract a frame at 1:30 from video.mp4"
"Create a 5-second clip from 0:45"
```

### Weather (`/weather`)
Get current weather and forecasts.
```
"What's the weather in LA?"
"Will it rain tomorrow?"
```

### Blender MCP (`/blender-mcp-control`)
Control Blender via MCP server for 3D operations.
```
"Create a 3D cube in Blender"
"Export the scene as GLB"
```

### LocalSend (`/localsend`)
Send/receive files between devices on local network.
```
"Start receiving files via LocalSend"
"Send build.zip to my phone"
```

## Installing More Skills

```bash
# Search available skills
npx clawhub search "skill-name"

# Install a skill
npx clawhub install skill-name

# Sync all skills to latest
npx clawhub sync

# List all installed
openclaw skills list
```

## Creating Custom Skills

```bash
# Scaffold a new skill
openclaw skill create my-skill
```

This creates:
```
~/.openclaw/skills/my-skill/
├── skill.json    # Metadata, triggers, dependencies
├── prompt.md     # Agent instructions
└── scripts/      # Helper scripts
```

### skill.json Example
```json
{
  "name": "my-skill",
  "description": "Does something cool",
  "triggers": ["my-skill", "do-the-thing"],
  "dependencies": ["curl", "jq"]
}
```

### prompt.md Example
```markdown
# My Skill

When the user asks to "do the thing", run:
1. Fetch data from the API
2. Process it with jq
3. Return the result
```
