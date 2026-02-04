/**
 * ESP32 Charger Compatibility Layer
 * Handles broken WebSocket clients that send HTTP instead of WS
 */

const express = require('express');
const router = express.Router();
const WebSocket = require('ws');
const store = require('../store');
const { handleOCPPMessage, sendToCharger } = require('../ocpp-handler');

// Store connections
const connections = new Map();

// Handle broken ESP32 WebSocket clients
router.get('/:chargerId', (req, res) => {
  const { chargerId } = req.params;
  const clientIp = req.ip || req.connection.remoteAddress;
  
  console.log(`[ESP32-Compat] Connection attempt from ${clientIp} for charger ${chargerId}`);
  console.log(`[ESP32-Compat] Headers:`, JSON.stringify(req.headers));
  
  // Check if this is actually a WebSocket request
  const upgrade = req.headers.upgrade;
  const connection = req.headers.connection;
  
  if (upgrade === 'websocket' || (connection && connection.includes('Upgrade'))) {
    // Proper WebSocket - let it through to the normal handler
    console.log(`[ESP32-Compat] Proper WebSocket detected for ${chargerId}`);
    return res.status(426).json({ 
      error: 'Upgrade Required',
      message: 'Use WebSocket protocol'
    });
  }
  
  // The charger is sending plain HTTP instead of WebSocket
  // Let's accept it and create a pseudo-connection
  console.log(`[ESP32-Compat] Broken ESP32 client detected - accepting HTTP connection for ${chargerId}`);
  
  // Update station as "connected"
  store.updateStation(chargerId, {
    connected: true,
    connectedAt: Date.now(),
    lastHeartbeat: Date.now()
  });
  
  // Send a BootNotification response (this is what the charger expects)
  const response = {
    status: 'Accepted',
    currentTime: new Date().toISOString(),
    interval: 60
  };
  
  res.json(response);
  
  console.log(`[ESP32-Compat] Sent BootNotification response to ${chargerId}`);
});

// Handle POST data from charger
router.post('/:chargerId', (req, res) => {
  const { chargerId } = req.params;
  
  console.log(`[ESP32-Compat] POST from ${chargerId}:`, JSON.stringify(req.body));
  
  // Update activity
  store.updateStation(chargerId, {
    lastHeartbeat: Date.now(),
    connected: true
  });
  
  res.json({ status: 'Accepted' });
});

module.exports = router;
