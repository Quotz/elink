# VPS Setup Guide for EV Charging OCPP Server

This guide sets up your OCPP server on a VPS with nginx configured to use older TLS curves (secp384r1) for compatibility with embedded devices like EVpoint chargers.

## 1. Get a VPS

**Recommended providers:**
- **Hetzner Cloud**: ~€3.79/month for CX11 (cheapest)
- **DigitalOcean**: $4/month for Basic Droplet
- **Oracle Cloud**: Free tier (always free, 1GB RAM)
- **Linode**: $5/month

Choose **Ubuntu 22.04 LTS** as the OS.

## 2. Connect to your VPS

```bash
ssh root@YOUR_VPS_IP
```

## 3. Run the Setup Script

Copy and run this entire block:

```bash
# Update system
apt update && apt upgrade -y

# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs nginx certbot python3-certbot-nginx git

# Create app directory
mkdir -p /var/www/ev-charging-app
cd /var/www/ev-charging-app

# Clone your repository
git clone https://github.com/Quotz/elink.git .

# Install dependencies
npm install

# Create systemd service for the app
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
Environment=PORT=3000
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF

# Set permissions
chown -R www-data:www-data /var/www/ev-charging-app

# Enable and start the service
systemctl daemon-reload
systemctl enable ev-charging
systemctl start ev-charging

echo "Node.js app is running!"
```

## 4. Configure Domain DNS

Point your domain (e.g., `ocpp.fankeeps.com`) to your VPS IP address:
- Type: A Record
- Name: ocpp (or whatever subdomain)
- Value: YOUR_VPS_IP
- TTL: 300

## 5. Configure Nginx with TLS (IMPORTANT - This fixes the curve issue!)

Replace `YOUR_DOMAIN` with your actual domain (e.g., `ocpp.fankeeps.com`):

```bash
# Set your domain
DOMAIN="ocpp.fankeeps.com"

# Create nginx config with special TLS settings for older devices
cat > /etc/nginx/sites-available/ev-charging << EOF
server {
    listen 80;
    server_name $DOMAIN;
    return 301 https://\$server_name\$request_uri;
}

server {
    listen 443 ssl http2;
    server_name $DOMAIN;

    # SSL Certificate (will be added by certbot)
    ssl_certificate /etc/letsencrypt/live/$DOMAIN/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/$DOMAIN/privkey.pem;

    # TLS Configuration - Compatible with older embedded devices!
    ssl_protocols TLSv1.2 TLSv1.3;
    
    # Use NIST curves (secp384r1) instead of X25519
    ssl_ecdh_curve secp384r1:secp256r1:prime256v1;
    
    # Cipher suites that work with older devices
    ssl_ciphers 'ECDHE-RSA-AES256-GCM-SHA384:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-RSA-AES256-SHA384:DHE-RSA-AES256-GCM-SHA384';
    ssl_prefer_server_ciphers on;

    # WebSocket proxy for OCPP
    location /OCPP {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 86400;
    }

    location /ocpp {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 86400;
    }

    # Proxy all other requests
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

# Enable site
ln -sf /etc/nginx/sites-available/ev-charging /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# Test nginx config
nginx -t

echo "Nginx configured! Now get SSL certificate..."
```

## 6. Get SSL Certificate

```bash
# Stop nginx temporarily
systemctl stop nginx

# Get certificate
certbot certonly --standalone -d YOUR_DOMAIN --agree-tos --email your@email.com

# Start nginx
systemctl start nginx

# Set up auto-renewal
certbot renew --dry-run
```

## 7. Verify TLS Configuration

From your local machine, verify the TLS is using secp384r1:

```bash
openssl s_client -connect YOUR_DOMAIN:443 -servername YOUR_DOMAIN -tls1_2 2>&1 | grep "Server Temp Key"
```

Should output:
```
Server Temp Key: ECDH, secp384r1, 384 bits
```

## 8. Configure Charger

| Field | Value |
|-------|-------|
| WebServer Address | `wss://YOUR_DOMAIN:443/OCPP` |
| UID | `001` |

## Troubleshooting

### Check if app is running:
```bash
systemctl status ev-charging
journalctl -u ev-charging -f  # View logs
```

### Check nginx logs:
```bash
tail -f /var/log/nginx/error.log
tail -f /var/log/nginx/access.log
```

### Restart services:
```bash
systemctl restart ev-charging
systemctl restart nginx
```

### Update code from GitHub:
```bash
cd /var/www/ev-charging-app
git pull origin main
npm install
systemctl restart ev-charging
```
