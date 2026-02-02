# MCP-Inspired Tools for eLink Vibecoding

## Overview

MCP (Model Context Protocol) servers extend AI agents with additional capabilities. While OpenClaw doesn't natively support MCP servers, we can implement similar concepts using our existing tools and agent architecture.

## MCP Concepts → OpenClaw Equivalents

| MCP Server | Purpose | OpenClaw Equivalent |
|------------|---------|---------------------|
| **Context7** | Documentation access | `memory-bank/` + `read` tool |
| **DevTools** | Browser automation | `browser` tool + `canvas` |
| **Sequential Thinking** | Structured reasoning | `sessions_spawn` with reasoning mode |
| **Task Manager** | Persistent task tracking | `cron` + `progress.md` + agent labels |
| **Shadcn** | UI component access | `public/` templates + `write` tool |

---

## 1. Context7 Equivalent: Memory Bank System

**Already implemented!** Our `memory-bank/` directory serves the same purpose:

```
memory-bank/
├── projectbrief.md      # What we're building
├── productContext.md    # Why it exists
├── activeContext.md     # Current focus
├── systemPatterns.md    # Architecture patterns
├── techContext.md       # Tech stack & APIs
└── progress.md          # What's done/left
```

**Usage:**
- Agents read all 6 files at start of every task
- Equivalent to Context7's documentation retrieval
- More structured than raw docs

---

## 2. DevTools Equivalent: Browser Testing

**Already available!** Use `browser` tool for automated testing:

```javascript
// Test login page
browser({ action: 'snapshot', targetUrl: 'http://localhost:3000/login' })

// Fill form
browser({ 
  action: 'act',
  request: { kind: 'fill', ref: 'email-input', text: 'test@elink.mk' }
})

// Test OCPP WebSocket
exec({ command: 'wscat -c ws://localhost:3000/ocpp/TEST001' })
```

**Enhanced DevTools Script:**
```bash
# scripts/test-ui.sh
npm start &
sleep 3

# Test auth flow
curl -s -X POST http://localhost:3000/api/auth/register \
  -d '{"email":"test@elink.mk","password":"Test123"}'

# Open browser for visual verification
browser({ action: 'snapshot', targetUrl: 'http://localhost:3000' })
```

---

## 3. Sequential Thinking Equivalent: Reasoning Mode

**Use Kimi Code's reasoning mode** for complex decisions:

```javascript
// Spawn architect with reasoning
sessions_spawn({
  task: "Design email verification system...",
  model: "kimi-coding/kimi-for-coding",
  reasoning: "on"  // Enables step-by-step thinking
})
```

**Or use the pattern directly:**
```markdown
## Sequential Thinking Pattern

When solving complex problems, I will:

1. **Understand** - Read context, identify requirements
2. **Decompose** - Break into smaller sub-problems
3. **Analyze** - Consider options, trade-offs
4. **Decide** - Select approach with rationale
5. **Execute** - Implement step-by-step
6. **Verify** - Test and validate

Current step: [X/6] - [Description]
```

---

## 4. Task Manager Equivalent: Progress Tracking

**Enhanced progress tracking with cron reminders:**

```javascript
// Set daily reminder to update progress
cron({
  action: 'add',
  job: {
    name: 'daily-progress-check',
    schedule: { kind: 'cron', expr: '0 9 * * *' },  // 9 AM daily
    payload: {
      kind: 'systemEvent',
      text: 'Check memory-bank/progress.md. Update task status. Review blocked items.'
    },
    sessionTarget: 'main'
  }
})
```

**Task Status Format in progress.md:**
```markdown
## Active Tasks

| ID | Task | Status | Agent | Updated |
|----|------|--------|-------|---------|
| T1 | Email SMTP | ⏳ | - | 2026-02-02 |
| T2 | Auth UI | ⏳ | - | 2026-02-02 |
| T3 | Staging deploy | 🔄 | deployer | 2026-02-02 |

Status: ⏳ Pending / 🔄 In Progress / ✅ Complete / ❌ Blocked
```

---

## 5. Shadcn Equivalent: Component Library

**Create reusable UI components:**

```javascript
// scripts/create-component.sh
COMPONENT=$1
mkdir -p public/components

# Write component template
cat > public/components/${COMPONENT}.html << 'EOF'
<!-- ${COMPONENT} Component -->
<div class="component-${COMPONENT}">
  <!-- Template -->
</div>

<style>
/* Component styles */
</style>

<script>
// Component logic
</script>
EOF

echo "Component created: public/components/${COMPONENT}.html"
```

---

## Implementation Checklist

- [x] Memory Bank (Context7 equivalent)
- [x] Browser tool (DevTools equivalent)
- [x] Reasoning mode (Sequential Thinking equivalent)
- [ ] Enhanced task tracking (Task Manager)
- [ ] Component library (Shadcn equivalent)
- [ ] Automated testing scripts

## Next Steps

1. Create `scripts/test-e2e.sh` - End-to-end testing
2. Add cron job for daily progress reminders
3. Create component templates in `public/components/`
4. Document the MCP-equivalent workflow
