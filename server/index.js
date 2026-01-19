const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { handleOCPPMessage, sendToCharger } = require('./ocpp-handler');
const store = require('./store');

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
app.use(express.static(path.join(__dirname, '../public')));

// REST API endpoints
app.get('/api/stations', (req, res) => {
  res.json(store.getStations());
});

app.get('/api/stations/:id', (req, res) => {
  const station = store.getStation(req.params.id);
  if (station) {
    res.json(station);
  } else {
    res.status(404).json({ error: 'Station not found' });
  }
});

app.post('/api/stations/:id/start', (req, res) => {
  const { id } = req.params;
  const { idTag } = req.body; // RFID tag or generated token
  
  const station = store.getStation(id);
  if (!station) {
    return res.status(404).json({ error: 'Station not found' });
  }
  
  if (!station.connected) {
    return res.status(400).json({ error: 'Charger is offline' });
  }
  
  // Send RemoteStartTransaction to charger
  const success = sendToCharger(id, 'RemoteStartTransaction', {
    connectorId: 1,
    idTag: idTag || 'DEMO-TAG-001'
  });
  
  if (success) {
    res.json({ status: 'requested', message: 'Start command sent to charger' });
  } else {
    res.status(500).json({ error: 'Failed to send command' });
  }
});

app.post('/api/stations/:id/stop', (req, res) => {
  const { id } = req.params;
  
  const station = store.getStation(id);
  if (!station) {
    return res.status(404).json({ error: 'Station not found' });
  }
  
  if (!station.currentTransaction) {
    return res.status(400).json({ error: 'No active transaction' });
  }
  
  // Send RemoteStopTransaction to charger
  const success = sendToCharger(id, 'RemoteStopTransaction', {
    transactionId: station.currentTransaction.id
  });
  
  if (success) {
    res.json({ status: 'requested', message: 'Stop command sent to charger' });
  } else {
    res.status(500).json({ error: 'Failed to send command' });
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
    
    // If no ID in path, charger might send it differently - use a default
    if (!chargerId) {
      chargerId = 'unknown';
    }
    
    console.log(`[OCPP] Charger connecting: ${chargerId}`);
    
    // Handle OCPP subprotocol negotiation
    ocppWss.handleUpgrade(request, socket, head, (ws) => {
      ws.chargerId = chargerId;
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

// OCPP WebSocket handling
ocppWss.on('connection', (ws) => {
  const chargerId = ws.chargerId;
  console.log(`[OCPP] Charger connected: ${chargerId}`);
  
  // Register charger connection
  store.setChargerConnection(chargerId, ws);
  store.updateStation(chargerId, { connected: true });
  broadcastUpdate();
  
  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString());
      console.log(`[OCPP] ${chargerId} ->`, JSON.stringify(message));
      handleOCPPMessage(chargerId, message, ws, broadcastUpdate);
    } catch (err) {
      console.error(`[OCPP] Parse error from ${chargerId}:`, err);
    }
  });
  
  ws.on('close', () => {
    console.log(`[OCPP] Charger disconnected: ${chargerId}`);
    store.setChargerConnection(chargerId, null);
    store.updateStation(chargerId, { connected: false, status: 'Offline' });
    broadcastUpdate();
  });
  
  ws.on('error', (err) => {
    console.error(`[OCPP] Error from ${chargerId}:`, err);
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

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`- PWA: http://localhost:${PORT}`);
  console.log(`- OCPP endpoint: ws://localhost:${PORT}/ocpp/{chargerId}`);
  console.log(`- Browser WS: ws://localhost:${PORT}/live`);
});
