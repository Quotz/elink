# eLink Vibecoding System

## 🎯 Multi-Agent Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     YOU (Product Owner)                      │
└────────────────────┬────────────────────────────────────────┘
                     │
        ┌────────────┼────────────┐
        ▼            ▼            ▼
┌──────────────┬──────────┬──────────────┐
│  Architect   │  Coder   │   Reviewer   │
│   Agent      │  Agent   │    Agent     │
└──────┬───────┴────┬─────┴──────┬───────┘
       │            │            │
       └────────────┼────────────┘
                    ▼
           ┌─────────────┐
           │   Tester    │
           │   Agent     │
           └──────┬──────┘
                  ▼
           ┌─────────────┐
           │  Deployer   │
           │   Agent     │
           └─────────────┘
```

## 👥 Agent Roles

### 1. 🏗️ Architect Agent
**Purpose:** High-level design, database schema, API design

**When to spawn:**
- New features requiring structural changes
- Database migrations
- API design decisions
- Integration planning (CitrineOS, payment, etc.)

**Prompt template:**
```
You are the Architect for eLink EV charging app.
Current tech stack: Node.js, Express, SQLite, WebSocket OCPP

Task: Design [FEATURE]

Requirements:
- [List requirements]

Deliverables:
1. Database schema changes (if any)
2. API endpoint design
3. Data flow diagram
4. Implementation plan

DO NOT write code. Only design and documentation.
```

### 2. 💻 Coder Agent
**Purpose:** Write actual implementation code

**When to spawn:**
- After Architect approves design
- Bug fixes
- Feature implementation
- Refactoring

**Prompt template:**
```
You are the Coder for eLink EV charging app.
Implement: [FEATURE/BUG]

Design doc: [PASTE ARCHITECT OUTPUT]

Requirements:
- Follow existing code patterns
- Add error handling
- Add logging
- Update tests if applicable

Work in: /root/.openclaw/workspace/elink
Commit when done.
```

### 3. 🔍 Reviewer Agent
**Purpose:** Code review, security checks, best practices

**When to spawn:**
- After Coder completes work
- Before merging to main
- Security-sensitive changes

**Prompt template:**
```
You are the Code Reviewer for eLink.
Review the changes in: [BRANCH/COMMIT]

Check for:
1. Security issues (SQL injection, XSS, auth bypass)
2. Code quality (readability, maintainability)
3. Error handling
4. Performance issues
5. Test coverage

Output: Review report with CRITICAL / WARNING / SUGGESTION ratings
```

### 4. 🧪 Tester Agent
**Purpose:** Test implementation, write tests, verify functionality

**When to spawn:**
- After Reviewer approves
- Before deployment
- Regression testing

**Prompt template:**
```
You are the Tester for eLink.
Test feature: [FEATURE]

Test plan:
1. Happy path tests
2. Edge cases
3. Error scenarios
4. Integration tests

Write automated tests where possible.
Provide test report: PASS/FAIL for each case.
```

### 5. 🚀 Deployer Agent
**Purpose:** Handle deployment, migrations, production issues

**When to spawn:**
- Ready to deploy
- Production issues
- Rollback scenarios

## 🔄 Workflow

### Standard Feature Flow:
```
1. You → Architect: "Design user profile feature"
2. Architect → You: Design doc
3. You → Coder: "Implement per this design"
4. Coder → You: "Done, commit abc123"
5. You → Reviewer: "Review commit abc123"
6. Reviewer → You: "Approved with minor fixes"
7. You → Coder: "Fix the 2 issues Reviewer found"
8. You → Tester: "Test the feature"
9. Tester → You: "All tests pass"
10. You → Deployer: "Deploy to production"
```

### Hotfix Flow (emergency):
```
1. You → Coder: "Fix critical bug X"
2. Coder → You: "Fixed, commit def456"
3. You → Reviewer: "Quick review please"
4. Reviewer → You: "Approved"
5. You → Deployer: "Deploy hotfix"
```

## 📋 Agent Session Management

### Naming Convention:
- `elink-arch-<feature>` - Architect sessions
- `elink-code-<feature>` - Coder sessions
- `elink-review-<commit>` - Reviewer sessions
- `elink-test-<feature>` - Tester sessions
- `elink-deploy-<version>` - Deployer sessions

### Session Cleanup:
- Delete agent sessions after merge to main
- Keep logs for 30 days
- Archive design docs to `docs/design/`

## 🚀 Quick Commands

```bash
# Spawn Architect for new feature
/new elink-arch-user-profile

# Spawn Coder after design done
/new elink-code-user-profile

# Spawn Reviewer
/new elink-review-abc123

# Spawn Tester
/new elink-test-user-profile

# Spawn Deployer
/new elink-deploy-v2.1
```

## 📁 Workspace Organization

```
workspace/
├── elink/                    # Main repo
│   ├── docs/
│   │   ├── design/           # Architecture docs
│   │   ├── api/              # API documentation
│   │   └── decisions/        # ADRs (Architecture Decision Records)
│   ├── scripts/
│   │   ├── deploy.sh         # Deployment script
│   │   ├── backup.sh         # Backup script
│   │   └── test.sh           # Test runner
│   └── memory/
│       ├── sessions/         # Session summaries
│       └── agents/           # Agent outputs
│
└── elink-staging/            # Staging environment (if needed)
```

## 🎯 Current Active Agents

| Agent | Status | Task | Session Key |
|-------|--------|------|-------------|
| (None active) | - | - | - |

## 📝 Session Log Template

When spawning agents, they should report back with:

```markdown
## Agent Report: [ROLE]
**Task:** [What they did]
**Time:** [Duration]
**Commits:** [Commit hashes]
**Files Changed:** [List]
**Status:** ✅ Complete / ⚠️ Needs Review / ❌ Blocked
**Next Steps:** [What needs to happen next]
```
