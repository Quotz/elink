# Technical Context: EV Charging PWA

## Technology Stack

### Backend
- **Runtime**: Node.js 18+
- **Web Framework**: Express 4.18
- **WebSocket Library**: ws 8.16
- **UUID Generation**: uuid 9.0

### Frontend
- **Type**: Vanilla JavaScript (no framework)
- **Maps**: Leaflet.js (CDN)
- **CSS**: Custom mobile-first styles
- **PWA**: Service Worker + Manifest

### Protocol
- **OCPP**: Version 1.6-J (JSON over WebSocket)
- **WebSocket Subprotocol**: `ocpp1.6`

### Deployment
- **Platform**: Railway (https://railway.app)
- **URL**: https://elink-production.up.railway.app/
- **CI/CD**: Auto-deploy on git push to main
- **SSL**: Automatic (Railway managed)

### Development Tools
- **Package Manager**: npm
- **Version Control**: Git + GitHub
- **IDE**: Visual Studio Code
- **Testing**: Manual + custom test script (test-ocpp.js)

## Dependencies

### Production (package.json)
```json
{
  "express": "^4.18.2",    // Web server + REST API
  "ws": "^8.16.0",          // WebSocket server
  "uuid": "^9.0.0"          // Transaction ID generation
}
```

### Frontend (CDN - no build step)
- **Leaflet.js**: Maps and markers
- **Leaflet CSS**: Map styling

## Development Setup

### Prerequisites
- Node.js 18 or higher
- npm (comes with Node.js)
- Git (for deployment)

### Local Development
```bash
# Clone/navigate to project
cd ev-charging-app

# Install dependencies
npm install

# Run server (basic)
npm start
# Server: http://localhost:3000
# OCPP: ws://localhost:3000/ocpp/{id}
# Browser WS: ws://localhost:3000/live

# Run with auto-reload (Node 18+ --watch flag)
npm run dev
```

### Testing OCPP Connection
```bash
# Test local server
node test-ocpp.js ws://localhost:3000/ocpp/001

# Test production server
node test-ocpp.js wss://elink-production.up.railway.app/ocpp/001
```

## Deployment Process

### Railway Setup (Already Complete)
1. Connected GitHub repository
2. Auto-detected Node.js project
3. Automatic `npm install` + `npm start`
4. Generated domain with SSL
5. Auto-deploy on push to main branch

### Deployment Command
```bash
git add .
git commit -m "description"
git push origin main
# Railway auto-deploys in ~30 seconds
```

### Environment
- **PORT**: Set by Railway (auto-injected)
- **No other environment variables needed**

## Technical Constraints

### 1. No Database
- Using in-memory state storage
- All data resets on server restart
- Trade-off: Simplicity vs. persistence

### 2. Free Tier Hosting
- Railway free tier limits
- Server may sleep after inactivity (but stays on WebSocket activity)
- No guaranteed uptime SLA

### 3. WebSocket-Only Communication
- No long-polling fallback
- Requires WebSocket support in charger and browser
- TLS required in production (wss://)

### 4. OCPP 1.6-J Only
- JSON wire format (not SOAP/XML)
- Version 1.6 features only
- No OCPP 2.0.x support

### 5. Single Server Instance
- No horizontal scaling
- No load balancing
- All connections to one process

## Protocol Details

### OCPP 1.6-J Message Format
All messages are JSON arrays:

**CALL** (client → server request):
```json
[2, "unique-id-123", "ActionName", {"payload": "data"}]
```

**CALLRESULT** (server → client response):
```json
[3, "unique-id-123", {"result": "data"}]
```

**CALLERROR** (error response):
```json
[4, "unique-id-123", "ErrorCode", "Error description", {"details": "..."}]
```

### WebSocket Subprotocol Negotiation
OCPP requires specific subprotocol header:

**Client sends**:
```
Sec-WebSocket-Protocol: ocpp1.6
```

**Server must respond**:
```
Sec-WebSocket-Protocol: ocpp1.6
```

### Supported OCPP Operations

**Charger → Server (Handled)**:
- `BootNotification` - Charger startup/registration
- `Heartbeat` - Keep-alive ping
- `StatusNotification` - Connector state changes
- `StartTransaction` - Charging session started
- `StopTransaction` - Charging session ended
- `MeterValues` - Real-time energy readings
- `Authorize` - RFID tag validation

**Server → Charger (Implemented)**:
- `RemoteStartTransaction` - Command charger to start
- `RemoteStopTransaction` - Command charger to stop

## URL Patterns

### Production URLs
- **PWA**: `https://elink-production.up.railway.app/`
- **OCPP WebSocket**: `wss://elink-production.up.railway.app/ocpp/{chargerId}`
- **Browser WebSocket**: `wss://elink-production.up.railway.app/live`
- **REST API**: `https://elink-production.up.railway.app/api/...`

### Charger Configuration
Chargers require URL in format:
```
wss://elink-production.up.railway.app:443/ocpp/
```
Note: Charger appends its UID (e.g., `001`) to make full path `/ocpp/001`

## File Structure
```
ev-charging-app/
├── package.json              # Node.js dependencies and scripts
├── package-lock.json         # Locked dependency versions
├── README.md                 # Project documentation
├── test-ocpp.js             # OCPP connection test tool
├── .gitignore               # Git exclusions
│
├── server/
│   ├── index.js             # Main server entry point
│   │                        #  - Express HTTP server
│   │                        #  - Dual WebSocket servers (OCPP + browser)
│   │                        #  - REST API endpoints
│   │                        #  - WebSocket upgrade handling
│   │
│   ├── ocpp-handler.js      # OCPP message processing
│   │                        #  - Parse OCPP messages
│   │                        #  - Handle all OCPP operations
│   │                        #  - Send commands to chargers
│   │
│   └── store.js             # In-memory data store
│                            #  - Station configuration
│                            #  - Station state
│                            #  - WebSocket connections map
│                            #  - Transaction tracking
│
├── public/                  # Static files served by Express
│   ├── index.html          # PWA shell
│   ├── app.js              # Frontend JavaScript
│   ├── style.css           # Mobile-first styles
│   ├── manifest.json       # PWA manifest
│   └── sw.js               # Service worker
│
└── memory-bank/            # Cline Memory Bank
    ├── projectbrief.md
    ├── productContext.md
    ├── techContext.md      # ← This file
    ├── systemPatterns.md
    ├── activeContext.md
    └── progress.md
```

## Development Patterns

### Hot Reload
Node.js 18+ supports `--watch` flag:
```json
"dev": "node --watch server/index.js"
```
Server auto-restarts on file changes.

### Logging Strategy
Console logging with prefixes:
- `[OCPP]` - Charger communication
- `[Browser]` - PWA client communication
- `[WS]` - WebSocket upgrade events
- No prefix - Express/HTTP logs

### Error Handling
- Try-catch on JSON parse
- WebSocket error event listeners
- HTTP 400/404/500 responses
- Console.error for server issues

### State Management
Centralized in `server/store.js`:
- Stations array
- Charger WebSocket connections (chargerId → ws object)
- Active transactions
- All access through store functions

## Browser Compatibility

### Required Features
- WebSocket API
- ES6+ JavaScript
- CSS Grid/Flexbox
- Service Worker (optional, for PWA features)
- Geolocation API (optional, for map centering)

### Tested On
- Chrome/Edge (Chromium)
- iOS Safari
- Android Chrome

## Known Technical Limitations

1. **In-Memory State**: Server restart loses all state
2. **No Reconnection**: Chargers must reconnect manually if server restarts
3. **No Message Queue**: Messages lost if recipient disconnected
4. **Single Connector**: Assumes one connector per charger
5. **No Authentication**: Any charger with correct path can connect
6. **No Rate Limiting**: No protection against message flooding
7. **No Message Validation**: Minimal OCPP schema validation

These are acceptable for demo purposes but would need addressing for production use.
