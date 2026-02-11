const WebSocket = require('ws');
const store = require('./store');

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
      browserWss.handleUpgrade(request, socket, head, (ws) => {
        browserWss.emit('connection', ws, request);
      });
    } else {
      console.log(`[WS] Unknown path, destroying: ${url.pathname}`);
      socket.destroy();
    }
  });

  // Browser WebSocket handling
  browserWss.on('connection', (ws) => {
    console.log('[Browser] Client connected');
    ws.send(JSON.stringify({ type: 'init', stations: store.getStations() }));
    ws.on('close', () => console.log('[Browser] Client disconnected'));
  });
}

function getOcppWss() { return ocppWss; }
function getBrowserWss() { return browserWss; }

function broadcastUpdate() {
  if (!browserWss) return;
  const message = JSON.stringify({ type: 'update', stations: store.getStations() });
  browserWss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
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
