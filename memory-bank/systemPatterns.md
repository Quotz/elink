# System Patterns: EV Charging PWA Architecture

## System Architecture

### High-Level Overview
```
┌─────────────────────────────────────────────────────────┐
│                    Mobile Browser                       │
│  ┌──────────────────────────────────────────────────┐  │
│  │              PWA (public/*)                      │  │
│  │  - index.html (User UI shell)                    │  │
│  │  - app.js (map, payment, charging UI logic)     │  │
│  │  - admin.html (Admin dashboard) [NEW]           │  │
│  │  - admin.js (diagnostics UI logic) [NEW]        │  │
│  │  - style.css (mobile-first responsive)          │  │
│  └──────────────────────────────────────────────────┘  │
│           │ REST API (fetch)       │ WebSocket         │
│           ↓                         ↓ /live             │
└───────────┼─────────────────────────┼──────────────────┘
            │                         │
┌───────────┼─────────────────────────┼──────────────────┐
│           │    server/index.js      │                  │
│           ↓                         ↓                  │
│  ┌─────────────────┐    ┌──────────────────────┐     │
│  │  Express Server │    │  Browser WebSocket   │     │
│  │   (REST API)    │    │      Server          │     │
│  └─────────────────┘    └──────────────────────┘     │
│           │                         │                  │
│           │  ┌──────────────────────┘                  │
│           ↓  ↓                                         │
│  ┌──────────────────────┐        ┌──────────────────┐│
│  │   server/store.js    │←───────│ Timeout Monitor  ││
│  │ (Enhanced In-Memory) │        │ (30s interval)   ││
│  │  + Connection Health │        └──────────────────┘│
│  └──────────────────────┘                             │
│           │     ↑          ↑                           │
│           └─────┼──────────┼───────────┐               │
│                 │          │           ↓              │
│           ┌─────┴────────┐ │   ┌──────────────────┐  │
│           │ OCPP Handler │ │   │ OCPP Commands    │  │
│           │  .js module  │ │   │  .js module      │  │
│           │ + Heartbeat  │ │   │  (11 commands)   │  │
│           │   Tracking   │ └───│  [NEW]           │  │
│           └──────────────┘     └──────────────────┘  │
│                 │                                      │
│                 ↓                                      │
│          ┌──────────────────┐                         │
│          │ OCPP WebSocket   │                         │
│          │     Server       │                         │
│          └──────────────────┘                         │
│                 │                                      │
└─────────────────┼──────────────────────────────────────┘
                  │ WebSocket /ocpp/:id
                  ↓
     ┌─────────────────────────┐
     │  OCPP 1.6-J Chargers    │
     │  (Real EV Hardware)     │
     │  - ID: 001 (7kW)        │
     │  - ID: 002 (22kW)       │
     └─────────────────────────┘
```

## Core Design Patterns

### 1. Dual WebSocket Architecture

**Pattern**: Separate WebSocket servers for different client types

**Implementation**:
```javascript
// server/index.js
const ocppWss = new WebSocket.Server({ noServer: true });
const browserWss = new WebSocket.Server({ noServer: true });

server.on('upgrade', (request, socket, head) => {
  const url = new URL(request.url, ...);
  
  if (url.pathname.startsWith('/ocpp/')) {
    ocppWss.handleUpgrade(...); // Route to OCPP server
  } else if (url.pathname === '/live') {
    browserWss.handleUpgrade(...); // Route to browser server
  }
});
```

**Why**: 
- OCPP requires subprotocol negotiation (`ocpp1.6`)
- Browser clients don't use subprotocols
- Different message formats and handling logic
- Security: Separate connection types reduces attack surface

### 2. Centralized State Management with Health Tracking

**Pattern**: Single source of truth with enhanced connection health monitoring

**Implementation**:
```javascript
// server/store.js (Enhanced)
const stations = {
  '001': {
    id: '001',
    name: 'Station 1 - 7kW',
    power: 7,
    status: 'Available',
    connected: false,
    
    // NEW: Connection health fields
    lastHeartbeat: null,       // Timestamp of last OCPP message
    connectedAt: null,         // Initial connection timestamp
    messageCount: 0,           // Total OCPP messages received
    
    // NEW: Historical data
    sessionHistory: [],        // Last 50 charging sessions
    meterHistory: [],          // Last 100 meter readings
    
    // NEW: Diagnostics
    configuration: null,       // Charger configuration
    capabilities: {},          // Detected capabilities
    diagnostics: {}            // Technical info (firmware, serial, etc.)
  }
};

module.exports = {
  getStations() { return Object.values(stations); },
  getStation(id) { return stations[id]; },
  updateStation(id, updates) { 
    Object.assign(stations[id], updates);
  },
  setChargerConnection(id, ws) { connections[id] = ws; },
  getChargerConnection(id) { return connections[id]; }
};
```

**Why**:
- No race conditions with single-threaded Node.js
- Easy to broadcast changes to all clients
- Simple debugging (one place to inspect state)
- Rich diagnostics without external database
- Can easily add persistence layer later

### 3. Heartbeat Tracking Pattern (NEW - Phase 1)

**Pattern**: Track activity on every OCPP message to maintain accurate connection status

**Implementation**:
```javascript
// server/ocpp-handler.js
function updateChargerActivity(chargerId) {
  const station = store.getStation(chargerId);
  if (!station) return;
  
  const now = Date.now();
  
  store.updateStation(chargerId, {
    lastHeartbeat: now,
    connected: true,
    messageCount: (station.messageCount || 0) + 1,
    connectedAt: station.connectedAt || now
  });
}

function handleOCPPMessage(chargerId, message, ws, broadcastUpdate) {
  // Update activity on EVERY message (not just Heartbeat)
  updateChargerActivity(chargerId);
  
  const [messageType, messageId, action, payload] = message;
  
  switch(action) {
    case 'BootNotification':
      return handleBootNotification(...);
    case 'Heartbeat':
      return handleHeartbeat(...);
    case 'StatusNotification':
      return handleStatusNotification(...);
    case 'MeterValues':
      return handleMeterValues(...);
    // ... other actions
  }
  
  // Broadcast after any state change
  broadcastUpdate();
}
```

**Why**:
- Tracks "last seen" timestamp for all activity, not just heartbeats
- Enables accurate "Active now" / "15s ago" status display
- Simple and reliable (updates on every message)
- Foundation for timeout detection
- No additional message overhead

### 4. Timeout Detection Pattern (NEW - Phase 1)

**Pattern**: Periodic monitoring loop to detect stale connections

**Implementation**:
```javascript
// server/index.js
const TIMEOUT_MS = 40000; // 40 seconds (4x typical 10s heartbeat)
const CHECK_INTERVAL_MS = 30000; // Check every 30 seconds

setInterval(() => {
  const now = Date.now();
  const stations = store.getStations();
  
  stations.forEach(station => {
    if (station.connected && station.lastHeartbeat) {
      const timeSinceLastMessage = now - station.lastHeartbeat;
      
      if (timeSinceLastMessage > TIMEOUT_MS) {
        console.log(`[OCPP] Charger ${station.id} timed out (${timeSinceLastMessage}ms since last message)`);
        
        store.updateStation(station.id, { 
          connected: false,
          status: 'Offline' 
        });
        
        store.setChargerConnection(station.id, null);
        broadcastUpdate();
      }
    }
  });
}, CHECK_INTERVAL_MS);
```

**Why**:
- Automatic detection of dead connections
- Lenient timeout (4x heartbeat) prevents false positives
- Independent from message handling (separation of concerns)
- Gracefully handles network issues
- Logs timeout events for debugging

### 5. Message Routing Pattern

**Pattern**: Route messages based on type and source

**OCPP Messages** (Charger → Server):
```javascript
// server/ocpp-handler.js
handleOCPPMessage(chargerId, message, ws, broadcastUpdate) {
  const [messageType, messageId, action, payload] = message;
  
  // Update activity tracking first
  updateChargerActivity(chargerId);
  
  switch(action) {
    case 'BootNotification':
      return handleBootNotification(...);
    case 'StatusNotification':
      return handleStatusNotification(...);
    case 'MeterValues':
      return handleMeterValues(...);
    case 'StartTransaction':
      return handleStartTransaction(...);
    case 'StopTransaction':
      return handleStopTransaction(...);
    // ... other actions
  }
}
```

**Why**:
- Each OCPP action has different payload structure
- Centralized handling simplifies debugging
- Easy to add new action handlers
- Separation of concerns from WebSocket handling

### 6. Broadcast Update Pattern

**Pattern**: Push-based real-time updates to all browser clients

**Implementation**:
```javascript
function broadcastUpdate() {
  const message = JSON.stringify({
    type: 'update',
    stations: store.getStations()
  });
  
  browserWss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

// Called after any state change:
// - Charger connects/disconnects
// - Status notification received
// - MeterValues received
// - Transaction starts/stops
// - Activity tracking updated
// - Timeout detected
```

**Why**:
- All browser clients stay synchronized
- No polling needed from frontend
- Immediate visual feedback
- Simple: no per-client state tracking

### 7. Request-Response Correlation

**Pattern**: Match async responses to requests using unique IDs

**OCPP to Charger**:
```javascript
// server/ocpp-handler.js
function sendToCharger(chargerId, action, payload) {
  const messageId = uuidv4();
  const message = [2, messageId, action, payload];
  
  ws.send(JSON.stringify(message));
  
  // Note: Not waiting for response in demo version
  // Production would track pending requests
}
```

**Charger to Server**:
```javascript
function handleOCPPMessage(chargerId, message, ws) {
  const [messageType, messageId, action, payload] = message;
  
  // Process request...
  const response = [3, messageId, responsePayload];
  ws.send(JSON.stringify(response));
}
```

**Why**:
- OCPP spec requires message ID correlation
- Enables async request/response over WebSocket
- Can track pending operations (not yet implemented)

### 8. OCPP Commands Module Pattern (NEW - Phase 2)

**Pattern**: Separate module for OCPP command generation

**Implementation**:
```javascript
// server/ocpp-commands.js
const { v4: uuidv4 } = require('uuid');

module.exports = {
  getConfiguration(keys = []) {
    return {
      messageId: uuidv4(),
      action: 'GetConfiguration',
      payload: { key: keys }
    };
  },
  
  reset(type = 'Soft') {
    return {
      messageId: uuidv4(),
      action: 'Reset',
      payload: { type } // 'Soft' or 'Hard'
    };
  },
  
  triggerMessage(requestedMessage, connectorId) {
    return {
      messageId: uuidv4(),
      action: 'TriggerMessage',
      payload: { requestedMessage, connectorId }
    };
  },
  
  // ... 8 more commands
};
```

**Why**:
- Clean separation from main handler
- Reusable command builders
- Easy to test independently
- Consistent message ID generation
- Extensible for new commands

### 9. Session History Pattern (NEW - Phase 2)

**Pattern**: Auto-pruning circular buffer for historical data

**Implementation**:
```javascript
// server/ocpp-handler.js
function handleStopTransaction(chargerId, payload, messageId, ws) {
  // ... calculate session details ...
  
  const station = store.getStation(chargerId);
  const sessionHistory = station.sessionHistory || [];
  
  // Add new session
  sessionHistory.unshift({
    transactionId: payload.transactionId,
    timestamp: new Date(payload.timestamp),
    energy: meterStop / 1000, // Convert Wh to kWh
    duration: Math.floor((new Date(payload.timestamp) - transaction.startTime) / 1000),
    cost: (meterStop / 1000) * 0.30,
    averagePower: Math.round((meterStop / 1000) / (duration / 3600)),
    reason: payload.reason || 'RemoteStop'
  });
  
  // Auto-prune to last 50 sessions
  if (sessionHistory.length > 50) {
    sessionHistory.pop();
  }
  
  store.updateStation(chargerId, { sessionHistory });
}
```

**Why**:
- Bounded memory usage (50 sessions max)
- No database needed for demo
- Newest sessions first (unshift)
- Automatic cleanup
- Useful for analytics and debugging

### 10. Admin Panel Architecture Pattern (NEW - Phase 2)

**Pattern**: Separate admin interface with same real-time backend

**Implementation**:
```javascript
// public/admin.js
const ws = new WebSocket(`${protocol}//${host}/live`);

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  
  if (data.type === 'update') {
    updateDashboard(data.stations);
  }
};

function updateDashboard(stations) {
  stations.forEach(station => {
    // Calculate time since last heartbeat
    const lastSeen = station.lastHeartbeat 
      ? formatTimeSince(Date.now() - station.lastHeartbeat)
      : 'Never';
    
    // Calculate uptime
    const uptime = station.connectedAt && station.connected
      ? formatDuration(Date.now() - station.connectedAt)
      : '-';
    
    // Display diagnostics
    updateStationCard(station, { lastSeen, uptime });
  });
}
```

**Why**:
- Reuses same WebSocket infrastructure
- Real-time updates without additional backend work
- Separate concerns (user UI vs admin UI)
- Professional monitoring interface
- No authentication needed for demo

## Critical Implementation Paths

### Path 1: Charger Connection Flow (Enhanced)
```
1. Charger initiates WebSocket to /ocpp/001
   ↓
2. server.on('upgrade') intercepts request
   ↓
3. Checks path starts with /ocpp/
   ↓
4. Extracts chargerId from path
   ↓
5. ocppWss.handleUpgrade() with subprotocol negotiation
   ↓
6. 'connection' event fires → store.setChargerConnection()
   ↓
7. store.updateStation(id, { 
     connected: true,
     connectedAt: Date.now(),
     lastHeartbeat: Date.now()
   })
   ↓
8. broadcastUpdate() notifies all browser clients
   ↓
9. Timeout monitor begins tracking this charger
```

### Path 2: Heartbeat Tracking Flow (NEW)
```
1. Charger sends ANY OCPP message (Heartbeat, MeterValues, etc.)
   ↓
2. handleOCPPMessage() called
   ↓
3. updateChargerActivity(chargerId) called FIRST
   ↓
4. Updates lastHeartbeat = Date.now()
   ↓
5. Increments messageCount
   ↓
6. Ensures connected = true
   ↓
7. Message processing continues normally
   ↓
8. broadcastUpdate() sends to all clients
   ↓
9. User and admin UIs show "● Active now"
```

### Path 3: Timeout Detection Flow (NEW)
```
1. Timeout monitor runs every 30 seconds
   ↓
2. Checks all stations
   ↓
3. For each connected station:
   ↓
4. Calculate: now - station.lastHeartbeat
   ↓
5. If > 40 seconds:
   ↓
6. Log timeout event
   ↓
7. Set connected = false, status = 'Offline'
   ↓
8. Clear WebSocket connection reference
   ↓
9. broadcastUpdate() to all clients
   ↓
10. UIs show station as offline
```

### Path 4: Remote Start Transaction (Enhanced)
```
1. User taps "Start Charging" in PWA
   ↓
2. POST /api/stations/:id/start with payment token
   ↓
3. Server checks station exists and connected
   ↓
4. sendToCharger(id, 'RemoteStartTransaction', {
     connectorId: 1,
     idTag: paymentToken
   })
   ↓
5. Charger receives OCPP message
   ↓
6. Charger responds with CALLRESULT (accepted/rejected)
   ↓
7. Charger sends StartTransaction message
   ↓
8. handleStartTransaction() updates store
   ↓
9. updateChargerActivity() called (heartbeat tracking)
   ↓
10. broadcastUpdate() → PWA shows "Charging"
```

### Path 5: Real-Time Energy Updates (Enhanced)
```
1. Charger sends MeterValues (every 10-60s)
   ↓
2. updateChargerActivity() updates lastHeartbeat
   ↓
3. handleMeterValues() extracts sampledValue array
   ↓
4. Identifies Energy.Active.Import.Register (kWh)
   ↓
5. Identifies Power.Active.Import (watts)
   ↓
6. NEW: Identifies Voltage, Current, Temperature, SoC
   ↓
7. Updates transaction in store
   ↓
8. NEW: Adds to meterHistory (auto-prune to 100)
   ↓
9. broadcastUpdate()
   ↓
10. Browser receives update via /live WebSocket
   ↓
11. app.js updates DOM (kWh, power, cost)
   ↓
12. admin.js updates diagnostics panel
```

### Path 6: Admin Diagnostics Flow (NEW)
```
1. Admin opens /admin.html
   ↓
2. admin.js connects to /live WebSocket
   ↓
3. Receives current station states
   ↓
4. For each station:
   ↓
5. Calculate time since lastHeartbeat
   ↓
6. Display "● Active now" or "15s ago"
   ↓
7. Calculate uptime if connected
   ↓
8. Show message count
   ↓
9. Display firmware, serial (if available)
   ↓
10. Show session history
   ↓
11. Real-time updates as data changes
```

### Path 7: OCPP Command Execution (NEW)
```
1. Admin uses API: POST /api/stations/001/trigger
   ↓
2. Server validates station exists and connected
   ↓
3. Imports ocpp-commands module
   ↓
4. Generates command: ocppCommands.triggerMessage(...)
   ↓
5. Sends to charger via WebSocket
   ↓
6. Command includes unique messageId
   ↓
7. Charger processes and responds
   ↓
8. Response triggers normal message handling
   ↓
9. Results stored in station state
   ↓
10. broadcastUpdate() to all clients
```

## Component Relationships

### server/index.js (Main Orchestrator + Timeout Monitor)
**Dependencies**: express, ws, ocpp-handler, ocpp-commands, store  
**Responsibilities**:
- HTTP server lifecycle
- WebSocket upgrade routing
- REST API endpoints
- Browser WebSocket management
- Connection lifecycle logging
- **NEW: Timeout monitoring loop (30s interval)**
- **NEW: Admin panel endpoints**

### server/ocpp-handler.js (Protocol Logic + Activity Tracking)
**Dependencies**: store, uuid, ocpp-commands  
**Responsibilities**:
- Parse incoming OCPP messages
- Validate message format
- Route to specific handlers
- Generate OCPP responses
- Send commands to chargers
- **NEW: Update charger activity on every message**
- **NEW: Store session history**
- **NEW: Store meter history**
- **NEW: Parse and store configuration**

**Key Exports**:
- `handleOCPPMessage(chargerId, message, ws, broadcastUpdate)`
- `sendToCharger(chargerId, action, payload)`
- **NEW: `updateChargerActivity(chargerId)`**

### server/ocpp-commands.js (Command Builder - NEW)
**Dependencies**: uuid  
**Responsibilities**:
- Generate OCPP command messages
- Ensure proper message format
- Consistent messageId generation
- Provide 11 command builders

**Key Exports**:
- `getConfiguration(keys)`
- `changeConfiguration(key, value)`
- `triggerMessage(message, connectorId)`
- `getDiagnostics(location)`
- `reset(type)`
- `unlockConnector(connectorId)`
- `updateFirmware(location, retrieveDate)`
- `setChargingProfile(connectorId, profile)`
- `clearChargingProfile(id, connectorId, purpose, stack)`
- `reserveNow(connectorId, expiryDate, idTag, reservationId)`
- `cancelReservation(reservationId)`

### server/store.js (Enhanced State Container)
**Dependencies**: None  
**Responsibilities**:
- Store station configurations
- Track station runtime state (status, connected, transaction)
- Map charger IDs to WebSocket connections
- Provide query and mutation interface
- **NEW: Store connection health metrics**
- **NEW: Store session history (last 50)**
- **NEW: Store meter history (last 100)**
- **NEW: Store configuration and capabilities**
- **NEW: Store diagnostics data**

**Key Exports**: All data access functions (getStation, updateStation, etc.)

### public/app.js (Frontend Controller)
**Dependencies**: Leaflet.js (CDN)  
**Responsibilities**:
- Initialize map
- Create station markers
- WebSocket connection to /live
- Handle station selection
- Show payment modal
- Display charging UI with real-time updates
- Send REST API requests
- **NEW: Display activity status ("Active now")**

### public/admin.js (Admin Dashboard - NEW)
**Dependencies**: None (vanilla JS)  
**Responsibilities**:
- Connect to /live WebSocket
- Display connection health metrics
- Calculate and format last seen timestamps
- Calculate and format uptime
- Show message counts
- Display diagnostics data
- Show session history
- Real-time updates

## Key Technical Decisions

### Decision 1: No Database
**Choice**: In-memory state only  
**Rationale**: Demo simplicity, no persistence needed, faster development  
**Trade-off**: State lost on restart, but acceptable for demo

### Decision 2: Two WebSocket Servers
**Choice**: Separate OCPP and browser WebSocket servers  
**Rationale**: Different protocols, different subprotocol requirements  
**Trade-off**: Slightly more complex routing, but cleaner separation

### Decision 3: Broadcast to All Clients
**Choice**: Send full state to all browser clients on any change  
**Rationale**: Simple, works for 2 stations, no client-side state management  
**Trade-off**: Doesn't scale, but acceptable for demo with 2 chargers

### Decision 4: No Response Tracking
**Choice**: Send OCPP commands without waiting for response  
**Rationale**: Faster development, charger will send status update anyway  
**Trade-off**: No immediate error feedback, but status updates arrive quickly

### Decision 5: Vanilla JavaScript Frontend
**Choice**: No React/Vue/framework  
**Rationale**: Small app, minimal dependencies, faster load  
**Trade-off**: More manual DOM manipulation, but manageable scope

### Decision 6: REST + WebSocket Hybrid
**Choice**: REST for commands, WebSocket for updates  
**Rationale**: REST familiar for actions, WebSocket for push updates  
**Trade-off**: Two protocols, but leverages strengths of each

### Decision 7: Single Connector Assumption
**Choice**: Each charger has one connector (connectorId: 1)  
**Rationale**: Actual hardware has one connector, simplifies code  
**Trade-off**: Wouldn't support multi-connector stations, but not needed

### Decision 8: Activity on All Messages (NEW - Phase 1)
**Choice**: Update lastHeartbeat on ANY OCPP message, not just Heartbeat  
**Rationale**: More accurate activity tracking, simpler than filtering  
**Trade-off**: None (all messages indicate activity)

### Decision 9: Lenient Timeout (NEW - Phase 1)
**Choice**: 40-second timeout (4x typical 10s heartbeat interval)  
**Rationale**: Prevents false positives from network hiccups  
**Trade-off**: Slower detection of dead connections, but more reliable

### Decision 10: Separate OCPP Commands Module (NEW - Phase 2)
**Choice**: Create ocpp-commands.js instead of inline command generation  
**Rationale**: Clean architecture, reusable, testable, extensible  
**Trade-off**: Extra file, but better organization

### Decision 11: Auto-Pruning History (NEW - Phase 2)
**Choice**: Automatically limit session/meter history (50/100 items)  
**Rationale**: Bounded memory, no manual cleanup needed  
**Trade-off**: Old data lost, but not needed for demo

### Decision 12: Admin Panel as Separate HTML (NEW - Phase 2)
**Choice**: admin.html separate from index.html  
**Rationale**: Different target users, different data density  
**Trade-off**: Some code duplication, but clear separation of concerns

## Error Handling Patterns

### WebSocket Error Recovery
```javascript
ws.on('error', (err) => {
  console.error(`[OCPP] Error from ${chargerId}:`, err);
  // Connection will close, 'close' handler will clean up
});

ws.on('close', () => {
  store.setChargerConnection(chargerId, null);
  store.updateStation(chargerId, { connected: false });
  broadcastUpdate();
  // Timeout monitor will mark as offline if doesn't reconnect
});
```

### OCPP Message Parsing
```javascript
try {
  const message = JSON.parse(data.toString());
  handleOCPPMessage(...);
} catch (err) {
  console.error(`[OCPP] Parse error from ${chargerId}:`, err);
  // Don't crash server, just log and continue
}
```

### REST API Validation
```javascript
const station = store.getStation(id);
if (!station) {
  return res.status(404).json({ error: 'Station not found' });
}

if (!station.connected) {
  return res.status(400).json({ error: 'Charger is offline' });
}
```

### Timeout Monitor Resilience
```javascript
setInterval(() => {
  try {
    // Check for stale connections
    checkTimeouts();
  } catch (err) {
    console.error('[Timeout Monitor] Error:', err);
    // Continue monitoring even if one check fails
  }
}, CHECK_INTERVAL_MS);
```

## Security Considerations (Demo Context)

**Current State**: Minimal security (acceptable for demo)

**What's Missing** (would need for production):
- No authentication on OCPP connections
- No authorization on REST endpoints
- No input validation on OCPP messages
- No rate limiting
- No TLS client certificates
- No CORS restrictions
- No admin authentication
- No API key management

**Demo Justification**: Closed network demo with known hardware, priority is functionality over security.

## Performance Optimizations

### Implemented
- Single broadcast to all clients (no per-client filtering)
- Auto-pruning history to limit memory growth
- Timeout checks every 30s (not every second)
- Minimal JSON serialization (only on state changes)

### Not Needed for Demo
- Database connection pooling
- Redis caching
- Message queuing
- Load balancing
- CDN for static assets

## Monitoring & Observability

### Console Logging Strategy
- `[OCPP]` prefix for charger communication
- `[Browser]` prefix for PWA client events
- `[WS]` prefix for WebSocket upgrade events
- `[Timeout Monitor]` prefix for timeout detection
- Timestamp implicit (console adds automatically)

### Admin Dashboard Metrics (NEW)
- Connection status (● Active / Offline)
- Last seen timestamp (seconds ago)
- Uptime (hours/minutes)
- Message count
- Firmware version
- Serial number
- Session history
- Configuration data

### Health Indicators
- Heartbeat regularity (should be ~10s intervals)
- Message count increasing (indicates activity)
- No timeout warnings in logs
- Browser WebSocket staying connected
- Railway server uptime

## Extensibility Points

### Easy to Add
- New OCPP commands (add to ocpp-commands.js)
- New OCPP message handlers (add case to switch)
- New REST endpoints (add to server/index.js)
- New station fields (add to store defaults)
- New admin panel metrics (modify admin.js)

### Requires Architecture Changes
- Database persistence (replace store.js)
- Authentication (add middleware, session management)
- Multi-tenant support (add organization context)
- Horizontal scaling (need shared state, message bus)
- OCPP 2.0+ (different message format)

## Best Practices Demonstrated

1. **Separation of Concerns**: Each module has clear responsibility
2. **Single Source of Truth**: Store is the only state container
3. **Activity Tracking**: Update status on every relevant event
4. **Lenient Timeouts**: Prefer false negatives over false positives
5. **Auto-Cleanup**: Prune old data automatically
6. **Real-Time Updates**: Push changes immediately
7. **Error Resilience**: Continue operating despite individual failures
8. **Observable**: Rich logging and admin dashboard
9. **Modular**: Commands separated from handlers
10. **Extensible**: Easy to add new features without breaking existing

This architecture successfully supports a production-ready demo with comprehensive monitoring, robust connection health tracking, and professional diagnostics capabilities.
