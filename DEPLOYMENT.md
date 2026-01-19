# 🚀 Deployment Guide

This project uses an automated deployment workflow to push changes to GitHub and deploy to your VPS.

## Quick Start

Deploy your changes with a single command:

```bash
npm run deploy "your commit message here"
```

That's it! The script will:
1. ✅ Stage all changes
2. ✅ Commit with your message
3. ✅ Push to GitHub
4. ✅ SSH to your VPS
5. ✅ Pull latest code
6. ✅ Install dependencies
7. ✅ Restart the app with PM2
8. ✅ Show status and logs

---

## Configuration

The deployment is configured in `deploy.sh`:

- **VPS Host**: `46.224.209.188`
- **VPS Path**: `/var/www/ev-charging-app`
- **PM2 App**: `elink`
- **GitHub Branch**: `main`
- **Live URL**: `https://ocpp.fankeeps.com`
- **Admin Panel**: `https://ocpp.fankeeps.com/admin.html`

---

## Examples

### Deploy a feature
```bash
npm run deploy "Added admin panel for charger management"
```

### Deploy a bug fix
```bash
npm run deploy "Fixed WebSocket reconnection issue"
```

### Deploy configuration changes
```bash
npm run deploy "Updated charger coordinates"
```

---

## Manual Deployment (if needed)

If you need to deploy manually or troubleshoot:

### 1. Push to GitHub
```bash
git add .
git commit -m "your message"
git push origin main
```

### 2. SSH to VPS and deploy
```bash
ssh root@46.224.209.188
cd /var/www/ev-charging-app
git pull origin main
npm install --production
pm2 restart elink
pm2 status
```

---

## Troubleshooting

### PM2 App Shows "Errored"

Check the logs:
```bash
ssh root@46.224.209.188
pm2 logs elink
```

Common issues:
- Port 3000 already in use: `pm2 delete elink` then restart
- Missing dependencies: Run `npm install` on VPS
- Syntax errors: Check the logs for details

### Fix PM2 App

If the app is stuck in error state:
```bash
ssh root@46.224.209.188
cd /var/www/ev-charging-app

# Delete the errored app
pm2 delete elink

# Start fresh
pm2 start server/index.js --name elink

# Save the configuration
pm2 save
```

### SSH Connection Issues

Make sure your SSH key is added to the VPS:
```bash
ssh-copy-id root@46.224.209.188
```

Or check if you can SSH manually:
```bash
ssh root@46.224.209.188
```

### Deployment Script Won't Run

Make the script executable:
```bash
chmod +x deploy.sh
```

On Windows, use Git Bash or WSL to run the script.

---

## PM2 Useful Commands

View all apps:
```bash
pm2 list
```

View logs:
```bash
pm2 logs elink
pm2 logs elink --lines 50
```

Restart app:
```bash
pm2 restart elink
```

Stop app:
```bash
pm2 stop elink
```

Monitor in real-time:
```bash
pm2 monit
```

---

## Notes

- The deployment script requires SSH access to your VPS
- Make sure your GitHub credentials are configured locally
- The script uses the `main` branch by default
- All changes are committed and pushed before deploying
- PM2 keeps the app running even after server restarts

---

## Need Help?

If deployment fails, check:
1. SSH connection to VPS works
2. Git credentials are set up locally
3. PM2 is installed on VPS (`npm install -g pm2`)
4. App directory exists on VPS
5. Git repository is initialized on VPS

For PM2 issues, view the logs with `pm2 logs elink` on your VPS.
