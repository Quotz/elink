# Active Context: eLink

## Current Focus (2026-02-02)

**GOAL: Demo/Presentation Ready App**

### Just Completed
- [x] v2.0 auth system (JWT, roles, sessions) - Backend ready
- [x] Charger verification workflow - Backend ready
- [x] CitrineOS REST client integration - Backend ready
- [x] SQLite database schema
- [x] Memory Bank documentation structure
- [x] Staging deployment scripts

### In Progress
- [ ] **STAGING VPS DEPLOYMENT** - PRIORITY #1
  - Need: Hetzner CX21 VPS
  - Domain: staging.elink.mk
  - Test with 1-2 chargers

### Demo Scope (What's Needed)
| Feature | Backend | Frontend | Status |
|---------|---------|----------|--------|
| User auth API | ✅ | ⏳ Optional | Works via curl/API |
| Charger status | ✅ | ✅ | Already works |
| Start/stop charging | ✅ | ✅ | Already works |
| Map display | ✅ | ✅ | Already works |
| Real-time updates | ✅ | ✅ | WebSocket works |
| **Email verification** | ⏳ | ❌ | **NOT NEEDED for demo** |
| **Auth UI pages** | N/A | ⏳ | **NOT NEEDED for demo** |

### What's NOT Needed for Demo
- ❌ Email verification (tokens work, SMTP not needed)
- ❌ Auth UI pages (API demo sufficient)
- ❌ Document upload (backend API demo sufficient)
- ❌ CitrineOS (built-in OCPP works)

### Next Steps
1. **Order Hetzner CX21** (~€5/mo)
2. **Configure DNS** staging.elink.mk → VPS IP
3. **Run setup-hetzner.sh** on VPS
4. **Deploy v2.0** with deploy-staging.sh
5. **Test with 1 charger** - Verify OCPP works
6. **Demo ready!**

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
