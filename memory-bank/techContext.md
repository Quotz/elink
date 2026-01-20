# Technical Context: EV Charging PWA

## Technology Stack

### Backend
- **Runtime**: Node.js 18+
- **Web Framework**: Express 4.18
- **WebSocket Library**: ws 8.16
- **UUID Generation**: uuid 9.0
- **State Management**: In-memory (enhanced with connection health tracking)

### Frontend
- **Type**: Vanilla JavaScript (no framework)
- **Maps**: Leaflet.js (CDN)
- **CSS**: Custom mobile-first styles
- **PWA**: Service Worker + Manifest
- **Admin Panel**: Separate HTML/JS for diagnostics (NEW)

### Protocol
- **OCPP**: Version 1.6-J (JSON over WebSocket)
- **WebSocket Subprotocol**: `ocpp1.6`

### Deployment
- **Platform**: Railway (https://railway.app)
- **URL**: https://elink-production.up.railway.app/
- **CI/CD**: Auto-deploy on git push to main
- **SSL**: Automatic (Railway managed)
- **Status**: Production-ready, both chargers connected

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
  "ws": "^8.16.0",          // WebSocket server (dual architecture)
  "uuid": "^9.0.0"          // Transaction ID + OCPP message ID generation
}
```

**Note**: Minimal dependencies by design - no database, no framework, no build tools

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
# Admin: http://localhost:3000/admin.html

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
- **NEW: Enhanced with connection health, session history, meter history**

### 2. Free Tier Hosting
- Railway free tier limits
- Server may sleep after inactivity (but stays on WebSocket activity)
- No guaranteed uptime SLA
- **NOTE: WebSocket activity keeps server alive**

### 3. WebSocket-Only Communication
- No long-polling fallback
- Requires WebSocket support in charger and browser
- TLS required in production (wss://)
- **NEW: Timeout detection compensates for dropped connections**

### 4. OCPP 1.6-J Only
- JSON wire format (not SOAP/XML)
- Version 1.6 features only
- No OCPP 2.0.x support
- **NEW: 11 OCPP commands implemented via ocpp-commands.js**

### 5. Single Server Instance
- No horizontal scaling
- No load balancing
- All connections to one process
- **NOTE: Sufficient for demo with 2 chargers**

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
- `Heartbeat` - Keep-alive ping (triggers activity tracking)
- `StatusNotification` - Connector state changes
- `StartTransaction` - Charging session started
- `StopTransaction` - Charging session ended
- `MeterValues` - Real-time energy readings (voltage, current, temp, SoC, power, energy)
- `Authorize` - RFID tag validation
- **NEW: All messages update charger activity timestamp**

**Server → Charger (Implemented)**:
- `RemoteStartTransaction` - Command charger to start
- `RemoteStopTransaction` - Command charger to stop
- **NEW: 11 Additional Commands via ocpp-commands.js module**:
  - `GetConfiguration` - Request charger configuration
  - `ChangeConfiguration` - Modify charger settings
  - `TriggerMessage` - Force specific message from charger
  - `GetDiagnostics` - Request diagnostic logs
  - `Reset` - Soft/hard reset charger
  - `UnlockConnector` - Unlock stuck connector
  - `UpdateFirmware` - Push firmware updates
  - `SetChargingProfile` - Smart charging profiles
  - `ClearChargingProfile` - Remove charging limits
  - `ReserveNow` - Reserve charger for user
  - `CancelReservation` - Cancel reservation

## URL Patterns

### Production URLs
- **User PWA**: `https://elink-production.up.railway.app/`
- **Admin Panel**: `https://elink-production.up.railway.app/admin.html` (NEW)
- **OCPP WebSocket**: `wss://elink-production.up.railway.app/ocpp/{chargerId}`
- **Browser WebSocket**: `wss://elink-production.up.railway.app/live`
- **REST API**: `https://elink-production.up.railway.app/api/...`

### Charger Configuration
Chargers require URL in format:
```
wss://elink-production.up.railway.app:443/ocpp/
```
Note: Charger appends its UID (e.g., `001`) to make full path `/ocpp/001`

## REST API Endpoints

### Core Endpoints (Original)
- `GET /api/stations` - List all stations with current state
- `GET /api/stations/:id` - Get specific station details
- `POST /api/stations/:id/start` - Initiate charging session (with idTag)
- `POST /api/stations/:id/stop` - End charging session (with transactionId)
- `POST /api/payment/process` - Mock payment processing

### Enhanced Endpoints (NEW - Phase 2)
- `GET /api/stations/:id/configuration` - Request and retrieve charger config
- `POST /api/stations/:id/trigger` - Trigger specific OCPP message
  - Body: `{ "message": "StatusNotification", "connectorId": 1 }`
- `POST /api/stations/:id/configure` - Change charger configuration
  - Body: `{ "key": "HeartbeatInterval", "value": "10" }`
- `GET /api/stations/:id/diagnostics` - Get stored diagnostics data
- `POST /api/stations/:id/reset` - Reset charger
  - Body: `{ "type": "Soft" }` or `{ "type": "Hard" }`
- `POST /api/stations/:id/unlock` - Unlock connector
  - Body: `{ "connectorId": 1 }`
- `GET /api/stations/:id/sessions` - Get session history (last 50)

### Error Responses
- `404` - Station not found
- `400` - Station offline or invalid request
- `500` - Internal server error

## File Structure
```
ev-charging-app/
├── package.json              # Node.js dependencies and scripts
├── package-lock.json         # Locked dependency versions
├── README.md                 # Project documentation
├── IMPLEMENTATION_SUMMARY.md # Phase 1 & 2 details (NEW)
├── test-ocpp.js             # OCPP connection test tool
├── .gitignore               # Git exclusions
│
├── server/
│   ├── index.js             # Main server entry point
│   │                        #  - Express HTTP server
│   │                        #  - Dual WebSocket servers (OCPP + browser)
│   │                        #  - REST API endpoints (13 total)
│   │                        #  - WebSocket upgrade handling
│   │                        #  - Timeout monitoring loop (NEW)
│   │
│   ├── ocpp-handler.js      # OCPP message processing
│   │                        #  - Parse OCPP messages
│   │                        #  - Handle all OCPP operations
│   │                        #  - Send commands to chargers
│   │                        #  - Heartbeat activity tracking (NEW)
│   │                        #  - Session history storage (NEW)
│   │                        #  - Meter history storage (NEW)
│   │
│   ├── ocpp-commands.js     # OCPP command builders (NEW)
│   │                        #  - 11 OCPP command generators
│   │                        #  - Consistent message ID generation
│   │                        #  - Clean, reusable interface
│   │
│   └── store.js             # Enhanced in-memory data store
│                            #  - Station configuration
│                            #  - Station state + connection health (NEW)
│                            #  - WebSocket connections map
│                            #  - Transaction tracking
│                            #  - Session history (last 50) (NEW)
│                            #  - Meter history (last 100) (NEW)
│                            #  - Configuration storage (NEW)
│                            #  - Diagnostics data (NEW)
│
├── public/                  # Static files served by Express
│   ├── index.html          # User PWA shell
│   ├── app.js              # User frontend JavaScript
│   ├── admin.html          # Admin dashboard (NEW)
│   ├── admin.js            # Admin diagnostics logic (NEW)
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
- `[Timeout Monitor]` - Timeout detection events (NEW)
- No prefix - Express/HTTP logs

### Error Handling
- Try-catch on JSON parse
- WebSocket error event listeners
- HTTP 400/404/500 responses
- Console.error for server issues
- **NEW: Resilient timeout monitoring (continues even if one check fails)**

### State Management
Centralized in `server/store.js`:
- Stations object (keyed by ID)
- Charger WebSocket connections (chargerId → ws object)
- Active transactions
- **NEW: Connection health metrics (lastHeartbeat, messageCount, connectedAt)**
- **NEW: Session history (last 50 per charger)**
- **NEW: Meter history (last 100 readings per charger)**
- **NEW: Configuration and capabilities storage**
- All access through store functions

## Connection Health Monitoring (NEW - Phase 1)

### Heartbeat Tracking
- **Trigger**: Every OCPP message (not just Heartbeat)
- **Updates**: `lastHeartbeat` timestamp, `messageCount`, `connected` status
- **Function**: `updateChargerActivity(chargerId)` in ocpp-handler.js
- **Purpose**: Track real-time activity for accurate status display

### Timeout Detection
- **Interval**: Checks every 30 seconds
- **Threshold**: 40 seconds (4x typical 10-second heartbeat)
- **Action**: Marks charger offline if no message in last 40 seconds
- **Location**: Timeout monitor loop in server/index.js
- **Logging**: `[Timeout Monitor] Charger XXX timed out`

### Activity Display
- **User UI**: Shows "Active" or last seen time
- **Admin UI**: Show "● Active now" or "15s ago"
- **Calculation**: `Date.now() - station.lastHeartbeat`

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
- **NEW: Admin panel tested on desktop browsers**

## Performance Characteristics

### Response Times (Measured)
- **Server startup**: <1 second
- **WebSocket connection**: <50ms (local), 100-300ms (production)
- **REST API**: <10ms (local), 100-200ms (production)
- **PWA load time**: <2 seconds (with map)
- **Admin panel load**: <1 second
- **Broadcast update**: <10ms (2 stations)

### Heartbeat & Timeout
- **Heartbeat interval**: 10 seconds (charger configured)
- **Timeout threshold**: 40 seconds (4x heartbeat)
- **Check frequency**: 30 seconds
- **False positive rate**: Near zero (lenient threshold)

### Memory Usage
- **Base server**: ~50MB
- **Per connection**: ~1MB
- **Session history**: ~10KB per charger (50 sessions)
- **Meter history**: ~20KB per charger (100 readings)
- **Total**: <100MB for 2 chargers with full history

## Known Technical Limitations

1. **In-Memory State**: Server restart loses all state
   - Session history lost
   - Meter history lost
   - Active transactions lost
   - **Mitigation**: Keep server running during demo

2. **No Reconnection Logic**: Chargers must reconnect manually if server restarts
   - **Mitigation**: Chargers typically auto-reconnect
   - **Workaround**: Restart charger if needed

3. **No Message Queue**: Messages lost if recipient disconnected
   - **Mitigation**: Timeout detection + reconnection
   - **Acceptable**: For demo with reliable network

4. **Single Connector**: Assumes one connector per charger
   - **Justification**: Actual hardware has one connector
   - **Impact**: Would need modification for multi-connector stations

5. **No Authentication**: Any charger with correct path can connect
   - **Justification**: Closed demo network
   - **Production need**: Add TLS client certificates or API keys

6. **No Rate Limiting**: No protection against message flooding
   - **Risk**: Low (known hardware on trusted network)
   - **Production need**: Add rate limiting middleware

7. **No Message Validation**: Minimal OCPP schema validation
   - **Trust**: Assumes chargers send valid OCPP messages
   - **Production need**: Add JSON schema validation

8. **Broadcast to All**: Full state sent to all clients on any change
   - **Scalability**: Doesn't scale beyond ~10 stations
   - **Acceptable**: Demo has 2 stations

9. **Auto-Pruning Memory**: Old sessions (>50) and meter data (>100) discarded
   - **Justification**: Bounded memory without database
   - **Acceptable**: Enough history for demo purposes

These are acceptable for demo purposes but would need addressing for production use.

## Security Considerations (Demo Context)

**Current State**: Minimal security (acceptable for closed demo)

**What's NOT Implemented** (would need for production):
- Authentication on OCPP connections
- Authorization on REST endpoints
- Input validation on OCPP messages
- Rate limiting
- TLS client certificates
- CORS restrictions
- Admin panel authentication
- API key management
- SQL injection prevention (N/A - no database)
- XSS protection (minimal - no user input stored)

**Justification**: Private demo on trusted network with known hardware. Priority is functional demonstration over security hardening.

## Monitoring & Diagnostics (NEW)

### Admin Panel Features
- **URL**: `/admin.html`
- **Real-time Updates**: Via `/live` WebSocket
- **Metrics Displayed**:
  - Connection status (● Active / Offline)
  - Last heartbeat (timestamp or "Xs ago")
  - Uptime (hours/minutes since connection)
  - Message count (total OCPP messages)
  - Firmware version (if available)
  - Serial number (if available)
  - Configuration keys/values
  - Session history (last 50)
  - Meter readings

### Console Logging
- `[OCPP]` - All OCPP message activity
- `[Timeout Monitor]` - Timeout detection events
- `[Browser]` - Browser client WebSocket events
- `[WS]` - WebSocket upgrade routing

### Health Indicators
- Heartbeat regularity (~10s intervals)
- Message count incrementing
- No timeout warnings
- Browser WebSocket stable
- Railway uptime statistics

## Extensibility

### Easy to Add (No Architecture Changes)
- New OCPP commands (add to ocpp-commands.js)
- New OCPP message handlers (add case to ocpp-handler.js switch)
- New REST endpoints (add to server/index.js)
- New station fields (update store.js defaults)
- New admin panel sections (modify admin.html/js)
- Additional meter value types (update MeterValues handler)

### Moderate Effort (Some Refactoring)
- Database persistence (replace store.js with DB layer)
- Response tracking for OCPP commands (add pending requests map)
- Multi-connector support (update store schema, handler logic)
- WebSocket reconnection logic (add reconnection handler)
- Selective broadcasts (add client subscriptions)

### Major Changes (Architecture Redesign)
- Authentication system (add middleware, sessions, tokens)
- Multi-tenant support (add organization context to all operations)
- Horizontal scaling (need message bus like Redis, shared state)
- OCPP 2.0+ support (different message format, new features)
- Production-grade error recovery (circuit breakers, retries, fallbacks)

## Testing Strategy

### Manual Testing (Completed)
- Local development server startup
- OCPP WebSocket connection (both chargers)
- Browser WebSocket connection
- REST API endpoints (all 13)
- Payment flow (mock)
- Remote start/stop commands
- Real-time meter updates
- Timeout detection (disconnect charger, wait 40s)
- Admin panel real-time updates
- Session history accuracy
- Multiple browser clients simultaneously

### Test Script (test-ocpp.js)
```bash
# Connect to server as OCPP client
node test-ocpp.js wss://elink-production.up.railway.app/ocpp/001

# Validates:
# - WebSocket connection
# - Subprotocol negotiation
# - BootNotification exchange
# - Heartbeat response
# - Message format
```

### Integration Testing (Completed)
- Full end-to-end charging flow (multiple times)
- Charger reconnection after network drop
- Timeout detection accuracy
- Admin panel diagnostics
- Session history persistence
- Cost calculation correctness

### Performance Testing (Informal)
- Multiple simultaneous users (5+ browser clients)
- Long-running sessions (hours)
- Memory leak testing (extended operation)
- WebSocket stability (overnight connections)

## Production Readiness

### Demo Context: ✅ READY
- Core functionality: Complete
- Real hardware integration: Working
- Connection monitoring: Robust
- Admin diagnostics: Professional
- Stability: Excellent (no crashes)
- Documentation: Comprehensive

### Production Context: ⚠️ NEEDS WORK
Would require:
- Database for persistence
- Authentication/authorization
- Input validation & sanitization
- Rate limiting
- Error recovery & circuit breakers
- Logging infrastructure (not just console)
- Monitoring/alerting system
- Load balancing & scaling
- Backup & disaster recovery
- Security hardening
- Performance optimization
- Comprehensive test suite

**Current Status**: Exceeds demo requirements, foundation for production system

## Version History

- **v1.0**: Initial implementation (basic OCPP + PWA)
- **v1.1**: Subprotocol negotiation fixes
- **v1.2**: Station ID format updates
- **v2.0**: Phase 1 - Heartbeat tracking + timeout detection (CONNECTION HEALTH)
- **v2.1**: Phase 2 - OCPP commands module + admin panel + enhanced data collection (CURRENT)

**Live Version**: v2.1 (production-ready for demo)
