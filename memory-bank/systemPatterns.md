# System Patterns: EV Charging PWA Architecture

## System Architecture

### High-Level Overview
```
┌─────────────────────────────────────────────────────────┐
│                    Mobile Browser                       │
│  ┌──────────────────────────────────────────────────┐  │
│  │              PWA (public/*)                      │  │
│  │  - index.html (UI shell)                         │  │
│  │  - app.js (map, payment, charging UI logic)     │  │
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
│  ┌──────────────────────┐                             │
│  │   server/store.js    │                             │
│  │  (In-Memory State)   │                             │
│  └──────────────────────┘                             │
│           │     ↑                                       │
│           └─────┼───────────────────┐                  │
│                 │                   ↓                  │
│           ┌─────┴────────┐   ┌──────────────────┐    │
│           │ OCPP Handler │   │ OCPP WebSocket   │    │
│           │  .js module  │   │     Server       │    │
│           └──────────────┘   └──────────────────┘    │
│                                      │                 │
└──────────────────────────────────────┼────────────────┘
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

### 2. Centralized State Management

**Pattern**: Single source of truth with controlled access

**Implementation**:
```javascript
// server/store.js
const stations = { ... };      // Station configs
const connections = {};        // chargerId → WebSocket
const transactions = {};       // transactionId → details

module.exports = {
  getStations() { return Object.values(stations); },
  getStation(id) { return stations[id]; },
  updateStation(id, updates) { ... },
  setChargerConnection(id, ws) { connections[id] = ws; },
  getChargerConnection(id) { return connections[id]; }
};
```

**Why**:
- No race conditions with single-threaded Node.js
- Easy to broadcast changes to all clients
- Simple debugging (one place to inspect state)
- Can easily add persistence layer later

### 3. Message Routing Pattern

**Pattern**: Route messages based on type and source

**OCPP Messages** (Charger → Server):
```javascript
// server/ocpp-handler.js
handleOCPPMessage(chargerId, message, ws, broadcastUpdate) {
  const [messageType, messageId, action, payload] = message;
  
  switch(action) {
    case 'BootNotification':
      return handleBootNotification(...);
    case 'StatusNotification':
      return handleStatusNotification(...);
    case 'MeterValues':
      return handleMeterValues(...);
    // ... other actions
  }
}
```

**Why**:
- Each OCPP action has different payload structure
- Centralized handling simplifies debugging
- Easy to add new action handlers
- Separation of concerns from WebSocket handling

### 4. Broadcast Update Pattern

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
```

**Why**:
- All browser clients stay synchronized
- No polling needed from frontend
- Immediate visual feedback
- Simple: no per-client state tracking

### 5. Request-Response Correlation

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

## Critical Implementation Paths

### Path 1: Charger Connection Flow
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
7. store.updateStation(id, { connected: true })
   ↓
8. broadcastUpdate() notifies all browser clients
```

### Path 2: Remote Start Transaction
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
8. handleStartTransaction() updates store with transaction
   ↓
9. broadcastUpdate() → PWA shows "Charging"
```

### Path 3: Real-Time Energy Updates
```
1. Charger sends MeterValues (every 10-60s, charger-dependent)
   ↓
2. handleMeterValues() extracts sampledValue array
   ↓
3. Identifies Energy.Active.Import.Register (kWh)
   ↓
4. Identifies Power.Active.Import (watts)
   ↓
5. Updates transaction in store
   ↓
6. broadcastUpdate()
   ↓
7. Browser receives update via /live WebSocket
   ↓
8. app.js updates DOM (kWh, power, cost)
```

## Component Relationships

### server/index.js (Main Orchestrator)
**Dependencies**: express, ws, ocpp-handler, store  
**Responsibilities**:
- HTTP server lifecycle
- WebSocket upgrade routing
- REST API endpoints
- Browser WebSocket management
- Connection lifecycle logging

### server/ocpp-handler.js (Protocol Logic)
**Dependencies**: store, uuid  
**Responsibilities**:
- Parse incoming OCPP messages
- Validate message format
- Route to specific handlers
- Generate OCPP responses
- Send commands to chargers

**Key Exports**:
- `handleOCPPMessage(chargerId, message, ws, broadcastUpdate)`
- `sendToCharger(chargerId, action, payload)`

### server/store.js (State Container)
**Dependencies**: None  
**Responsibilities**:
- Store station configurations
- Track station runtime state (status, connected, transaction)
- Map charger IDs to WebSocket connections
- Provide query and mutation interface

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

## Security Considerations (Demo Context)

**Current State**: Minimal security (acceptable for demo)

**What's Missing** (would need for production):
- No authentication on OCPP connections
- No authorization on REST endpoints
- No input validation on OCPP messages
- No rate limiting
- No TLS client certificates
- No CORS restrictions

**Demo Justification**: Closed network demo with known hardware, priority is functionality over security.
