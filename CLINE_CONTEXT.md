# CLINE CONTEXT: EV Charging PWA with OCPP 1.6-J

## Project Overview

Building a progressive web app prototype for controlling real OCPP-compliant EV charging stations. This is for a demo tomorrow - functionality over polish.

## Current State

### Deployed
- **Live URL:** https://elink-production.up.railway.app/
- **Platform:** Railway (auto-deploys from GitHub on push)
- **Status:** Server runs, PWA loads, but chargers not connecting yet

### Hardware
- 2 real EV chargers (7kW and 22kW AC)
- OCPP 1.6 compliant
- Charger config panel requires URL format: `wss://www.example.com:443/socketserver/`
- Charger UID configured as: `001`

## Tech Stack
- **Backend:** Node.js + Express + `ws` library
- **Frontend:** Vanilla HTML/CSS/JS PWA with Leaflet maps
- **Protocol:** OCPP 1.6-J (JSON over WebSocket)
- **Deployment:** Railway (free tier)

## Architecture

```
┌─────────────────────────────────────────┐
│         PWA Frontend (Phone)            │
│   Map + Payment Form + Charging UI      │
│              ↕ WebSocket /live          │
├─────────────────────────────────────────┤
│          Node.js Server                 │
│   Express (REST) + WebSocket servers    │
│              ↕ WebSocket /ocpp/:id      │
├─────────────────────────────────────────┤
│        Real OCPP Chargers               │
│         (7kW and 22kW AC)               │
└─────────────────────────────────────────┘
```

## File Structure

```
ev-charging-app/
├── server/
│   ├── index.js          # Main server - Express + dual WebSocket
│   ├── ocpp-handler.js   # OCPP 1.6 message handler
│   └── store.js          # In-memory state (stations config here)
├── public/
│   ├── index.html        # PWA shell
│   ├── app.js            # Frontend logic
│   ├── style.css         # Mobile-first CSS
│   ├── manifest.json     # PWA manifest
│   └── sw.js             # Service worker
├── test-ocpp.js          # OCPP connection tester
└── package.json
```

## What Works
1. ✅ Server starts and runs on Railway
2. ✅ PWA loads in browser, map displays
3. ✅ Browser WebSocket connects (`/live` endpoint)
4. ✅ OCPP subprotocol negotiation (returns `ocpp1.6` header)
5. ✅ Local test passes: `node test-ocpp.js ws://localhost:3000/ocpp/001`

## What's Not Working
1. ❌ Real chargers not connecting to the server
2. ❓ Unknown if charger is even attempting connection (no logs appearing)

## Debugging Done So Far

### Problem 1: Missing OCPP Subprotocol (FIXED)
OCPP requires `Sec-WebSocket-Protocol: ocpp1.6` header in handshake response.
**Fix applied:** Added `handleProtocols` to WebSocket.Server config.

### Problem 2: Station IDs (FIXED)
Changed from `CHARGER-001` to `001` to match charger UID config.

### Problem 3: URL Path Format (UNCERTAIN)
Charger config says format must be: `wss://www.example.com:443/socketserver/`
Currently using: `wss://elink-production.up.railway.app:443/ocpp/`

**This might be the issue** - charger may require `/socketserver/` path specifically, or may have other URL requirements.

## Likely Next Steps to Debug

### 1. Check Railway Logs
Look for ANY connection attempts:
```
Railway Dashboard → Service → Deployments → View Logs
```

If no logs at all when charger "connects", the request isn't reaching the server.

### 2. Try Different URL Paths
The charger might require specific path. Try changing server to accept multiple paths:
- `/socketserver/`
- `/ocpp/`
- `/ws/`
- `/` (root)

### 3. Test from External Network
Run the test script against production:
```bash
node test-ocpp.js wss://elink-production.up.railway.app/ocpp/001
```

If this fails but localhost works, it's a Railway/SSL/networking issue.

### 4. Check Charger's Actual Request
Some chargers have debug logs or show connection status. Check:
- What exact URL is the charger trying to connect to?
- Is there an error message on the charger side?
- Does the charger show "connecting" / "connected" / "failed"?

### 5. SSL/TLS Issues
Some older chargers have issues with modern TLS. Railway uses TLS 1.2+.

### 6. Try Without Port Number
Some chargers don't like explicit port:
- `wss://elink-production.up.railway.app/ocpp/` (no :443)

## Key Code Sections

### WebSocket Upgrade Handler (server/index.js)
```javascript
server.on('upgrade', (request, socket, head) => {
  const url = new URL(request.url, `http://${request.headers.host}`);
  const protocols = request.headers['sec-websocket-protocol'];
  
  console.log(`[WS] Upgrade request: ${url.pathname}, protocols: ${protocols}`);
  
  if (url.pathname.startsWith('/ocpp/') || url.pathname.startsWith('/ocpp')) {
    // Handle OCPP connection
    let chargerId = url.pathname.replace('/ocpp/', '').replace('/ocpp', '');
    // ...
  }
});
```

### OCPP Subprotocol Handling (server/index.js)
```javascript
const ocppWss = new WebSocket.Server({ 
  noServer: true,
  handleProtocols: (protocols, request) => {
    if (protocols.has('ocpp1.6')) return 'ocpp1.6';
    if (protocols.has('ocpp2.0.1')) return 'ocpp2.0.1';
    return protocols.values().next().value || false;
  }
});
```

### Station Config (server/store.js)
```javascript
const stations = {
  '001': {
    id: '001',
    name: 'Station 1 - 7kW',
    power: 7,
    // ...
  },
  '002': {
    id: '002', 
    name: 'Station 2 - 22kW',
    power: 22,
    // ...
  }
};
```

## OCPP 1.6 Protocol Basics

Messages are JSON arrays:
- **CALL:** `[2, "uniqueId", "Action", {payload}]`
- **CALLRESULT:** `[3, "uniqueId", {payload}]`
- **CALLERROR:** `[4, "uniqueId", "errorCode", "errorDescription", {details}]`

Key message flow:
1. Charger connects via WebSocket
2. Charger sends `BootNotification`
3. Server responds with `Accepted`
4. Charger sends periodic `Heartbeat`
5. Charger sends `StatusNotification` on state changes
6. Server can send `RemoteStartTransaction` / `RemoteStopTransaction`

## Charger Configuration

**Current settings on charger:**
- URL: `wss://elink-production.up.railway.app:443/ocpp/`
- UID: `001`

**Expected connection URL:** `wss://elink-production.up.railway.app:443/ocpp/001`

## Commands

```bash
# Install dependencies
npm install

# Run locally
npm start
# or with auto-reload
npm run dev

# Test OCPP connection locally
node test-ocpp.js ws://localhost:3000/ocpp/001

# Test OCPP connection to production
node test-ocpp.js wss://elink-production.up.railway.app/ocpp/001

# Deploy (push to GitHub, Railway auto-deploys)
git add .
git commit -m "description"
git push
```

## Priority Tasks

1. **CRITICAL:** Get charger to connect to server
   - Debug why real charger isn't connecting
   - Check logs, try different URL formats
   
2. **HIGH:** Test start/stop charging flow once connected

3. **MEDIUM:** Update map coordinates to real charger locations

4. **LOW:** Polish UI, add error handling

## User Context

- User is in Skopje, Macedonia
- Demo is tomorrow
- User has access to charger config panel
- User can see Railway deployment logs
- This is a prototype/demo - doesn't need to be production-ready

## Questions to Ask User

1. What do you see in Railway logs when you configure the charger?
2. Does the charger show any error message or status when trying to connect?
3. What brand/model are your chargers? (might help find specific OCPP quirks)
4. Can you try the test script against production: `node test-ocpp.js wss://elink-production.up.railway.app/ocpp/001`
