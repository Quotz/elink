# eLink Deployment & Migration Strategy

## Current State

**Production (LIVE):**
- URL: https://app.elink.mk
- OCPP: ocpp.fankeeps.com:8081/ocpp
- Version: v1.0-stable
- Status: Chargers connected and sending data
- Database: stations.json (file-based)

**Staging (NEW):**
- Provider: Hetzner (recommended: CX21 - €5.35/mo, 2 vCPU, 4GB RAM)
- URL: https://staging.elink.mk (or dev.elink.mk)
- OCPP: staging.elink.mk/ocpp
- Version: v2.0-dev
- Database: SQLite (new)

## Migration Strategy: "Parallel Run"

### Phase 1: Staging Setup (No Risk)
```
Staging VPS (Hetzner)
├── Clean v2.0 install
├── Test chargers (1-2 units)
├── No production data
└── Independent testing
```

### Phase 2: Gradual Migration (Controlled)
```
┌─────────────────┐     ┌──────────────────┐
│  Production     │     │    Staging       │
│  v1.0 (Live)    │     │    v2.0 (Test)   │
│                 │     │                  │
│  Chargers A-F   │     │   Chargers X-Z   │
│  (all current)  │     │   (new/test)     │
└────────┬────────┘     └────────┬─────────┘
         │                       │
         └───────┬───────────────┘
                 │
         Decision Point:
         - Staging stable?
         - Ready to migrate?
```

### Phase 3: Cutover (Planned)
Option A: Big Bang (risky)
- Stop v1.0
- Start v2.0 on same domain
- All chargers reconnect

Option B: Gradual (recommended)
- Migrate chargers one by one
- Keep v1.0 running
- Update charger config to new endpoint

## Recommended Hetzner Setup

### Server Specs: CX21
- 2 vCPUs (Intel/AMD)
- 4 GB RAM
- 40 GB NVMe SSD
- €5.35/month
- Location: Falkenstein (DE) or Helsinki (FI)

### Why CX21?
- Sufficient for testing (< 100 chargers)
- NVMe SSD = fast SQLite performance
- Easy upgrade path (CX31, CX41)
- Hetzner reliability

### Software Stack
```
Ubuntu 22.04 LTS
├── Node.js 18+ (via NVM)
├── PM2 (process manager)
├── Nginx (reverse proxy + SSL)
├── SQLite (database)
└── Git
```

## Deployment Architecture

```
                          ┌─────────────────┐
                          │   Cloudflare    │
                          │   (DNS + SSL)   │
                          └────────┬────────┘
                                   │
                         ┌─────────┴─────────┐
                         │                   │
                         ▼                   ▼
               ┌─────────────────┐  ┌─────────────────┐
               │  app.elink.mk   │  │ staging.elink   │
               │   (v1.0 Live)   │  │   .mk (v2.0)    │
               │                 │  │                 │
               │  Current VPS    │  │  Hetzner CX21   │
               └─────────────────┘  └─────────────────┘
               
Future (when needed):
               ┌─────────────────┐
               │ citrine.elink   │
               │   .mk (OCPP)    │
               │                 │
               │  Hetzner VPS    │
               └─────────────────┘
```

## Migration Plan (Step by Step)

### Step 1: Staging Deployment
1. Order Hetzner CX21
2. Configure DNS: staging.elink.mk → Hetzner IP
3. Install Node.js, PM2, Nginx
4. Clone repo, checkout v2.0-dev
5. Configure environment variables
6. Start with PM2
7. Test with 1-2 chargers

### Step 2: Data Migration Script
```bash
# Migrate stations.json to SQLite
node scripts/migrate-v1-to-v2.js

# This will:
# - Read stations.json
# - Insert into SQLite
# - Preserve all charger IDs
# - Create default users
```

### Step 3: Charger Migration (Per Charger)
For each charger:
1. Update charger config:
   - OLD: ws://ocpp.fankeeps.com:8081/ocpp/CHARGER-ID
   - NEW: wss://staging.elink.mk/ocpp/CHARGER-ID
2. Charger reconnects to staging
3. Verify connection
4. Test start/stop
5. Update DNS to point staging → production

### Step 4: CitrineOS (DEFERRED - Not in v2.0)
**Decision: CitrineOS is NOT part of v2.0 migration.**

v2.0 uses the same built-in OCPP handler as v1.0. CitrineOS integration is:
- Built and tested (citrine-client.js ready)
- Disabled by default (no CITRINEOS_URL configured)
- Available later when scaling requires it

When to add CitrineOS:
- 50+ chargers AND
- Need OCPP 2.0.1 or advanced features AND
- Have ops bandwidth for extra server

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Chargers disconnect | Keep v1.0 running until v2.0 stable |
| Data loss | Daily backups to S3/Spaces |
| CitrineOS fails | v2.0 works without it (optional integration) |
| Performance issues | Monitor with PM2, upgrade CX21 → CX31 if needed |
| SSL/cert issues | Use Nginx + Let's Encrypt (auto-renew) |

## Timeline Estimate

| Phase | Duration | Tasks |
|-------|----------|-------|
| Staging setup | 2-4 hours | Hetzner provision, install, deploy v2.0 |
| Testing | 1-3 days | Auth flow, charger connection, stress test |
| Migration prep | 4-8 hours | Migration scripts, backup strategy |
| Production cutover | 2-4 hours | DNS switch, monitor, rollback plan |
| CitrineOS setup | (Future) | Deferred until scaling requires it |

## Cost Estimate

| Service | Monthly |
|---------|---------|
| Hetzner CX21 | €5.35 |
| Hetzner CX31 (if upgrade) | €9.90 |
| Hetzner CitrineOS server | €5.35-€9.90 |
| Domain (staging.elink.mk) | $0 (subdomain) |
| Backups (Hetzner Spaces) | ~€1 |
| **Total** | **€6-20/month** |

## Next Steps

1. **Order Hetzner VPS** - I can provide setup script
2. **Configure DNS** - Add staging.elink.mk A record
3. **Deploy v2.0** - Use automated script
4. **Test with spare charger** - Verify OCPP works
5. **Migrate gradually** - One charger at a time

## Files to Create

1. `scripts/setup-hetzner.sh` - Server provisioning
2. `scripts/deploy-staging.sh` - Staging deployment
3. `scripts/migrate-v1-to-v2.js` - Data migration
4. `nginx/staging.conf` - Nginx config with SSL
5. `systemd/elink-staging.service` - Service file

Want me to create these scripts?
