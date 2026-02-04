const express = require('express');
const router = express.Router();
const store = require('../store');

// Get diagnostic info for a charger
router.get('/:chargerId', async (req, res) => {
  try {
    const { chargerId } = req.params;
    const station = store.getStation(chargerId);
    
    if (!station) {
      return res.status(404).json({ error: 'Charger not found' });
    }

    // Calculate connection stats
    const now = Date.now();
    const lastHeartbeat = station.lastHeartbeat;
    const connectedAt = station.connectedAt;
    
    let timeSinceLastHeartbeat = null;
    let connectionDuration = null;
    
    if (lastHeartbeat) {
      timeSinceLastHeartbeat = Math.floor((now - lastHeartbeat) / 1000);
    }
    if (connectedAt) {
      connectionDuration = Math.floor((now - connectedAt) / 1000);
    }

    res.json({
      chargerId: station.id,
      name: station.name,
      status: station.status,
      connected: station.connected && timeSinceLastHeartbeat !== null && timeSinceLastHeartbeat < 120,
      lastHeartbeat: lastHeartbeat ? new Date(lastHeartbeat).toISOString() : null,
      timeSinceLastHeartbeat,
      connectedAt: connectedAt ? new Date(connectedAt).toISOString() : null,
      connectionDuration,
      messageCount: station.messageCount,
      vendor: station.vendor,
      model: station.model,
      serialNumber: station.serialNumber,
      firmwareVersion: station.firmwareVersion,
      currentTransaction: station.currentTransaction,
      diagnostics: station.diagnostics,
      configuration: station.configuration,
      serverTime: new Date().toISOString(),
      serverIp: '46.225.21.7'
    });
  } catch (error) {
    console.error('Diagnostics error:', error);
    res.status(500).json({ error: 'Failed to get diagnostics' });
  }
});

// Get all chargers status (for overview)
router.get('/', async (req, res) => {
  try {
    const stations = store.getStations();
    const now = Date.now();
    
    const overview = stations.map(s => ({
      id: s.id,
      name: s.name,
      connected: s.connected && s.lastHeartbeat && (now - s.lastHeartbeat) < 120000,
      status: s.status,
      lastHeartbeat: s.lastHeartbeat ? new Date(s.lastHeartbeat).toISOString() : null,
      messageCount: s.messageCount
    }));

    res.json({
      chargers: overview,
      total: overview.length,
      online: overview.filter(c => c.connected).length,
      serverTime: new Date().toISOString(),
      serverIp: '46.225.21.7',
      websocketUrl: 'wss://staging.elink.mk:443/ocpp/{chargerId}'
    });
  } catch (error) {
    console.error('Diagnostics overview error:', error);
    res.status(500).json({ error: 'Failed to get overview' });
  }
});

module.exports = router;
