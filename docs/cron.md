# Cron Jobs

Setting up automated monitoring and tasks.

## Overview

Curtis Bot uses OpenClaw's cron engine to run scheduled tasks. These can be anything from health checks to automated deployments.

## Managing Cron Jobs

### List Active Jobs
```bash
openclaw cron list
```

### Add a Job
```bash
openclaw cron add \
  --name "Job Name" \
  --interval 7200000 \
  --prompt "What the agent should do each run"
```

### Remove a Job
```bash
openclaw cron remove --id <job-id>
```

### Pause/Resume
```bash
openclaw cron pause --id <job-id>
openclaw cron resume --id <job-id>
```

## Common Intervals

| Interval | Milliseconds | Use Case |
|----------|-------------|----------|
| 5 min | 300000 | Critical monitoring |
| 15 min | 900000 | Active checks |
| 1 hour | 3600000 | Regular updates |
| 2 hours | 7200000 | Standard monitoring |
| 6 hours | 21600000 | Periodic summaries |
| 24 hours | 86400000 | Daily reports |

## Example: Trading Bot Monitor

```bash
openclaw cron add \
  --name "PMBot 2h Check" \
  --interval 7200000 \
  --prompt "Check the pmbot operator brief for the last 2 hours. Report: trades per lane, PnL, win rates, any issues. If total PnL < -$8, auto-correct parameters."
```

## Example: Daily Code Quality

```bash
openclaw cron add \
  --name "Daily Lint" \
  --interval 86400000 \
  --prompt "Run eslint on ~/projects/my-app/src. If errors found, fix them and commit with message 'fix: auto-lint'"
```

## Example: Uptime Monitor

```bash
openclaw cron add \
  --name "Site Uptime" \
  --interval 900000 \
  --prompt "curl -s -o /dev/null -w '%{http_code}' https://iaiaia.dev — if not 200, alert me immediately"
```

## Cron Job Output

Results are delivered through your configured channels (Telegram, Discord, etc.). Each run includes:
- Job name
- Execution time
- Result summary
- Any errors or alerts

## Tips

1. **Keep prompts specific** — vague prompts waste tokens
2. **Set reasonable intervals** — not everything needs to run every 5 minutes
3. **Include thresholds** — "alert only if PnL < -$8" avoids noise
4. **Use auto-correction** — let the agent fix simple issues automatically
5. **Budget awareness** — each cron run costs tokens, factor into your budget
