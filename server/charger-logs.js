/**
 * Charger Diagnostics HTTP Endpoint
 * Accepts diagnostic uploads from chargers via HTTP
 */

const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

const LOGS_DIR = path.join(__dirname, '..', '..', 'data', 'diagnostics');

// Ensure logs directory exists
if (!fs.existsSync(LOGS_DIR)) {
  fs.mkdirSync(LOGS_DIR, { recursive: true });
}

// Receive diagnostic upload from charger (POST)
router.post('/upload/:chargerId', express.raw({ type: '*/*', limit: '50mb' }), (req, res) => {
  const { chargerId } = req.params;
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `${chargerId}_diagnostics_${timestamp}.log`;
  const filepath = path.join(LOGS_DIR, filename);
  
  try {
    fs.writeFileSync(filepath, req.body);
    console.log(`[Diagnostics] Received upload from ${chargerId}: ${filename} (${req.body.length} bytes)`);
    res.status(200).send('OK');
  } catch (error) {
    console.error(`[Diagnostics] Failed to save upload:`, error);
    res.status(500).send('Error');
  }
});

// Receive diagnostic upload (multipart/form-data for some chargers)
router.post('/upload-form/:chargerId', express.urlencoded({ extended: true, limit: '50mb' }), (req, res) => {
  const { chargerId } = req.params;
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `${chargerId}_diagnostics_${timestamp}.json`;
  const filepath = path.join(LOGS_DIR, filename);
  
  try {
    fs.writeFileSync(filepath, JSON.stringify(req.body, null, 2));
    console.log(`[Diagnostics] Received form upload from ${chargerId}: ${filename}`);
    res.status(200).send('OK');
  } catch (error) {
    console.error(`[Diagnostics] Failed to save form upload:`, error);
    res.status(500).send('Error');
  }
});

// Simple ping endpoint for testing connectivity
router.get('/ping/:chargerId', (req, res) => {
  const { chargerId } = req.params;
  console.log(`[Diagnostics] Ping from ${chargerId} at ${new Date().toISOString()}`);
  res.json({ 
    status: 'ok', 
    chargerId,
    serverTime: new Date().toISOString(),
    serverIp: '46.225.21.7'
  });
});

// List all diagnostic files
router.get('/logs', (req, res) => {
  try {
    const files = fs.readdirSync(LOGS_DIR);
    res.json({ 
      files: files.map(f => ({
        name: f,
        size: fs.statSync(path.join(LOGS_DIR, f)).size,
        created: fs.statSync(path.join(LOGS_DIR, f)).mtime
      })),
      path: LOGS_DIR
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to list logs' });
  }
});

// View specific log file
router.get('/logs/:filename', (req, res) => {
  const { filename } = req.params;
  const filepath = path.join(LOGS_DIR, filename);
  
  // Security check
  if (!filepath.startsWith(LOGS_DIR)) {
    return res.status(403).send('Forbidden');
  }
  
  try {
    const content = fs.readFileSync(filepath, 'utf8');
    res.type('text/plain').send(content);
  } catch (error) {
    res.status(404).send('Not found');
  }
});

module.exports = router;
