#!/bin/bash
# Setup Hetzner VPS for eLink Staging
# Run this on the fresh Hetzner VPS as root

set -e

echo "╔════════════════════════════════════════════════════════╗"
echo "║     eLink Staging Server Setup - Hetzner VPS          ║"
echo "╚════════════════════════════════════════════════════════╝"
echo ""

# Configuration
DOMAIN="staging.elink.mk"
APP_DIR="/opt/elink-staging"
USER="elink"

# Update system
echo "[1/8] Updating system packages..."
apt update && apt upgrade -y

# Install dependencies
echo "[2/8] Installing dependencies..."
apt install -y curl wget git nginx certbot python3-certbot-nginx ufw

# Create user
echo "[3/8] Creating elink user..."
if ! id "$USER" &>/dev/null; then
    useradd -m -s /bin/bash $USER
    usermod -aG sudo $USER
fi

# Install Node.js
echo "[4/8] Installing Node.js 20..."
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# Install PM2
echo "[5/8] Installing PM2..."
npm install -g pm2

# Setup firewall
echo "[6/8] Configuring firewall..."
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
ufw allow http
ufw allow https
ufw --force enable

# Setup app directory
echo "[7/8] Setting up application directory..."
mkdir -p $APP_DIR
chown $USER:$USER $APP_DIR

# Clone repository
echo "[8/8] Cloning eLink repository..."
cd $APP_DIR
sudo -u $USER git clone https://github.com/quotz/elink.git .
sudo -u $USER git checkout v2.0-dev
sudo -u $USER npm install

# Create environment file
cat > $APP_DIR/.env << EOF
NODE_ENV=staging
PORT=3000
JWT_SECRET=$(openssl rand -base64 32)
CITRINEOS_URL=
CITRINEOS_API_KEY=
EOF
chown $USER:$USER $APP_DIR/.env

echo ""
echo "╔════════════════════════════════════════════════════════╗"
echo "║              Setup Complete! Next Steps:               ║"
echo "╚════════════════════════════════════════════════════════╝"
echo ""
echo "1. Configure DNS:"
echo "   Add A record: $DOMAIN → $(curl -s ifconfig.me)"
echo ""
echo "2. Configure Nginx:"
echo "   sudo nano /etc/nginx/sites-available/$DOMAIN"
echo "   (Copy config from nginx/staging.conf)"
echo ""
echo "3. Get SSL certificate:"
echo "   sudo certbot --nginx -d $DOMAIN"
echo ""
echo "4. Start application:"
echo "   cd $APP_DIR && sudo -u $USER npm start"
echo "   OR"
echo "   cd $APP_DIR && sudo -u $USER pm2 start server/index.js --name elink-staging"
echo ""
echo "5. Check status:"
echo "   pm2 status"
echo "   pm2 logs elink-staging"
echo ""
