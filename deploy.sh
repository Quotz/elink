#!/bin/bash
# eLink Deployment Safety & Rollback Script
# Usage: ./deploy.sh [stable|dev|rollback]

set -e

REPO_URL="https://github.com/quotz/elink.git"
DEPLOY_DIR="/opt/elink"
BACKUP_DIR="/opt/elink-backups"
DB_FILE="data/elink.db"
STATIONS_FILE="data/stations.json"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log() {
    echo -e "${GREEN}[DEPLOY]${NC} $1"
}

warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Create backup of current deployment
backup_current() {
    local backup_name="backup-$(date +%Y%m%d-%H%M%S)"
    local backup_path="$BACKUP_DIR/$backup_name"
    
    log "Creating backup: $backup_name"
    mkdir -p "$backup_path"
    
    if [ -d "$DEPLOY_DIR" ]; then
        # Backup database and stations
        cp "$DEPLOY_DIR/$DB_FILE" "$backup_path/" 2>/dev/null || warn "No database to backup"
        cp "$DEPLOY_DIR/$STATIONS_FILE" "$backup_path/" 2>/dev/null || warn "No stations file to backup"
        
        # Backup current commit hash
        cd "$DEPLOY_DIR"
        git rev-parse HEAD > "$backup_path/commit-hash.txt"
        
        log "Backup created at $backup_path"
        echo "$backup_name" > "$BACKUP_DIR/latest.txt"
    fi
}

# Deploy stable version (v1.0)
deploy_stable() {
    log "Deploying STABLE version (v1.0-stable)..."
    
    backup_current
    
    if [ ! -d "$DEPLOY_DIR" ]; then
        log "Cloning repository..."
        git clone "$REPO_URL" "$DEPLOY_DIR"
    fi
    
    cd "$DEPLOY_DIR"
    
    log "Checking out v1.0-stable..."
    git fetch --tags
    git checkout v1.0-stable
    
    log "Installing dependencies..."
    npm install --production
    
    log "Restarting service..."
    pm2 restart elink || pm2 start server/index.js --name elink
    
    log "✅ Stable version deployed!"
    log "   URL: https://app.elink.mk"
    log "   Version: $(git describe --tags)"
}

# Deploy dev version (v2.0 with auth)
deploy_dev() {
    log "Deploying DEV version (v2.0-dev)..."
    
    backup_current
    
    if [ ! -d "$DEPLOY_DIR" ]; then
        log "Cloning repository..."
        git clone "$REPO_URL" "$DEPLOY_DIR"
    fi
    
    cd "$DEPLOY_DIR"
    
    log "Checking out v2.0-dev..."
    git fetch --tags
    git checkout v2.0-dev
    
    log "Installing dependencies..."
    npm install --production
    
    log "Setting up database..."
    mkdir -p data
    
    log "Restarting service..."
    pm2 restart elink || pm2 start server/index.js --name elink
    
    log "✅ Dev version deployed!"
    log "   URL: https://app.elink.mk"
    log "   Version: $(git describe --tags)"
    log "   New endpoints:"
    log "     - /api/auth/*"
    log "     - /api/verification/*"
    log "     - /api/citrine/*"
}

# Rollback to previous backup
rollback() {
    if [ ! -f "$BACKUP_DIR/latest.txt" ]; then
        error "No backup found to rollback to!"
        exit 1
    fi
    
    local backup_name=$(cat "$BACKUP_DIR/latest.txt")
    local backup_path="$BACKUP_DIR/$backup_name"
    
    log "Rolling back to: $backup_name"
    
    if [ -f "$backup_path/commit-hash.txt" ]; then
        local commit=$(cat "$backup_path/commit-hash.txt")
        cd "$DEPLOY_DIR"
        git checkout "$commit"
        npm install --production
    fi
    
    # Restore database if exists
    if [ -f "$backup_path/elink.db" ]; then
        cp "$backup_path/elink.db" "$DEPLOY_DIR/data/"
        log "Database restored"
    fi
    
    # Restore stations if exists
    if [ -f "$backup_path/stations.json" ]; then
        cp "$backup_path/stations.json" "$DEPLOY_DIR/data/"
        log "Stations restored"
    fi
    
    pm2 restart elink
    
    log "✅ Rollback complete!"
}

# Show status
status() {
    log "Deployment Status"
    log "================="
    
    if [ -d "$DEPLOY_DIR" ]; then
        cd "$DEPLOY_DIR"
        log "Current version: $(git describe --tags 2>/dev/null || git rev-parse --short HEAD)"
        log "Branch: $(git branch --show-current)"
        log "Last commit: $(git log -1 --pretty=format:'%s (%ar)')"
    else
        warn "Not deployed yet"
    fi
    
    log ""
    log "Available backups:"
    ls -1 "$BACKUP_DIR" 2>/dev/null | grep backup- || echo "  None"
    
    log ""
    log "PM2 Status:"
    pm2 status elink 2>/dev/null || warn "Service not running"
}

# Main command handler
case "${1:-status}" in
    stable)
        deploy_stable
        ;;
    dev|develop)
        deploy_dev
        ;;
    rollback)
        rollback
        ;;
    status)
        status
        ;;
    backup)
        backup_current
        ;;
    *)
        echo "Usage: $0 [stable|dev|rollback|status|backup]"
        echo ""
        echo "Commands:"
        echo "  stable   - Deploy v1.0-stable (original version)"
        echo "  dev      - Deploy v2.0-dev (with auth/CitrineOS)"
        echo "  rollback - Rollback to previous backup"
        echo "  status   - Show current deployment status"
        echo "  backup   - Create manual backup"
        exit 1
        ;;
esac
