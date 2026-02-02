# Clavix-Inspired PRD System for eLink

## Overview

Adapted from [Clavix](https://github.com/ClavixDev/Clavix) - a CLEAR-based PRD (Product Requirements Document) generator.

**CLEAR Framework:**
- **C**oncise — Eliminate ambiguity
- **L**ogical — Structured flow
- **E**xplicit — Crystal clear requirements
- **A**daptive — Context-aware
- **R**eflective — Iterative improvement

## PRD Generation Workflow

### Step 1: Raw Idea
```
"I want to add email verification"
```

### Step 2: CLEAR Optimization
**Before:** "add email verification"
**After:** "Implement email verification system with SMTP integration, token generation, expiration handling, and resend capability. Include verification required for sensitive operations."

### Step 3: Full PRD
Generated PRD includes:
- Executive Summary
- Scope (In/Out)
- Technical Requirements
- Implementation Tasks
- Acceptance Criteria

### Step 4: Task Breakdown
Ready-to-implement tasks for agents

### Step 5: Execution
Spawn agents with specific PRD sections

---

## PRD Template

```markdown
# PRD: [Feature Name]

## Executive Summary
[Brief description of what this feature does and why]

## Scope

### In Scope
- [Specific item 1]
- [Specific item 2]

### Out of Scope
- [Item explicitly not included]
- [Future enhancement]

## Technical Requirements

### Database Changes
```sql
-- Schema additions
```

### API Endpoints
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | /api/x | JWT | [Description] |

### Frontend Changes
- [Page/component 1]
- [Page/component 2]

## Implementation Tasks

| ID | Task | Priority | Est. Time | Agent |
|----|------|----------|-----------|-------|
| T1 | [Task description] | High | 2h | Architect |
| T2 | [Task description] | High | 4h | Coder |
| T3 | [Task description] | Med | 2h | Reviewer |

## Acceptance Criteria

- [ ] Criterion 1 (measurable)
- [ ] Criterion 2 (testable)
- [ ] Criterion 3 (verifiable)

## Risks & Mitigations

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| [Risk] | High/Med/Low | [How to handle] |

## References
- memory-bank/systemPatterns.md
- memory-bank/techContext.md
```

---

## Quick PRD Generation

### For Simple Features
```bash
# Use fast mode (minimal PRD)
./scripts/prd-gen.sh fast "add email verification"
```

### For Complex Features
```bash
# Use deep mode (full PRD)
./scripts/prd-gen.sh deep "build real-time notification system"
```

### Output
```
Generated: docs/prd/2026-02-02-email-verification.md
Tasks: 5 generated
Ready to spawn agents.
```

---

## PRD Storage

```
docs/prd/
├── README.md              # Index of all PRDs
├── 2026-02-02-email-verification.md
├── 2026-02-03-sms-auth.md
└── template.md            # PRD template
```

---

## Agent Integration

### Spawn from PRD
```bash
# Spawn architect to review PRD
/new elink-arch-review \
  "Review PRD: docs/prd/2026-02-02-email-verification.md"

# Spawn coder to implement specific task
/new elink-code-smtp \
  "Implement PRD Task T2: SMTP integration. See docs/prd/..."
```

### PRD → Agent Mapping

| PRD Section | Agent | Output |
|-------------|-------|--------|
| Technical Requirements | Architect | Design decisions |
| Implementation Tasks | Coder | Code changes |
| Acceptance Criteria | Tester | Test results |
| All sections | Reviewer | Review report |

---

## Example: Email Verification PRD

```markdown
# PRD: Email Verification System

## Executive Summary
Implement email verification to ensure valid user email addresses, reduce spam accounts, and enable password reset functionality.

## Scope

### In Scope
- SMTP integration (SendGrid/AWS SES)
- Verification token generation
- Email templates (verification, welcome)
- Token expiration (24 hours)
- Resend verification
- Verification required for charging

### Out of Scope
- SMS verification (future)
- Email analytics
- Marketing emails

## Technical Requirements

### Database Changes
```sql
-- users table already has verification_token, email_verified
-- Add expiration to token
ALTER TABLE users ADD COLUMN verification_expires INTEGER;
```

### API Endpoints
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | /api/auth/verify-email | - | Verify with token |
| POST | /api/auth/resend | JWT | Resend verification |
| GET | /api/auth/verify-status | JWT | Check status |

### Frontend Changes
- Verification page (/verify?token=xxx)
- Resend button on profile
- Verification banner on dashboard

## Implementation Tasks

| ID | Task | Priority | Est. | Agent |
|----|------|----------|------|-------|
| T1 | Choose email provider | High | 30m | You |
| T2 | Add SMTP config | High | 1h | Coder |
| T3 | Create email service | High | 2h | Coder |
| T4 | Add verification endpoints | High | 2h | Coder |
| T5 | Create email templates | Med | 2h | Coder |
| T6 | Frontend verification page | Med | 3h | Coder |
| T7 | Require verification for charging | Med | 1h | Coder |
| T8 | Test full flow | High | 1h | Tester |

## Acceptance Criteria

- [ ] User receives verification email within 60 seconds
- [ ] Token expires after 24 hours
- [ ] Resend works and invalidates old token
- [ ] Unverified users cannot start charging
- [ ] Welcome email sent after verification
- [ ] Works with SendGrid and AWS SES

## Risks & Mitigations

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Emails marked as spam | High | Use verified domain, SPF/DKIM |
| SMTP provider downtime | Med | Fallback provider or queue |
| Rate limiting | Med | Implement exponential backoff |
```

---

## Best Practices

1. **Start with PRD** — Before spawning any agents
2. **Be explicit** — No ambiguity in requirements
3. **Scope boundaries** — Clearly define in/out of scope
4. **Measurable criteria** — Acceptance criteria must be testable
5. **Iterate** — Update PRD as you learn

---

## Integration with Memory Bank

```
1. Check memory-bank/progress.md
   → See what's already done
   
2. Generate PRD
   → Define new feature completely
   
3. Update progress.md
   → Add PRD tasks to backlog
   
4. Spawn agents
   → Assign PRD tasks to specific agents
   
5. Mark complete
   → Update progress.md as tasks finish
```

---

## Commands

```bash
# Generate PRD from idea
./scripts/prd-gen.sh [fast|deep] "description"

# List all PRDs
ls -la docs/prd/*.md

# View PRD
cat docs/prd/2026-02-02-feature-name.md

# Spawn agent from PRD task
./scripts/spawn-from-prd.sh docs/prd/... T2
```
