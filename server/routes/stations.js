const express = require('express');
const router = express.Router();
const store = require('../store');
const simulator = require('../simulator');
const { authenticateToken, requireRole } = require('../auth');
const { broadcastUpdate } = require('../websocket');
const { DEMO_MODE } = require('../config');

// List all stations
router.get('/', (req, res) => {
  res.json(store.getStations());
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
router.get('/:id', (req, res) => {
  const station = store.getStation(req.params.id);
  if (station) {
    res.json(station);
  } else {
    res.status(404).json({ error: 'Station not found' });
  }
});

// Session history
router.get('/:id/sessions', (req, res) => {
  const station = store.getStation(req.params.id);
  if (!station) {
    return res.status(404).json({ error: 'Station not found' });
  }
  res.json({
    sessions: station.sessionHistory || [],
    lastTransaction: station.lastTransaction || null,
    currentTransaction: station.currentTransaction || null
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

module.exports = router;
