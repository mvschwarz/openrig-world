# agent-browser: Local Dev Insights

> Companion notes for browser tasks. Command details below reflect v0.13.0-era
> usage and may differ in the installed release. Check current help and verify
> the target operation; this file is not a current browser or login test receipt.

---

## Command Compatibility Matrix

**Not all `get` subcommands accept @refs.** This is the #1 source of confusion.

| Command | @refs | CSS selectors | Notes |
|---------|-------|---------------|-------|
| `get text @e1` | YES | YES | Works with both |
| `get html` | NO | YES | Fails silently with refs |
| `get box` | NO | YES | Returns `{x, y, width, height}` JSON |
| `get styles` | NO | YES | Returns compact summary (font, color, bg, border-radius) |
| `get value` | NO | YES | For form inputs |
| `get attr` | NO | YES | Any HTML attribute |
| `get count` | N/A | YES | Returns element count |
| `get url` | N/A | N/A | No selector needed |
| `get title` | N/A | N/A | No selector needed |
| `click` | YES | YES | Works with both |
| `fill` | YES | YES | Works with both |
| `highlight` | NO | YES | Skill shows `highlight @e1` but this fails |

**Rule of thumb:** Interaction commands (click, fill, type, check, select) work with @refs.
Inspection commands (get html/box/styles, highlight) need CSS selectors.

## CSS Selectors: Strict Mode

Playwright strict mode means CSS selectors must match **exactly one element**. If multiple match, you get an error listing all matches (which is actually helpful for debugging).

**Strategies for unique selectors:**
- Use IDs: `#fork-button`
- Use unique attributes: `[data-testid="submit"]`
- Combine: `.header > a:first-child`
- Use `nth`: `.item:nth-child(3)`

## Ref Lifecycle: The Golden Rule

Refs are invalidated by **any page state change**. This includes:
- Navigation (click links, `open`, `back`, `forward`)
- Scoped snapshots (`snapshot -s`)  <-- easy to forget this one
- Form submissions
- Dynamic content (modals, dropdowns, AJAX loads)
- Even `snapshot` itself replaces all previous refs

**Pattern:** Always snapshot immediately before interacting. Never cache refs across multiple actions that change the page.

## Snapshot Mode Comparison

| Flag | What it returns | When to use |
|------|----------------|-------------|
| `-i` | Interactive elements only | **Default choice** - best token efficiency |
| `-i -C` | Interactive + cursor-interactive | When divs with onclick aren't showing up |
| `-c` | Compact (removes empty nodes) | Unreliable - can return "Empty page" on some sites |
| `-d N` | Depth-limited | When `-i` returns too much |
| `-s "#sel"` | Scoped to selector | Laser focus on one component |
| `--json` | JSON format | Programmatic parsing |

Use an interactive or scoped snapshot when a full DOM listing would obscure the elements needed for the task.

## Annotated Screenshots

`screenshot --annotate` is powerful but **can hang on complex pages** (known issue #509). If it hangs:
1. Kill with Ctrl-C or timeout
2. Fall back to regular `screenshot` + separate `snapshot -i`
3. Works best on simpler pages

The annotated screenshot also **caches refs**, so you can interact with elements immediately after without a separate snapshot.

## Network Monitoring

```bash
# See all requests (captured since page was opened)
agent-browser network requests

# Filter to just API calls (huge noise reduction)
agent-browser network requests --filter "/api/"

# Mock an API response
agent-browser network route "https://api.example.com/data" --body '{"mocked": true}'

# Block a request (e.g., analytics)
agent-browser network route "https://www.google-analytics.com/*" --abort
```

Requests are captured from session start. The `--filter` flag is essential on real sites - without it you get dozens of CSS/image/analytics requests.

## JavaScript Eval Patterns

```bash
# Quick one-liner (single quotes, no nesting)
agent-browser eval 'document.title'

# Complex JS (ALWAYS use --stdin for anything with quotes/arrows/template literals)
agent-browser eval --stdin <<'EVALEOF'
JSON.stringify(
  Array.from(document.querySelectorAll("a"))
    .map(a => ({ text: a.textContent.trim(), href: a.href }))
    .filter(a => a.text.length > 0)
    .slice(0, 10)
)
EVALEOF

# Fetch API from browser context (uses page cookies/auth)
agent-browser eval --stdin <<'EVALEOF'
(async () => {
  const res = await fetch('/api/data');
  return JSON.stringify(await res.json());
})()
EVALEOF
```

## Session Management

- **Always close when done:** `agent-browser close` prevents leaked daemon processes
- **Headed mode for debugging:** `agent-browser --headed open <url>`
- **Persistent headed config:** Add `{"headed": true}` to `~/.agent-browser/config.json`
- **Named sessions for parallel work:** `agent-browser --session name open <url>`

## Authentication and retained browser state

Choose the installed tool's supported state or profile mechanism for the target
application. A saved state file or persistent profile does not prove a later
session is authenticated: check the intended account and a meaningful authorized
page or operation after reopening. Server expiry and application policy can
invalidate retained state.

Use an explicitly owned profile for the task. Obtain any required login through
the user's authorized flow; do not assume a profile, account, application URL or
provider workaround from this guide. Browser/provider compatibility must be
checked for the actual version and flow. No tested login or saved profile is
shipped with these notes.

Treat profile directories and saved state as credential-bearing data. Keep them
in the authorized private location, restrict access, and omit cookies, tokens,
passwords and encryption keys from source, ordinary logs and shared evidence.
If encryption is configured, verify the actual tool configuration and key custody;
do not infer encryption from a filename or assume a shell already exports a key.
Retain or remove only state the task owns and whose disposition is authorized.

## Updating the Official Skill

To sync SKILL.md with upstream while preserving local insights:

```bash
# Download latest official SKILL.md
curl -sL https://raw.githubusercontent.com/vercel-labs/agent-browser/main/skills/agent-browser/SKILL.md \
  -o ~/.claude/skills/agent-browser/SKILL.md

# Re-append the local insights reference (3 lines at end of SKILL.md)
cat >> ~/.claude/skills/agent-browser/SKILL.md << 'EOF'

## Local Dev Insights
**IMPORTANT:** Read `LOCAL-INSIGHTS.md` in this skill directory for gotchas, corrections, and tested workflows discovered through hands-on use that this upstream skill doesn't cover.
EOF
```
