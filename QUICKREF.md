# eLink Quick Reference

## 🚨 Safety First

### Current Protected Versions
```bash
# Tag v1.0-stable: Original production version (commit 4a4e84c)
# Tag v2.0-dev: Current dev version with auth (commit 4cb854b)

# Emergency rollback
git checkout v1.0-stable
pm2 restart elink

# Or use deploy script
./deploy.sh rollback
```

## 🚀 Deployment

```bash
# Deploy stable (v1.0)
./deploy.sh stable

# Deploy dev (v2.0 with auth)
./deploy.sh dev

# Check status
./deploy.sh status

# Create backup
./deploy.sh backup
```

## 🔧 Development

```bash
# Start dev server
npm run dev

# Test auth
./test-auth.sh

# Check syntax
node -c server/index.js
```

## 📚 Documentation

| File | Purpose |
|------|---------|
| `VIBECODING_SUMMARY.md` | What was built in v2.0 |
| `VIBECODING_SYSTEM.md` | Multi-agent workflow |
| `KIMI_CODE_GUIDE.md` | Kimi Code optimization |
| `README.md` | App documentation |

## 🎯 Quick Commands

```bash
# View logs
pm2 logs elink

# Restart
pm2 restart elink

# Monitor
pm2 monit

# Database
sqlite3 data/elink.db ".tables"
```

## 🆘 Emergency Contacts

- **GitHub:** https://github.com/quotz/elink
- **Production:** https://app.elink.mk
- **VPS:** SSH to your server
