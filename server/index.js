try { require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') }); } catch(e) {}

const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { handleOCPPMessage, sendToCharger } = require('./ocpp-handler');
const store = require('./store');
const ocppCommands = require('./ocpp-commands');

// New imports for auth, verification, and CitrineOS
const authRoutes = require('./routes/auth');
const verificationRoutes = require('./routes/verification');
const citrineRoutes = require('./routes/citrine');
const reservationRoutes = require('./routes/reservations');
const walletRoutes = require('./routes/wallet');
const notificationRoutes = require('./routes/notifications');
const userRoutes = require('./routes/users');
const { optionalAuth, authenticateToken, requireRole } = require('./auth');
const citrineClient = require('./citrine-client');
const { notifications } = require('./services');
const CitrinePoller = require('./citrine-poller');
const simulator = require('./simulator');

// Initialize services
notifications.init();

const app = express();
const server = http.createServer(app);

// Two WebSocket servers: one for OCPP chargers, one for browser clients
// OCPP server needs to handle subprotocol negotiation
const ocppWss = new WebSocket.Server({ 
  noServer: true,
  handleProtocols: (protocols, request) => {
    // Accept ocpp1.6 or ocpp2.0.1 subprotocol
    console.log(`[OCPP] Requested protocols: ${protocols}`);
    if (protocols.has('ocpp1.6')) return 'ocpp1.6';
    if (protocols.has('ocpp2.0.1')) return 'ocpp2.0.1';
    if (protocols.has('ocpp2.0')) return 'ocpp2.0';
    // If no recognized protocol, accept first one offered
    return protocols.values().next().value || false;
  }
});
const browserWss = new WebSocket.Server({ noServer: true });

app.use(express.json());

// Auto-versioning: generate unique version on each server start for cache-busting
const APP_VERSION = Date.now().toString(36);
const fs = require('fs');
console.log(`[Cache] APP_VERSION: ${APP_VERSION}`);

// Serve sw.js dynamically with version injected into cache name
app.get('/sw.js', (req, res) => {
  const swPath = path.join(__dirname, '../public/sw.js');
  let content = fs.readFileSync(swPath, 'utf8');
  content = content.replace(/__APP_VERSION__/g, APP_VERSION);
  res.set('Content-Type', 'application/javascript');
  res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.send(content);
});

// Inject version query params into HTML files for cache-busting
app.get(/\.html$|^\/$/, (req, res, next) => {
  let filePath;
  if (req.path === '/') {
    filePath = path.join(__dirname, '../public/index.html');
  } else {
    filePath = path.join(__dirname, '../public', req.path);
  }

  fs.readFile(filePath, 'utf8', (err, content) => {
    if (err) return next(); // fall through to static
    // Add ?v=VERSION to local CSS and JS references
    content = content.replace(
      /(?:href|src)="(\/[^"]*\.(?:css|js))(?:\?[^"]*)?"/g,
      (match, assetPath) => match.replace(assetPath, `${assetPath}?v=${APP_VERSION}`)
    );
    res.set('Content-Type', 'text/html');
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.send(content);
  });
});

app.use(express.static(path.join(__dirname, '../public'), { maxAge: '1h' }));

// New auth, verification, and CitrineOS routes
app.use('/api/auth', authRoutes);
app.use('/api/verification', verificationRoutes);
app.use('/api/citrine', citrineRoutes);
app.use('/api/reservations', reservationRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/users', userRoutes);

// REST API endpoints
app.get('/api/stations', (req, res) => {
  res.json(store.getStations());
});

// Server status endpoint
app.get('/api/status', (req, res) => {
  const stations = store.getStations();
  const demoStations = stations.filter(s => s.demoMode || s.connectionSource === 'demo').length;
  const realStations = stations.filter(s => s.connectionSource === 'ocpp').length;
  
  res.json({
    demoMode: DEMO_MODE,
    demoStations,
    realStations,
    totalStations: stations.length,
    timestamp: new Date().toISOString()
  });
});

app.get('/api/stations/:id', (req, res) => {
  const station = store.getStation(req.params.id);
  if (station) {
    res.json(station);
  } else {
    res.status(404).json({ error: 'Station not found' });
  }
});

// Demo strategy constants
const DEMO_MODE = process.env.DEMO_MODE === 'true';
const DEMO_CHARGER_ID = '30004496';
const DEMO_AWAIT_SECONDS = 20;
const DEFAULT_AWAIT_SECONDS = 30;

// Prevent double-tap on start
const startingStations = new Set();
// Track pending connection timeouts for cleanup
const pendingConnectionTimeouts = new Map();

// Broadcast connection phase updates to browser clients
function broadcastConnectionPhase(stationId, phase) {
  const payload = JSON.stringify({
    type: 'connection_phase',
    stationId,
    phase,
    timestamp: Date.now()
  });
  browserWss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  });
}

app.post('/api/stations/:id/start', optionalAuth, async (req, res) => {
  const { id } = req.params;
  const { idTag } = req.body;
  console.log(`[Start] Request for ${id}, user: ${req.user?.id || 'anon'}`);

  const station = store.getStation(id);
  if (!station) {
    return res.status(404).json({ error: 'Station not found' });
  }

  if (!station.connected) {
    return res.status(400).json({ error: 'Charger is offline' });
  }

  if (startingStations.has(id)) {
    return res.status(429).json({ error: 'Start already in progress' });
  }

  const effectiveIdTag = req.user?.id || idTag || 'DEMO-TAG-001';

  if (id === DEMO_CHARGER_ID) {
    // DEMO CHARGER: 20s "awaiting car connection" then start simulation
    console.log(`[Start] Demo charger ${id}: ${DEMO_AWAIT_SECONDS}s await`);
    startingStations.add(id);
    res.json({ status: 'connecting', isDemoCharger: true });
    broadcastConnectionPhase(id, 'awaiting_car');

    const timeout = setTimeout(() => {
      pendingConnectionTimeouts.delete(id);
      const fresh = store.getStation(id);

      console.log(`[Start] Demo await complete for ${id}, connected: ${fresh?.connected}, src: ${fresh?.connectionSource}`);

      if (!fresh || !fresh.connected) {
        console.error(`[Start] Station ${id} offline after await`);
        broadcastConnectionPhase(id, 'timeout');
        startingStations.delete(id);
        return;
      }

      if (fresh.connectionSource !== 'simulation') {
        const cr = simulator.simulateConnect(id);
        if (cr.error) {
          console.error(`[Start] simulateConnect failed for ${id}: ${cr.error}`);
          broadcastConnectionPhase(id, 'timeout');
          startingStations.delete(id);
          return;
        }
      }

      const sr = simulator.simulateStart(id, { idTag: effectiveIdTag });
      if (sr.error) {
        console.error(`[Start] simulateStart failed for ${id}: ${sr.error}`);
        broadcastConnectionPhase(id, 'timeout');
        startingStations.delete(id);
        return;
      }

      console.log(`[Start] Charging started on ${id}, txId: ${sr.transactionId}`);
      broadcastConnectionPhase(id, 'started');
      broadcastUpdate();
      startingStations.delete(id);
    }, DEMO_AWAIT_SECONDS * 1000);

    pendingConnectionTimeouts.set(id, timeout);
  } else {
    // ALL OTHER CHARGERS: 30s "awaiting car connection" then timeout
    startingStations.add(id);
    res.json({ status: 'connecting', isDemoCharger: false });
    broadcastConnectionPhase(id, 'awaiting_car');

    const timeout = setTimeout(() => {
      pendingConnectionTimeouts.delete(id);
      broadcastConnectionPhase(id, 'timeout');
      startingStations.delete(id);
    }, DEFAULT_AWAIT_SECONDS * 1000);

    pendingConnectionTimeouts.set(id, timeout);
  }
});

app.post('/api/stations/:id/stop', optionalAuth, async (req, res) => {
  const { id } = req.params;
  
  const station = store.getStation(id);
  if (!station) {
    return res.status(404).json({ error: 'Station not found' });
  }
  
  if (!station.currentTransaction) {
    return res.status(400).json({ error: 'No active transaction' });
  }

  // Simulated station: route to simulator
  if (station.connectionSource === 'simulation') {
    const result = simulator.simulateStop(id);
    if (result.error) return res.status(result.status || 400).json({ error: result.error });
    broadcastUpdate();
    return res.json({ status: 'stopped', message: 'Charging stopped', session: result.session });
  }

  // If CitrineOS mode is enabled, use CitrineOS API
  if (USE_CITRINE_POLLING) {
    try {
      const result = await citrineClient.remoteStopTransaction(id, station.currentTransaction.id);
      res.json({ status: 'requested', message: 'Stop command sent via CitrineOS', result });
    } catch (error) {
      console.error('[Stop] CitrineOS error:', error);
      res.status(500).json({ error: 'Failed to send command via CitrineOS' });
    }
  } else {
    // Direct OCPP mode
    const success = sendToCharger(id, 'RemoteStopTransaction', {
      transactionId: station.currentTransaction.id
    });
    
    if (success) {
      res.json({ status: 'requested', message: 'Stop command sent to charger' });
    } else {
      res.status(500).json({ error: 'Failed to send command' });
    }
  }
});

// Mock payment endpoint
app.post('/api/payment/process', (req, res) => {
  const { cardNumber, expiry, cvv } = req.body;
  
  // Simulate payment processing delay
  setTimeout(() => {
    // Always succeed for demo (check that card number is at least 16 digits of anything)
    if (cardNumber && cardNumber.replace(/\s/g, '').length >= 16) {
      const token = 'PAY-' + uuidv4().substring(0, 8).toUpperCase();
      res.json({ 
        success: true, 
        token,
        message: 'Payment authorized (DEMO)' 
      });
    } else {
      res.status(400).json({ 
        success: false, 
        message: 'Invalid card number' 
      });
    }
  }, 1000);
});

// Admin API endpoints
app.post('/api/stations', authenticateToken, requireRole('admin'), (req, res) => {
  const { id, name, power, pricePerKwh, lat, lng, address } = req.body;
  
  if (!id) {
    return res.status(400).json({ error: 'Station ID is required' });
  }
  
  const station = store.createStation({ id, name, power, pricePerKwh, lat, lng, address });
  
  if (!station) {
    return res.status(409).json({ error: 'Station with this ID already exists' });
  }
  
  broadcastUpdate();
  res.status(201).json(station);
});

app.put('/api/stations/:id', authenticateToken, requireRole('admin'), (req, res) => {
  const { id } = req.params;
  const { name, power, lat, lng, address, pricePerKwh, isHardware, newId } = req.body;

  const station = store.getStation(id);
  if (!station) {
    return res.status(404).json({ error: 'Station not found' });
  }

  // Handle ID change
  let targetId = id;
  if (newId && newId !== id) {
    const result = store.changeStationId(id, newId);
    if (!result) {
      return res.status(409).json({ error: 'New ID already exists or station not found' });
    }
    targetId = newId;
  }

  const updates = {};
  if (name !== undefined) updates.name = name;
  if (power !== undefined) updates.power = power;
  if (lat !== undefined) updates.lat = lat;
  if (lng !== undefined) updates.lng = lng;
  if (address !== undefined) updates.address = address;
  if (pricePerKwh !== undefined) updates.pricePerKwh = pricePerKwh;
  if (isHardware !== undefined) updates.isHardware = isHardware;

  const updatedStation = store.updateStation(targetId, updates);
  broadcastUpdate();
  res.json(updatedStation);
});

app.delete('/api/stations/:id', authenticateToken, requireRole('admin'), (req, res) => {
  const { id } = req.params;

  const station = store.getStation(id);
  if (!station) {
    return res.status(404).json({ error: 'Station not found' });
  }

  // Disconnect simulation first if active
  if (station.connectionSource === 'simulation') {
    simulator.simulateDisconnect(id);
  }

  const success = store.deleteStation(id, true);
  if (!success) {
    return res.status(500).json({ error: 'Failed to delete station' });
  }

  broadcastUpdate();
  res.json({ success: true, message: 'Station deleted' });
});

// === Simulation Routes (admin only) ===
app.post('/api/simulate/connect/:id', authenticateToken, requireRole('admin'), (req, res) => {
  const result = simulator.simulateConnect(req.params.id);
  if (result.error) return res.status(result.status || 400).json({ error: result.error });
  res.json(result);
});

app.post('/api/simulate/start/:id', authenticateToken, requireRole('admin'), (req, res) => {
  const result = simulator.simulateStart(req.params.id, req.body);
  if (result.error) return res.status(result.status || 400).json({ error: result.error });
  res.json(result);
});

app.post('/api/simulate/stop/:id', authenticateToken, requireRole('admin'), (req, res) => {
  const result = simulator.simulateStop(req.params.id);
  if (result.error) return res.status(result.status || 400).json({ error: result.error });
  res.json(result);
});

app.post('/api/simulate/disconnect/:id', authenticateToken, requireRole('admin'), (req, res) => {
  const result = simulator.simulateDisconnect(req.params.id);
  if (result.error) return res.status(result.status || 400).json({ error: result.error });
  res.json(result);
});

app.post('/api/simulate/demo-setup', authenticateToken, requireRole('admin'), (req, res) => {
  const results = simulator.setupDemoScenario();
  res.json(results);
});

app.get('/api/simulate/status', authenticateToken, requireRole('admin'), (req, res) => {
  res.json(simulator.getStatus());
});

// OCPP Command endpoints
app.get('/api/stations/:id/configuration', async (req, res) => {
  const { id } = req.params;
  
  const station = store.getStation(id);
  if (!station) {
    return res.status(404).json({ error: 'Station not found' });
  }
  
  if (!station.connected) {
    return res.status(400).json({ error: 'Charger is offline' });
  }
  
  try {
    const result = await ocppCommands.getConfiguration(id);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/stations/:id/trigger', async (req, res) => {
  const { id } = req.params;
  const { message, connectorId } = req.body;
  
  const station = store.getStation(id);
  if (!station) {
    return res.status(404).json({ error: 'Station not found' });
  }
  
  if (!station.connected) {
    return res.status(400).json({ error: 'Charger is offline' });
  }
  
  try {
    const result = await ocppCommands.triggerMessage(id, message, connectorId);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/stations/:id/configure', async (req, res) => {
  const { id } = req.params;
  const { key, value } = req.body;
  
  const station = store.getStation(id);
  if (!station) {
    return res.status(404).json({ error: 'Station not found' });
  }
  
  if (!station.connected) {
    return res.status(400).json({ error: 'Charger is offline' });
  }
  
  try {
    const result = await ocppCommands.changeConfiguration(id, key, value);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/stations/:id/diagnostics', async (req, res) => {
  const { id } = req.params;
  
  const station = store.getStation(id);
  if (!station) {
    return res.status(404).json({ error: 'Station not found' });
  }
  
  // Return stored diagnostics and configuration
  res.json({
    configuration: station.configuration || null,
    capabilities: station.capabilities || null,
    diagnostics: station.diagnostics || {},
    vendor: station.vendor,
    model: station.model,
    serialNumber: station.serialNumber,
    firmwareVersion: station.firmwareVersion
  });
});

app.post('/api/stations/:id/reset', async (req, res) => {
  const { id } = req.params;
  const { type } = req.body; // 'Soft' or 'Hard'
  
  const station = store.getStation(id);
  if (!station) {
    return res.status(404).json({ error: 'Station not found' });
  }
  
  if (!station.connected) {
    return res.status(400).json({ error: 'Charger is offline' });
  }
  
  try {
    const result = await ocppCommands.reset(id, type || 'Soft');
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/stations/:id/unlock', async (req, res) => {
  const { id } = req.params;
  const { connectorId } = req.body;
  
  const station = store.getStation(id);
  if (!station) {
    return res.status(404).json({ error: 'Station not found' });
  }
  
  if (!station.connected) {
    return res.status(400).json({ error: 'Charger is offline' });
  }
  
  try {
    const result = await ocppCommands.unlockConnector(id, connectorId || 1);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Session history endpoint
app.get('/api/stations/:id/sessions', (req, res) => {
  const { id } = req.params;
  
  const station = store.getStation(id);
  if (!station) {
    return res.status(404).json({ error: 'Station not found' });
  }
  
  res.json({
    sessions: station.sessionHistory || [],
    lastTransaction: station.lastTransaction || null,
    currentTransaction: station.currentTransaction || null
  });
});

// Handle upgrade requests - route to correct WebSocket server
server.on('upgrade', (request, socket, head) => {
  const url = new URL(request.url, `http://${request.headers.host}`);
  
  // Check for OCPP subprotocol in request
  const protocols = request.headers['sec-websocket-protocol'];
  const isOCPP = protocols && protocols.toLowerCase().includes('ocpp');
  
  console.log(`[WS] Upgrade request: ${url.pathname}, protocols: ${protocols}`);
  
  // Accept multiple paths for OCPP: /ocpp/, /OCPP/, /socketserver/, /ws/ (case-insensitive)
  const pathLower = url.pathname.toLowerCase();
  const ocppPaths = ['/ocpp/', '/ocpp', '/socketserver/', '/socketserver', '/ws/', '/ws'];
  const isOcppPath = ocppPaths.some(p => pathLower.startsWith(p) || pathLower === p);
  
  if (isOcppPath) {
    // OCPP charger connection
    // Extract charger ID from path - remove any known prefix (case-insensitive)
    let chargerId = url.pathname
      .replace(/^\/ocpp\//i, '').replace(/^\/ocpp$/i, '')
      .replace(/^\/OCPP\//i, '').replace(/^\/OCPP$/i, '')
      .replace(/^\/socketserver\//i, '').replace(/^\/socketserver$/i, '')
      .replace(/^\/ws\//i, '').replace(/^\/ws$/i, '');
    
    // If no ID in path, charger might send it in BootNotification
    // We'll wait for the first message to identify it
    const pathOnlyId = chargerId;
    
    console.log(`[OCPP] Charger connecting on path: ${url.pathname}, extracted ID: ${pathOnlyId || '(none, will wait for BootNotification)'}`);
    
    // Handle OCPP subprotocol negotiation
    ocppWss.handleUpgrade(request, socket, head, (ws) => {
      ws.pathChargerId = pathOnlyId;  // ID from URL path (if any)
      ws.chargerId = pathOnlyId || null;  // Will be updated after BootNotification
      ws.isIdentified = !!pathOnlyId;  // Flag to track if we know the real ID yet
      ocppWss.emit('connection', ws, request);
    });
  } else if (url.pathname === '/live') {
    // Browser client connection
    browserWss.handleUpgrade(request, socket, head, (ws) => {
      browserWss.emit('connection', ws, request);
    });
  } else {
    console.log(`[WS] Unknown path, destroying: ${url.pathname}`);
    socket.destroy();
  }
});

// Timeout monitor - check for offline chargers every 30 seconds
// Only applies to direct OCPP connections, not CitrineOS-polled or simulated stations
setInterval(() => {
  const stations = store.getStations();
  const now = Date.now();
  const TIMEOUT_MS = 40000; // 40 seconds (allowing for 4 missed 10-second heartbeats)

  stations.forEach(station => {
    // Only timeout direct OCPP connections - skip poller/simulation managed stations
    if (station.connected && station.lastHeartbeat && station.connectionSource === 'ocpp') {
      const timeSinceLastHeartbeat = now - station.lastHeartbeat;

      if (timeSinceLastHeartbeat > TIMEOUT_MS) {
        console.log(`[OCPP] Charger ${station.id} timed out (${Math.floor(timeSinceLastHeartbeat / 1000)}s since last heartbeat)`);
        store.updateStation(station.id, {
          connected: false,
          status: 'Offline'
        });
        broadcastUpdate();
      }
    }
  });
}, 30000); // Check every 30 seconds

// OCPP WebSocket handling
ocppWss.on('connection', (ws) => {
  let chargerId = ws.chargerId;
  let isIdentified = ws.isIdentified;
  
  console.log(`[OCPP] WebSocket connected${chargerId ? ` (path ID: ${chargerId})` : ' (waiting for BootNotification)'}]`);
  
  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString());
      const messageType = message[0];
      
      // If not yet identified, check for BootNotification to get charger ID
      if (!isIdentified && messageType === 2) {
        const [, messageId, action, payload] = message;
        if (action === 'BootNotification' && payload.chargePointSerialNumber) {
          chargerId = payload.chargePointSerialNumber;
          ws.chargerId = chargerId;
          isIdentified = true;
          
          console.log(`[OCPP] Identified charger from BootNotification: ${chargerId}`);
          
          // Register the connection now that we know the ID
          store.setChargerConnection(chargerId, ws);
          store.updateStation(chargerId, { 
            connected: true,
            lastHeartbeat: Date.now(),
            connectedAt: Date.now(),
            demoMode: false,
            connectionSource: 'ocpp',
            vendor: payload.chargePointVendor,
            model: payload.chargePointModel,
            serialNumber: payload.chargePointSerialNumber,
            firmwareVersion: payload.firmwareVersion
          });
          broadcastUpdate();
        }
      }
      
      if (!chargerId) {
        console.log(`[OCPP] Message from unidentified charger:`, JSON.stringify(message));
        return;
      }
      
      console.log(`[OCPP] ${chargerId} ->`, JSON.stringify(message));
      handleOCPPMessage(chargerId, message, ws, broadcastUpdate);
    } catch (err) {
      console.error(`[OCPP] Parse error:`, err);
    }
  });
  
  ws.on('close', () => {
    if (chargerId) {
      console.log(`[OCPP] Charger disconnected: ${chargerId}`);
      store.setChargerConnection(chargerId, null);
      store.updateStation(chargerId, { connected: false, status: 'Offline' });
      broadcastUpdate();
    } else {
      console.log(`[OCPP] Unidentified charger disconnected`);
    }
  });
  
  ws.on('error', (err) => {
    console.error(`[OCPP] Error${chargerId ? ` from ${chargerId}` : ''}:`, err);
  });
});

// Browser WebSocket handling
browserWss.on('connection', (ws) => {
  console.log('[Browser] Client connected');
  
  // Send current state immediately
  ws.send(JSON.stringify({
    type: 'init',
    stations: store.getStations()
  }));
  
  ws.on('close', () => {
    console.log('[Browser] Client disconnected');
  });
});

// Broadcast updates to all browser clients
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

// Make broadcastUpdate available to ocpp-handler
module.exports = { broadcastUpdate };

// Set broadcast function for CitrineOS webhook handler
citrineRoutes.setBroadcastUpdate(broadcastUpdate);

// Initialize simulator with broadcast function
simulator.init(broadcastUpdate);

// CitrineOS Polling Service
const USE_CITRINE_POLLING = process.env.USE_CITRINEOS === 'true';
const citrinePoller = new CitrinePoller(broadcastUpdate);

// Auto demo setup: connect all stations via simulation on startup
// CitrineOS poller runs alongside but skips simulation-connected stations
if (USE_CITRINE_POLLING) {
  setTimeout(() => {
    citrinePoller.start();
    // Auto-setup demo after poller's first cycle completes
    setTimeout(() => {
      console.log('[Demo] Auto-connecting all stations via simulation...');
      const results = simulator.setupDemoScenario();
      console.log('[Demo] Setup complete:', results.results.map(r => `${r.id}: ${r.action}`).join(', '));
      broadcastUpdate();
    }, 5000);
  }, 3000);
} else {
  // No poller - just run demo setup directly
  setTimeout(() => {
    console.log('[Demo] Auto-connecting all stations via simulation...');
    simulator.setupDemoScenario();
    broadcastUpdate();
  }, 3000);
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`╔════════════════════════════════════════════════════════════╗`);
  console.log(`║              eLink EV Charging Server v2.0                 ║`);
  console.log(`╠════════════════════════════════════════════════════════════╣`);
  console.log(`║  PWA:           http://localhost:${PORT}                    ║`);
  console.log(`║  OCPP Endpoint: ws://localhost:${PORT}/ocpp/{chargerId}     ║`);
  console.log(`║  Browser WS:    ws://localhost:${PORT}/live                 ║`);
  console.log(`║                                                            ║`);
  console.log(`║  NEW API Endpoints:                                        ║`);
  console.log(`║  • Auth:        /api/auth/* (register, login, verify)      ║`);
  console.log(`║  • Verification:/api/verification/* (charger verify)       ║`);
  console.log(`║  • CitrineOS:   /api/citrine/* (OCPP hub integration)      ║`);
  console.log(`╚════════════════════════════════════════════════════════════╝`);
});
