const express = require('express');
const router = express.Router();
const store = require('../store');
const simulator = require('../simulator');
const { authenticateToken, optionalAuth, requireRole } = require('../auth');
const { broadcastUpdate } = require('../websocket');
const { DEMO_MODE } = require('../config');

function sanitizeStation(station, userId) {
  if (!station.currentTransaction) return station;
  if (userId && station.currentTransaction.idTag === userId) return station;
  return {
    ...station,
    currentTransaction: {
      active: true,
      startTime: station.currentTransaction.startTime
    }
  };
}

// List all stations
router.get('/', optionalAuth, (req, res) => {
  const userId = req.user?.id;
  res.json(store.getStations().map(s => sanitizeStation(s, userId)));
});

// Server status
router.get('/status', (req, res) => {
  const stations = store.getStations();
  res.json({
    demoMode: DEMO_MODE,
    demoStations: stations.filter(s => s.demoMode || s.connectionSource === 'demo').length,
    realStations: stations.filter(s => s.connectionSource === 'ocpp').length,
    totalStations: stations.length,
    timestamp: new Date().toISOString()
  });
});

// Get single station
router.get('/:id', optionalAuth, (req, res) => {
  const station = store.getStation(req.params.id);
  if (!station) return res.status(404).json({ error: 'Station not found' });
  res.json(sanitizeStation(station, req.user?.id));
});

// Session history
router.get('/:id/sessions', optionalAuth, (req, res) => {
  const station = store.getStation(req.params.id);
  if (!station) {
    return res.status(404).json({ error: 'Station not found' });
  }
  const sanitized = sanitizeStation(station, req.user?.id);
  res.json({
    sessions: station.sessionHistory || [],
    lastTransaction: station.lastTransaction || null,
    currentTransaction: sanitized.currentTransaction || null
  });
});

// Create station (admin)
router.post('/', authenticateToken, requireRole('admin'), (req, res) => {
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

// Update station (admin)
router.put('/:id', authenticateToken, requireRole('admin'), (req, res) => {
  const { id } = req.params;
  const { name, power, lat, lng, address, pricePerKwh, isHardware, newId } = req.body;

  const station = store.getStation(id);
  if (!station) {
    return res.status(404).json({ error: 'Station not found' });
  }

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

// Delete station (admin)
router.delete('/:id', authenticateToken, requireRole('admin'), (req, res) => {
  const { id } = req.params;
  const station = store.getStation(id);
  if (!station) {
    return res.status(404).json({ error: 'Station not found' });
  }

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

// Reset station to available (admin)
router.post('/:id/reset', authenticateToken, requireRole('admin'), (req, res) => {
  const { id } = req.params;
  const station = store.getStation(id);
  if (!station) return res.status(404).json({ error: 'Station not found' });

  if (station.connectionSource === 'simulation') {
    simulator.simulateDisconnect(id);
    simulator.simulateConnect(id);
  } else {
    store.updateStation(id, {
      status: 'Available',
      currentTransaction: null,
      meterHistory: []
    });
  }

  broadcastUpdate();
  res.json({ success: true, message: 'Station reset to Available' });
});

module.exports = router;
