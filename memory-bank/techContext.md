# Tech Context: eLink

## Technology Stack

### Backend
| Technology | Version | Purpose |
|------------|---------|---------|
| Node.js | 18+ | Runtime |
| Express | 4.18 | Web framework |
| SQLite3 | 5.1 | Database |
| WebSocket (ws) | 8.16 | Real-time communication |
| JWT (jsonwebtoken) | 9.0 | Authentication |
| bcryptjs | 2.4 | Password hashing |
| axios | 1.6 | HTTP client for CitrineOS |

### Frontend
| Technology | Purpose |
|------------|---------|
| Vanilla JS | No framework (keep it simple) |
| Leaflet | Map display |
| Chart.js | Analytics (future) |
| PWA APIs | Service worker, manifest |

### Infrastructure
| Technology | Purpose |
|------------|---------|
| PM2 | Process management |
| Nginx | Reverse proxy, SSL |
| SQLite | Data persistence |
| GitHub | Source control |

## Development Setup

### Prerequisites
```bash
# Node.js 18+
node --version  # v18.0.0 or higher

# Git
git --version
```

### Installation
```bash
git clone https://github.com/quotz/elink.git
cd elink
npm install
```

### Environment Configuration
```bash
# Create .env file
cat > .env << EOF
JWT_SECRET=$(openssl rand -base64 32)
PORT=3000
NODE_ENV=development
EOF
```

### Running Locally
```bash
# Development (auto-reload on file changes)
npm run dev

# Production
npm start
```

### Testing
```bash
# Syntax check
node -c server/index.js

# Test auth endpoints
./test-auth.sh

# Manual API test
curl http://localhost:3000/api/stations
```

## API Endpoints

### Authentication
```
POST /api/auth/register
Body: {email, password, phone?, firstName?, lastName?, role?}
Response: {user, accessToken, refreshToken}

POST /api/auth/login
Body: {email, password}
Response: {user, accessToken, refreshToken}

POST /api/auth/refresh
Body: {refreshToken}
Response: {accessToken, refreshToken}

POST /api/auth/logout
Body: {refreshToken}
Response: {message}

GET /api/auth/verify-email?token=xxx
Response: {message}

POST /api/auth/forgot-password
Body: {email}
Response: {message}

POST /api/auth/reset-password
Body: {token, newPassword}
Response: {message}

GET /api/auth/me
Headers: Authorization: Bearer {token}
Response: {user}
```

### Stations
```
GET /api/stations
Response: [{id, name, status, connected, ...}]

GET /api/stations/:id
Response: {id, name, status, ...}

POST /api/stations/:id/start
Headers: Authorization: Bearer {token} (optional)
Body: {idTag?}
Response: {status, message}

POST /api/stations/:id/stop
Headers: Authorization: Bearer {token} (optional)
Response: {status, message}
```

### Verification (Owner)
```
POST /api/verification/submit-charger
Headers: Authorization: Bearer {token}
Body: {chargerId, serialNumber, manufacturer?, model?, installationAddress, electricalCertUrl?, ownershipProofUrl?}
Response: {verification}

GET /api/verification/my-chargers
Headers: Authorization: Bearer {token}
Response: {chargers}

GET /api/verification/status/:chargerId
Headers: Authorization: Bearer {token}
Response: {status, submittedAt, ...}
```

### Admin
```
GET /api/verification/admin/pending
Headers: Authorization: Bearer {token}
Role: admin
Response: {verifications}

POST /api/verification/admin/review
Headers: Authorization: Bearer {token}
Role: admin
Body: {verificationId, status: 'approved'|'rejected', rejectionReason?, notes?}
Response: {message}
```

### CitrineOS
```
GET /api/citrine/health
Response: {available, status|error}

POST /api/citrine/stations/:id/sync
Headers: Authorization: Bearer {token}
Response: {success, citrineId}

POST /api/citrine/stations/:id/remote-start
Headers: Authorization: Bearer {token}
Body: {connectorId?, idTag?}
Response: {result}

POST /api/citrine/stations/:id/remote-stop
Headers: Authorization: Bearer {token}
Body: {transactionId}
Response: {result}
```

## WebSocket Protocols

### OCPP 1.6-J
```
Endpoint: ws://host/ocpp/{chargerId}
Protocol: ocpp1.6

Messages:
- BootNotification
- Heartbeat
- StatusNotification
- StartTransaction
- StopTransaction
- MeterValues
- RemoteStartTransaction (server→charger)
- RemoteStopTransaction (server→charger)
```

### Browser Live Updates
```
Endpoint: ws://host/live
Protocol: (none)

Messages:
- {type: 'init', stations: [...]}
- {type: 'update', stations: [...]}
```

## Dependencies

### Production
```json
{
  "express": "^4.18.2",
  "ws": "^8.16.0",
  "uuid": "^9.0.0",
  "bcryptjs": "^2.4.3",
  "jsonwebtoken": "^9.0.0",
  "sqlite3": "^5.1.6",
  "axios": "^1.6.0"
}
```

### Development
```json
{
  "nodemon": "^3.0.0"  // optional, npm run dev uses node --watch
}
```

## File Structure

```
elink/
├── server/
│   ├── index.js              # Express + WebSocket servers
│   ├── database.js           # SQLite interface
│   ├── auth.js               # JWT middleware
│   ├── store.js              # In-memory station state
│   ├── ocpp-handler.js       # OCPP message processing
│   ├── ocpp-commands.js      # OCPP command helpers
│   ├── citrine-client.js     # CitrineOS REST client
│   └── routes/
│       ├── auth.js           # Auth endpoints
│       ├── verification.js   # Verification endpoints
│       └── citrine.js        # CitrineOS endpoints
├── public/                   # Static assets (PWA)
├── data/                     # SQLite DB (gitignored)
├── memory-bank/              # Project context docs
├── docs/
│   ├── history/              # Legacy docs
│   └── PRD_SYSTEM.md         # CLEAR-based PRD generation
├── scripts/
│   ├── deploy-staging.sh     # Staging deployment
│   ├── prd-gen.sh            # PRD generator
│   ├── spawn-from-prd.sh     # Agent spawner
│   ├── test-e2e.sh           # E2E testing
│   └── setup-hetzner.sh      # VPS provisioning
├── deploy.sh                 # Deployment script
└── package.json
```

## Tool Usage Patterns

### Git
```bash
# Feature workflow
git checkout -b feature/name
# ... work ...
git commit -m "feat: description"
git push origin feature/name
# ... PR/merge ...
```

### Deployment
```bash
# Via deploy script
./deploy.sh dev      # Deploy v2.0
./deploy.sh stable   # Deploy v1.0
./deploy.sh rollback # Emergency

# Manual (not recommended)
pm2 restart elink
```

### Database
```bash
# SQLite CLI
sqlite3 data/elink.db
.tables
SELECT * FROM users;
.schema users
```
