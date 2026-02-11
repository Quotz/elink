const { PORT, USE_CITRINE_POLLING } = require('./config');
const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const { notifications } = require('./services');
const websocket = require('./websocket');
const ocppConnection = require('./ocpp-connection');
const simulator = require('./simulator');
const CitrinePoller = require('./citrine-poller');
const { broadcastUpdate } = require('./websocket');

// Initialize services
notifications.init();

const app = express();
const server = http.createServer(app);

// Initialize WebSocket servers
websocket.init(server);

// Initialize OCPP connection handler
ocppConnection.init(websocket.getOcppWss());

app.use(express.json());

// Auto-versioning: generate unique version on each server start for cache-busting
const APP_VERSION = Date.now().toString(36);
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
  const filePath = req.path === '/'
    ? path.join(__dirname, '../public/index.html')
    : path.join(__dirname, '../public', req.path);

  fs.readFile(filePath, 'utf8', (err, content) => {
    if (err) return next();
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

// Mount routes (OCPP command routes before station CRUD to match specific paths first)
app.use('/api/auth', require('./routes/auth'));
app.use('/api/verification', require('./routes/verification'));
app.use('/api/citrine', require('./routes/citrine'));
app.use('/api/reservations', require('./routes/reservations'));
app.use('/api/wallet', require('./routes/wallet'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/users', require('./routes/users'));
app.use('/api/stations', require('./routes/ocpp'));
app.use('/api/stations', require('./routes/stations'));
app.use('/api', require('./routes/charging'));
app.use('/api/simulate', require('./routes/simulation'));

// CitrineOS Polling + auto demo setup
const citrinePoller = new CitrinePoller();

if (USE_CITRINE_POLLING) {
  setTimeout(() => {
    citrinePoller.start();
    setTimeout(() => {
      console.log('[Demo] Auto-connecting all stations via simulation...');
      const results = simulator.setupDemoScenario();
      console.log('[Demo] Setup complete:', results.results.map(r => `${r.id}: ${r.action}`).join(', '));
      broadcastUpdate();
    }, 5000);
  }, 3000);
} else {
  setTimeout(() => {
    console.log('[Demo] Auto-connecting all stations via simulation...');
    simulator.setupDemoScenario();
    broadcastUpdate();
  }, 3000);
}

server.listen(PORT, () => {
  console.log(`╔════════════════════════════════════════════════════════════╗`);
  console.log(`║              eLink EV Charging Server v2.0                 ║`);
  console.log(`╠════════════════════════════════════════════════════════════╣`);
  console.log(`║  PWA:           http://localhost:${PORT}                    ║`);
  console.log(`║  OCPP Endpoint: ws://localhost:${PORT}/ocpp/{chargerId}     ║`);
  console.log(`║  Browser WS:    ws://localhost:${PORT}/live                 ║`);
  console.log(`╚════════════════════════════════════════════════════════════╝`);
});
