const WebSocket = require('ws');
const store = require('./store');
const { verifyAccessToken } = require('./auth');

let ocppWss = null;
let browserWss = null;

function init(server) {
  ocppWss = new WebSocket.Server({
    noServer: true,
    handleProtocols: (protocols) => {
      console.log(`[OCPP] Requested protocols: ${protocols}`);
      if (protocols.has('ocpp1.6')) return 'ocpp1.6';
      if (protocols.has('ocpp2.0.1')) return 'ocpp2.0.1';
      if (protocols.has('ocpp2.0')) return 'ocpp2.0';
      return protocols.values().next().value || false;
    }
  });
  browserWss = new WebSocket.Server({ noServer: true });

  // Handle upgrade requests - route to correct WebSocket server
  server.on('upgrade', (request, socket, head) => {
    const url = new URL(request.url, `http://${request.headers.host}`);
    const protocols = request.headers['sec-websocket-protocol'];

    console.log(`[WS] Upgrade request: ${url.pathname}, protocols: ${protocols}`);

    const pathLower = url.pathname.toLowerCase();
    const ocppPaths = ['/ocpp/', '/ocpp', '/socketserver/', '/socketserver', '/ws/', '/ws'];
    const isOcppPath = ocppPaths.some(p => pathLower.startsWith(p) || pathLower === p);

    if (isOcppPath) {
      let chargerId = url.pathname
        .replace(/^\/ocpp\//i, '').replace(/^\/ocpp$/i, '')
        .replace(/^\/OCPP\//i, '').replace(/^\/OCPP$/i, '')
        .replace(/^\/socketserver\//i, '').replace(/^\/socketserver$/i, '')
        .replace(/^\/ws\//i, '').replace(/^\/ws$/i, '');

      console.log(`[OCPP] Charger connecting on path: ${url.pathname}, extracted ID: ${chargerId || '(none, will wait for BootNotification)'}`);

      ocppWss.handleUpgrade(request, socket, head, (ws) => {
        ws.pathChargerId = chargerId;
        ws.chargerId = chargerId || null;
        ws.isIdentified = !!chargerId;
        ocppWss.emit('connection', ws, request);
      });
    } else if (url.pathname === '/live') {
      // Extract JWT from query param for per-user filtering
      const token = url.searchParams.get('token');
      let userId = null;
      if (token) {
        const decoded = verifyAccessToken(token);
        if (decoded) userId = decoded.userId;
      }

      browserWss.handleUpgrade(request, socket, head, (ws) => {
        ws.userId = userId;
        browserWss.emit('connection', ws, request);
      });
    } else {
      console.log(`[WS] Unknown path, destroying: ${url.pathname}`);
      socket.destroy();
    }
  });

  // Browser WebSocket handling
  browserWss.on('connection', (ws) => {
    console.log(`[Browser] Client connected, userId: ${ws.userId || 'anonymous'}`);
    ws.send(JSON.stringify({ type: 'init', stations: sanitizeStationsForUser(store.getStations(), ws.userId) }));
    ws.on('close', () => console.log('[Browser] Client disconnected'));
  });
}

function getOcppWss() { return ocppWss; }
function getBrowserWss() { return browserWss; }

function sanitizeStationsForUser(stations, userId) {
  return stations.map(station => {
    if (!station.currentTransaction) return station;
    // Owner sees full data
    if (userId && station.currentTransaction.idTag === userId) return station;
    // Everyone else sees only that it's occupied
    return {
      ...station,
      currentTransaction: {
        active: true,
        startTime: station.currentTransaction.startTime
      }
    };
  });
}

function broadcastUpdate() {
  if (!browserWss) return;
  const allStations = store.getStations();
  browserWss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      const filtered = sanitizeStationsForUser(allStations, client.userId);
      client.send(JSON.stringify({ type: 'update', stations: filtered }));
    }
  });
}

function broadcastConnectionPhase(stationId, phase) {
  if (!browserWss) return;
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

module.exports = { init, getOcppWss, getBrowserWss, broadcastUpdate, broadcastConnectionPhase };
