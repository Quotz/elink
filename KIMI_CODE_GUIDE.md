# Kimi Code Optimization for Vibecoding

## 🎯 Why Kimi Code?

Kimi Code (kimi-for-coding) is optimized for:
- Long context windows (2M+ tokens)
- Code generation and understanding
- Complex multi-file refactoring
- Technical reasoning

## ⚙️ Optimal Configuration

### Model Settings

```yaml
# Recommended for vibecoding
model: kimi-coding/kimi-for-coding
reasoning: off      # Turn ON for complex architectural decisions
thinking: off       # Turn ON for debugging/tricky problems
temperature: 0.7    # Balance creativity vs consistency
```

### When to Enable Reasoning/Thinking

| Scenario | Reasoning | Thinking | Why |
|----------|-----------|----------|-----|
| Simple CRUD operations | OFF | OFF | Fast, direct output |
| Complex auth flows | ON | OFF | Need step-by-step logic |
| Debugging failures | ON | ON | Deep analysis needed |
| Database migrations | ON | OFF | Schema design reasoning |
| API design | ON | OFF | Architectural decisions |
| Code review | ON | OFF | Quality assessment |
| Refactoring | OFF | ON | Code structure analysis |

## 🚀 Vibecoding Prompt Patterns

### Pattern 1: Feature Specification
```
Implement [FEATURE] for eLink.

Context:
- Tech stack: Node.js, Express, SQLite, JWT
- Current auth: JWT with refresh tokens
- Database schema: See /server/database.js

Requirements:
1. [Specific requirement]
2. [Specific requirement]

Constraints:
- Follow existing code patterns
- Add error handling
- Update database schema if needed
- Write tests

Start by reading:
1. /server/database.js - understand current schema
2. /server/index.js - understand route patterns
3. /server/auth.js - understand auth middleware

Then implement in this order:
1. Database changes
2. Route handlers
3. Middleware updates
4. Tests

Commit when done with message: "feat: [feature description]"
```

### Pattern 2: Bug Fix
```
Fix bug: [DESCRIPTION]

Error:
```
[Error message/stack trace]
```

Steps to reproduce:
1. [Step 1]
2. [Step 2]

Expected: [What should happen]
Actual: [What actually happens]

Read the relevant files, identify the issue, fix it.
Add a test that would have caught this bug.
Commit: "fix: [bug description]"
```

### Pattern 3: Refactor
```
Refactor: [WHAT and WHY]

Current issues:
- [Issue 1]
- [Issue 2]

Target state:
- [Goal 1]
- [Goal 2]

Read all affected files first.
Make minimal changes to achieve the goal.
Ensure all existing tests pass.
Commit: "refactor: [description]"
```

### Pattern 4: Code Review
```
Review commit: [HASH]

Focus areas:
- Security vulnerabilities
- Error handling gaps
- Performance issues
- Code readability

Provide specific line-by-line feedback where applicable.
Rate each file: ✅ / ⚠️ / ❌
```

## 📝 Context Management

### Before Coding - Always Read:
1. **Database schema** - `server/database.js`
2. **Current routes** - `server/index.js` and `server/routes/`
3. **Auth logic** - `server/auth.js`
4. **Environment** - `.env` or `package.json`

### During Coding - Keep Context:
- Open relevant files in context
- Reference line numbers when discussing
- Quote relevant code sections

### After Coding - Document:
- Update README if API changes
- Add to VIBECODING_SUMMARY.md
- Create ADR if architectural decision

## 🎭 Agent Specialization Prompts

### Architect Agent
```
You are the System Architect for eLink.
Your role is HIGH-LEVEL DESIGN ONLY.

DO NOT write implementation code.
DO write:
- Database schema designs
- API endpoint specifications
- System diagrams (ASCII art)
- Technology choices with rationale
- Migration plans

Output format:
## Design: [Feature Name]

### Overview
[1-2 paragraph description]

### Database Changes
```sql
-- Schema additions
```

### API Specification
| Endpoint | Method | Auth | Body | Response |
|----------|--------|------|------|----------|
| /api/x | POST | JWT | {...} | {...} |

### Data Flow
```
[ASCII diagram]
```

### Implementation Phases
1. [Phase 1]
2. [Phase 2]

### Risks & Mitigations
| Risk | Likelihood | Mitigation |
|------|------------|------------|
| [Risk] | High/Med/Low | [How to handle] |
```

### Coder Agent
```
You are the Senior Developer for eLink.
Your role is IMPLEMENTATION.

You have received a design document. Implement it.

Rules:
1. Follow existing code style exactly
2. Copy-paste working patterns from existing code
3. Handle all errors
4. Add debug logging
5. Write comments for complex logic
6. Create/update tests

Before coding:
1. Read the files you'll modify
2. Understand the patterns used
3. Plan your changes

After coding:
1. Run syntax check: node -c [file]
2. Test your changes
3. Commit with descriptive message

Use these tools freely:
- read/edit/write for files
- exec for testing
- browser for UI verification
```

### Reviewer Agent
```
You are the Code Reviewer for eLink.
Your role is QUALITY ASSURANCE.

Review the provided code changes.

Checklist:
□ Security: No SQL injection, XSS, auth bypass
□ Errors: All async calls have try/catch
□ Validation: Input validation on all endpoints
□ Auth: Proper middleware usage
□ Logging: Appropriate debug/error logs
□ Tests: New code has test coverage
□ Performance: No N+1 queries, no blocking ops

Output format:
## Review: [Commit/PR]

### Security Assessment
| Check | Status | Notes |
|-------|--------|-------|
| Input sanitization | ✅/⚠️/❌ | |
| Auth checks | ✅/⚠️/❌ | |
| SQL injection | ✅/⚠️/❌ | |

### Code Quality
| File | Rating | Issues |
|------|--------|--------|
| [file] | ✅/⚠️/❌ | [list] |

### Required Changes
1. [Specific change needed]

### Optional Improvements
1. [Suggestion]

### Verdict
[APPROVED / APPROVED_WITH_FIXES / REJECTED]
```

## 🔄 Iteration Strategy

### Sprint Cycle (1-2 days)
```
Day 1 Morning:
- You plan features
- Spawn Architect agents for complex features

Day 1 Afternoon:
- Review Architect outputs
- Spawn Coder agents

Day 2 Morning:
- Coders report completion
- Spawn Reviewer agents

Day 2 Afternoon:
- Address review feedback
- Spawn Tester agents
- Deploy if all pass
```

### Hotfix Cycle (hours)
```
Hour 1:
- Identify issue
- Spawn Coder with hotfix priority

Hour 2:
- Quick review
- Deploy
```

## 📊 Performance Tips

### For Fast Responses:
1. **Break up large tasks** - Spawn multiple agents for parallel work
2. **Use specific file paths** - Avoid broad searches
3. **Provide examples** - "Follow the pattern in auth.js"
4. **Limit scope** - One feature per agent session

### For Complex Tasks:
1. **Enable reasoning** - For architectural decisions
2. **Provide full context** - Paste relevant code sections
3. **Use step-by-step** - "Do X, then Y, then Z"
4. **Check in frequently** - "Report back after each step"

## 🛠️ Tool Usage Best Practices

### File Operations
```javascript
// Good - Specific and clear
read({ path: '/root/.openclaw/workspace/elink/server/database.js' })

// Good - With offset for large files
read({ path: '/root/.openclaw/workspace/elink/server/index.js', offset: 1, limit: 50 })

// Good - Precise edit
edit({ 
  path: '/root/.openclaw/workspace/elink/server/auth.js',
  oldText: 'const JWT_EXPIRES_IN = "15m";',
  newText: 'const JWT_EXPIRES_IN = "30m";'
})
```

### Execution
```javascript
// Good - Quick check
exec({ command: 'node -c server/auth.js' })

// Good - With timeout
exec({ command: 'npm test', timeout: 60 })

// Good - Background server
exec({ command: 'npm start', background: true })
```

### Browser Testing
```javascript
// Good - Snapshot for verification
browser({ action: 'snapshot', targetUrl: 'http://localhost:3000' })

// Good - Test interaction
browser({ 
  action: 'act',
  request: { kind: 'click', ref: 'e12' }
})
```

## 🎯 Current Kimi Code Recommendations for eLink

Based on current codebase complexity:

| Task Type | Reasoning | Thinking | Notes |
|-----------|-----------|----------|-------|
| Simple endpoint | OFF | OFF | Direct implementation |
| Auth changes | ON | OFF | Security critical |
| DB migrations | ON | OFF | Schema decisions |
| Frontend work | OFF | OFF | UI implementation |
| Integration (CitrineOS) | ON | ON | Complex interactions |
| Bug hunting | ON | ON | Deep analysis needed |
| Performance optimization | ON | OFF | Algorithmic thinking |
| Code review | ON | OFF | Quality assessment |

## 📚 Quick Reference Card

```
SPAWN ARCHITECT:
/new elink-arch-[feature] "Design [feature]. High-level only, no code."

SPAWN CODER:
/new elink-code-[feature] "Implement per design doc. Follow existing patterns."

SPAWN REVIEWER:
/new elink-review-[commit] "Review commit [hash]. Security + quality focus."

SPAWN TESTER:
/new elink-test-[feature] "Test [feature]. Happy path + edge cases."

DEPLOY:
./deploy.sh dev|stable|rollback
```
