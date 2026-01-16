#!/bin/bash
#
# EV Charging OCPP Server - Automated VPS Setup
# 
# USAGE: 
#   curl -sSL https://raw.githubusercontent.com/Quotz/elink/main/setup-vps.sh | bash -s YOUR_DOMAIN YOUR_EMAIL
#
# EXAMPLE:
#   curl -sSL https://raw.githubusercontent.com/Quotz/elink/main/setup-vps.sh | bash -s ocpp.fankeeps.com admin@fankeeps.com
#

set -e

DOMAIN="${1:-}"
EMAIL="${2:-}"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}"
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║       EV Charging OCPP Server - Automated Setup              ║"
echo "║       Compatible with older embedded devices (secp384r1)     ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# Check arguments
if [ -z "$DOMAIN" ] || [ -z "$EMAIL" ]; then
    echo -e "${RED}ERROR: Missing required arguments${NC}"
    echo ""
    echo "Usage: $0 <domain> <email>"
    echo "Example: $0 ocpp.fankeeps.com admin@fankeeps.com"
    echo ""
    echo "Make sure your domain's DNS is already pointing to this server's IP!"
    exit 1
fi

# Get server IP
SERVER_IP=$(curl -s ifconfig.me)
echo -e "${YELLOW}Server IP: $SERVER_IP${NC}"
echo -e "${YELLOW}Domain: $DOMAIN${NC}"
echo -e "${YELLOW}Email: $EMAIL${NC}"
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    echo -e "${RED}Please run as root (use sudo)${NC}"
    exit 1
fi

echo -e "${GREEN}[1/7] Updating system...${NC}"
apt update && apt upgrade -y

echo -e "${GREEN}[2/7] Installing Node.js 20 and dependencies...${NC}"
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs nginx certbot git

echo -e "${GREEN}[3/7] Cloning repository...${NC}"
mkdir -p /var/www/ev-charging-app
cd /var/www/ev-charging-app
if [ -d ".git" ]; then
    git pull origin main
else
    git clone https://github.com/Quotz/elink.git .
fi
npm install

echo -e "${GREEN}[4/7] Creating systemd service...${NC}"
cat > /etc/systemd/system/ev-charging.service << 'EOF'
[Unit]
Description=EV Charging OCPP Server
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/var/www/ev-charging-app
ExecStart=/usr/bin/node server/index.js
Restart=on-failure
RestartSec=10
Environment=PORT=3000
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF

chown -R www-data:www-data /var/www/ev-charging-app
systemctl daemon-reload
systemctl enable ev-charging
systemctl start ev-charging

echo -e "${GREEN}[5/7] Getting SSL certificate...${NC}"
systemctl stop nginx 2>/dev/null || true
certbot certonly --standalone -d "$DOMAIN" --agree-tos --email "$EMAIL" --non-interactive

echo -e "${GREEN}[6/7] Configuring nginx with TLS secp384r1 curve...${NC}"
cat > /etc/nginx/sites-available/ev-charging << EOF
# HTTP -> HTTPS redirect
server {
    listen 80;
    server_name $DOMAIN;
    return 301 https://\$server_name\$request_uri;
}

# HTTPS server with secp384r1 curve for embedded device compatibility
server {
    listen 443 ssl http2;
    server_name $DOMAIN;

    # SSL Certificate
    ssl_certificate /etc/letsencrypt/live/$DOMAIN/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/$DOMAIN/privkey.pem;

    # TLS Configuration - Compatible with older embedded devices!
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ecdh_curve secp384r1:secp256r1:prime256v1;
    ssl_ciphers 'ECDHE-RSA-AES256-GCM-SHA384:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-RSA-AES256-SHA384:DHE-RSA-AES256-GCM-SHA384';
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    # WebSocket locations for OCPP (both cases)
    location ~ ^/(OCPP|ocpp)(/.*)?$ {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 86400;
        proxy_send_timeout 86400;
    }

    # All other requests
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOF

ln -sf /etc/nginx/sites-available/ev-charging /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

nginx -t
systemctl start nginx
systemctl enable nginx

echo -e "${GREEN}[7/7] Setting up auto-renewal for SSL certificate...${NC}"
(crontab -l 2>/dev/null; echo "0 3 * * * certbot renew --quiet --post-hook 'systemctl reload nginx'") | crontab -

echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║                    SETUP COMPLETE!                           ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "Your OCPP server is now running at: ${YELLOW}wss://$DOMAIN${NC}"
echo ""
echo -e "${YELLOW}CHARGER CONFIGURATION:${NC}"
echo -e "┌─────────────────────────┬──────────────────────────────────┐"
echo -e "│ WebServer Address       │ wss://$DOMAIN:443/OCPP           │"
echo -e "│ UID                     │ 001                              │"
echo -e "└─────────────────────────┴──────────────────────────────────┘"
echo ""
echo -e "${YELLOW}USEFUL COMMANDS:${NC}"
echo "  View app logs:      journalctl -u ev-charging -f"
echo "  Restart app:        systemctl restart ev-charging"
echo "  View nginx logs:    tail -f /var/log/nginx/error.log"
echo "  Update from GitHub: cd /var/www/ev-charging-app && git pull && npm install && systemctl restart ev-charging"
echo ""
echo -e "${GREEN}Verify TLS curve (should show secp384r1):${NC}"
echo "  openssl s_client -connect $DOMAIN:443 -tls1_2 2>&1 | grep 'Server Temp Key'"
echo ""
