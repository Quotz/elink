# Active Context: eLink

## Current Focus (2026-02-02)

### Just Completed
- [x] v2.0 auth system (JWT, roles, sessions)
- [x] Charger verification workflow
- [x] CitrineOS REST client integration
- [x] SQLite database schema
- [x] Multi-agent vibecoding system setup
- [x] Memory Bank documentation structure

### In Progress
- [ ] Memory Bank implementation (this session)
- [ ] Documentation consolidation

### Next Up (Prioritized)
1. **VPS deployment testing** - Hetzner CX21, test with 1-2 chargers
2. **Email SMTP integration** - Set up SendGrid/AWS SES
3. **Frontend auth UI** - Login/register pages
4. **Document upload system** - S3 integration for ownership proofs

### Deferred (Post v2.0)
- CitrineOS integration - Will add when scaling requires it

## Active Decisions

### Architecture Decisions
- **SQLite over PostgreSQL**: For simplicity; can migrate when needed
- **JWT in cookies + localStorage**: Balanced security/UX
- **CitrineOS integration**: Gradual migration, not immediate switchover
- **Multi-agent vibecoding**: Architect → Coder → Reviewer → Tester → Deployer

### Pending Decisions
- Which email provider? (SendGrid vs AWS SES vs Mailgun)
- Frontend framework for auth UI? (Keep vanilla JS vs add React)
- When to migrate to CitrineOS fully?

## Recent Learnings

### Kimi Code Optimization
- Reasoning ON for architectural decisions
- Thinking ON for debugging complex issues
- Direct prompts for implementation
- Always read database.js, auth.js, index.js first

### Agent Workflow
- Architect agents should NOT write code
- Coder agents need specific file paths
- Reviewer agents catch security issues effectively
- 5-agent flow works but can be slow; use hotfix flow for urgent issues

## Important Patterns

### Code Patterns
- Async/await with try/catch in all routes
- Database methods return Promises
- Auth middleware attaches req.user
- WebSocket broadcasts for real-time updates

### Git Patterns
- Feature branches: `feature/auth-system`
- Tags for versions: `v1.0-stable`, `v2.0-dev`
- Deploy script handles backup/rollback

## Blockers
None currently.

## Notes
- User (Andrey) owns VPS and GitHub repo (quotz/elink)
- Production URL: app.elink.mk
- Current version running: v1.0 (need to deploy v2.0)
