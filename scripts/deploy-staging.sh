#!/bin/bash
# Deploy eLink v2.0 to Staging
# Run from local machine (not on VPS)

set -e

# Configuration
STAGING_HOST="staging.elink.mk"
STAGING_USER="root"  # Or your SSH user
APP_DIR="/opt/elink-staging"
REPO_URL="https://github.com/quotz/elink.git"

echo "╔════════════════════════════════════════════════════════╗"
echo "║         Deploy eLink v2.0 to Staging                   ║"
echo "╚════════════════════════════════════════════════════════╝"
echo ""
echo "Target: $STAGING_HOST"
echo ""

# Check if we can connect
echo "[1/5] Checking SSH connection..."
if ! ssh -o ConnectTimeout=5 $STAGING_USER@$STAGING_HOST "echo 'Connected'" 2>/dev/null; then
    echo "ERROR: Cannot connect to $STAGING_HOST"
    echo "Make sure:"
    echo "  1. VPS is running"
    echo "  2. SSH key is added"
    echo "  3. DNS is configured (staging.elink.mk → VPS IP)"
    exit 1
fi

# Backup current deployment
echo "[2/5] Creating backup..."
ssh $STAGING_USER@$STAGING_HOST "
    if [ -d $APP_DIR ]; then
        BACKUP_DIR=\"/opt/backups/elink-\$(date +%Y%m%d-%H%M%S)\"
        mkdir -p \\$BACKUP_DIR
        cp -r $APP_DIR/data \\$BACKUP_DIR/ 2>/dev/null || true
        echo \"Backup created: \$BACKUP_DIR\"
    fi
"

# Pull latest code
echo "[3/5] Updating code..."
ssh $STAGING_USER@$STAGING_HOST "
    cd $APP_DIR
    sudo -u elink git fetch origin
    sudo -u elink git checkout v2.0-dev
    sudo -u elink git pull origin v2.0-dev
"

# Install dependencies
echo "[4/5] Installing dependencies..."
ssh $STAGING_USER@$STAGING_HOST "
    cd $APP_DIR
    sudo -u elink npm install --production
"

# Restart application
echo "[5/5] Restarting application..."
ssh $STAGING_USER@$STAGING_HOST "
    cd $APP_DIR
    # Check if PM2 is running
    if pm2 describe elink-staging > /dev/null 2>&1; then
        sudo -u elink pm2 reload elink-staging
    else
        sudo -u elink pm2 start server/index.js --name elink-staging
        sudo -u elink pm2 save
    fi
    
    # Show status
    pm2 status
"

echo ""
echo "╔════════════════════════════════════════════════════════╗"
echo "║              Deployment Complete!                      ║"
echo "╚════════════════════════════════════════════════════════╝"
echo ""
echo "Staging URL: https://$STAGING_HOST"
echo "API Test:    curl https://$STAGING_HOST/api/stations"
echo ""
echo "Check logs:  ssh $STAGING_USER@$STAGING_HOST 'pm2 logs elink-staging'"
echo ""
